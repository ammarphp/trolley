#!/usr/bin/env python3
"""Descriptive run analysis. Usage: python3 scripts/analyze.py exported-run.json"""
import argparse, csv, json, statistics
from collections import Counter, defaultdict
from pathlib import Path

def summarize(rows):
    decisions = [r for r in rows if r.get('choice') in ('pull', 'stay')]
    counts = Counter(r.get('choice') for r in rows)
    times = [float(r['activeMs']) / 1000 for r in decisions if r.get('activeMs') is not None]
    return {'responses': len(rows), 'decisions': len(decisions), 'intervened': counts['pull'], 'did_nothing': counts['stay'], 'skipped': counts['skip'], 'intervention_rate': counts['pull'] / len(decisions) if decisions else None, 'median_active_seconds': statistics.median(times) if times else None, 'max_depth': max((int(r['depth']) for r in rows if r.get('depth') is not None), default=None)}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    payload = json.loads(args.export.read_text())
    rows = payload['records'] if isinstance(payload, dict) else payload
    if not isinstance(rows, list): raise SystemExit('Expected a records array.')
    ids = [r.get('responseId') for r in rows]
    runs, themes, stages = defaultdict(list), defaultdict(list), defaultdict(list)
    for row in rows:
        runs[row.get('runId', 'unassigned')].append(row)
        themes[f"{row.get('mode')}:{row.get('family')}"] .append(row)
        stages[str(row.get('stage'))].append(row)
    result = {'unit': 'run', 'warning': 'Exploratory descriptions only. Runs are not people; observations within runs are dependent. Narrative/content/visuals are confounded.', 'data_quality': {'duplicate_response_ids': len(ids) - len(set(ids)), 'missing_reason': sum(r.get('reason') is None for r in rows), 'negative_active_times': sum(float(r.get('activeMs', 0)) < 0 for r in rows), 'agent_records': sum(r.get('source') == 'agent' for r in rows)}, 'overall': summarize(rows), 'runs': {k:summarize(v) for k,v in runs.items()}, 'themes': {k:summarize(v) for k,v in themes.items()}, 'stages': {k:summarize(v) for k,v in stages.items()}}
    text = json.dumps(result, indent=2)
    if args.output: args.output.write_text(text + '\n')
    else: print(text)

if __name__ == '__main__': main()
