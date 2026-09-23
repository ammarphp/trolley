#!/usr/bin/env python3
"""Validate this handoff package, not the future game. Standard library only.

Usage:
    python validate_handoff.py
    python validate_handoff.py --report VALIDATION_REPORT.json
    python validate_handoff.py --check-manifest
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def read_json(relative: str) -> Any:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def canonical_hash(value: Any) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def check_graph(tasks: list[dict[str, Any]], profile: str) -> int:
    applicable = {t["id"]: t for t in tasks if profile in t["applies_to_profiles"]}
    done: set[str] = set()
    active: set[str] = set()

    def visit(task_id: str) -> None:
        require(task_id in applicable, f"Unavailable dependency {task_id} for {profile}")
        if task_id in done:
            return
        require(task_id not in active, f"Dependency cycle at {task_id} in {profile}")
        active.add(task_id)
        task = applicable[task_id]
        dependencies = task["depends_on"] + task.get("conditional_dependencies", {}).get(profile, [])
        for dependency in dependencies:
            visit(dependency)
        active.remove(task_id)
        done.add(task_id)

    for task_id in applicable:
        visit(task_id)
    return len(done)


def validate(check_manifest: bool = False) -> dict[str, Any]:
    checks: list[str] = []
    # Syntax-check every bundled JSON file, including the prior report when present.
    for path in ROOT.rglob("*.json"):
        json.loads(path.read_text(encoding="utf-8"))
    checks.append("All bundled JSON files parse.")

    backlog = read_json("backlog/tasks.json")
    tasks = backlog["tasks"]
    ids = [task["id"] for task in tasks]
    require(len(ids) == len(set(ids)) == 60, "Expected 60 unique task IDs")
    for task in tasks:
        require(task["owner_role"] in backlog["roles"], f"Unknown owner: {task['id']}")
        require(task["reviewer_role"] in backlog["roles"], f"Unknown reviewer: {task['id']}")
        require(bool(task["acceptance_criteria"]) and bool(task["primary_deliverable"]), f"Incomplete task: {task['id']}")
    profiles = {profile: check_graph(tasks, profile) for profile in ("local_story", "remote_statistics", "formal_study")}
    checks.append("All 60 task IDs, roles, outputs and criteria exist; all three release-profile dependency graphs are acyclic and resolve.")

    research = (ROOT / "06_RESEARCH_SPEC_AND_SOURCES.md").read_text(encoding="utf-8")
    sources = set(re.findall(r"\*\*(SRC-\d{2})\s+—", research))
    require(len(sources) == 25, "Expected 25 starter sources")
    for path in ROOT.rglob("*.md"):
        text = path.read_text(encoding="utf-8")
        used = set(re.findall(r"\bSRC-\d{2}\b", text))
        require(used <= sources, f"Undefined source ID in {path.name}: {used - sources}")
        for link in re.findall(r"\[[^\]\n]+\]\(([^)]+)\)", text):
            if "://" in link or link.startswith("#") or link.startswith("mailto:"):
                continue
            target = (path.parent / link.split("#", 1)[0]).resolve()
            require(target.exists(), f"Broken relative link in {path.name}: {link}")
    checks.append("All internal Markdown file links and source IDs resolve.")

    trace = (ROOT / "08_REQUIREMENTS_TRACEABILITY.md").read_text(encoding="utf-8")
    requirements = re.findall(r"\| (R-\d{3}) \|", trace)
    require(len(requirements) == len(set(requirements)) == 62, "Expected 62 unique requirements")
    checks.append("62 unique requirement mappings are present.")

    metadata = read_json("source/source_metadata.json")
    source_bytes = (ROOT / "source/user_original_brief.txt").read_bytes()
    require(hashlib.sha256(source_bytes).hexdigest() == metadata["original_brief_sha256"], "Original brief hash mismatch")
    require(len(source_bytes.decode("utf-8").splitlines()) == 353, "Original brief line count mismatch")
    checks.append("Original 353-line brief matches its recorded SHA-256 checksum.")

    node = read_json("fixtures/sample_node.json")
    before = read_json("fixtures/sample_state_before.json")
    expected = read_json("fixtures/sample_state_after.json")
    record = read_json("fixtures/sample_decision_record.json")
    require(len(node["options"]) == 2 and len({o["id"] for o in node["options"]}) == 2, "Sample must have two semantic options")
    for option in node["options"]:
        probability = option["incident"]["probabilityBasisPoints"]
        require(isinstance(probability, int) and 0 <= probability <= 10000, "Invalid sample probability")
        require(option["incident"]["fatalitiesIfTriggered"] >= 0, "Invalid fatalities")
    option = next(o for o in node["options"] if o["id"] == record["executedOptionId"])
    computed = json.loads(json.dumps(before))
    for effect in option["immediateEffects"]:
        require(effect["op"] == "add" and effect["field"] in computed["world"], "Invalid illustrative effect")
        computed["world"][effect["field"]] += effect["value"]
    draw = record["randomEvidence"]["drawBasisPoints"]
    require(0 <= draw < 10000, "Sample draw out of range")
    triggered = draw < option["incident"]["probabilityBasisPoints"]
    require(triggered == record["randomEvidence"]["triggered"], "Sample branch mismatch")
    fatalities = min(computed["world"]["populationAlive"], option["incident"]["fatalitiesIfTriggered"]) if triggered else 0
    computed["world"]["populationAlive"] -= fatalities
    computed["world"]["cumulativeFatalities"] += fatalities
    computed["permissions"].append(record["newPermission"])
    computed["stateRevision"] += 1
    require(computed == expected, "Sample transition arithmetic mismatch")
    require(canonical_hash(before) == record["stateBeforeHash"], "Before-state hash mismatch")
    require(canonical_hash(expected) == record["stateAfterHash"], "After-state hash mismatch")
    require(len({e["id"] for e in record["domainEvents"]}) == len(record["domainEvents"]), "Duplicate sample events")
    require(sum(e.get("fatalities", 0) for e in record["domainEvents"]) == fatalities, "Casualties not counted once")
    require(record["statistics"]["eligible"] is False, "Synthetic fixture must not enter public statistics")
    require(set(record["sourceRefs"]) <= sources, "Undefined sample source")
    checks.append("Worked node has two choices, valid probabilities, consistent transition arithmetic, actual state hashes, unique casualty events and synthetic-data exclusion.")

    if check_manifest:
        for line in (ROOT / "MANIFEST.sha256").read_text(encoding="utf-8").splitlines():
            checksum, name = line.split("  ", 1)
            path = ROOT / name
            require(path.is_file(), f"Missing manifest file: {name}")
            require(hashlib.sha256(path.read_bytes()).hexdigest() == checksum, f"Manifest mismatch: {name}")
        checks.append("Every listed package checksum matches MANIFEST.sha256.")

    return {"status": "passed", "scope": "handoff package structure and illustrative fixtures only; not a game implementation or empirical research validation", "counts": {"tasks": len(tasks), "requirements": len(requirements), "starter_sources": len(sources), "tasks_by_release_profile": profiles}, "checks": checks}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, help="Explicitly write the validation report at this path")
    parser.add_argument("--check-manifest", action="store_true")
    args = parser.parse_args()
    try:
        report = validate(args.check_manifest)
    except (OSError, ValueError, KeyError, TypeError, StopIteration) as exc:
        raise SystemExit(f"HANDOFF VALIDATION FAILED: {exc}") from exc
    rendered = json.dumps(report, indent=2) + "\n"
    if args.report:
        args.report.write_text(rendered, encoding="utf-8")
    print(rendered, end="")


if __name__ == "__main__":
    main()
