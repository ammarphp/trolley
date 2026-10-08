#!/usr/bin/env node
/**
 * Validates src/render/staging/stage1-2.ts against the authored campaign and
 * the render API. Run with Node 24 (native TypeScript stripping):
 *
 *   node scripts/staging-check-1-2.mjs [path/to/stage1-2.ts]
 *
 * Checks:
 *   - every S1-* / S2-* node is staged, nothing extra, option ids exact;
 *   - every id belongs to the unions in src/render/api.ts (parsed, not copied);
 *   - occupant shapes follow the Occupant union (keys, required keys, types);
 *   - people counts 1..400, signs uppercase and <= 28 characters;
 *   - renderer semantics: on-rail beats (impact/stop) put people on the rail
 *     and bloody the glass, so on-rail people must equal the option's certain
 *     deaths (or the rail cohort), stage 1 strikes nobody, and the living lead
 *     an on-rail branch.
 * Exits 1 on any error.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CAMPAIGN_NODES } from "../src/content/campaign/index.ts";

// An optional path checks another copy of the file (used to test this script).
const target = process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : new URL("../src/render/staging/stage1-2.ts", import.meta.url).href;
const { GRAMMAR_1_2, STAGING_1_2 } = await import(target);

const STAGES = new Set([1, 2]);
const SIGN_MAX = 28;
const LABEL_MAX = 24;
const NAME_MAX = 40;
const DESCRIBE_MAX = 200;
const PEOPLE_MIN = 1;
const PEOPLE_MAX = 400;
const ON_RAIL = new Set(["impact", "stop"]);
/** Certain deaths deliberately not drawn on the rail, with the reason. */
const OFF_RAIL_DEATHS = {
  "S2-07/workers": "the two who die are passengers aboard the overturned carriage, not people on the gravel bed",
};

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// ------------------------------------------------------------ parse api.ts

const apiSource = readFileSync(new URL("../src/render/api.ts", import.meta.url), "utf8");
const api = apiSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

function stringUnion(name) {
  const m = api.match(new RegExp(`export type ${name}\\s*=([^;]*);`));
  if (!m) throw new Error(`api.ts: union ${name} not found`);
  const values = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  if (!values.length) throw new Error(`api.ts: union ${name} is empty`);
  return new Set(values);
}

function interfaceFields(name) {
  const m = api.match(new RegExp(`export interface ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error(`api.ts: interface ${name} not found`);
  const fields = new Map();
  for (const f of m[1].matchAll(/^\s*(\w+)(\?)?\s*:/gm)) fields.set(f[1], { optional: !!f[2] });
  return fields;
}

const UNIONS = {};
for (const name of ["PersonRole", "Pose", "AnimalId", "VehicleId", "MachineId", "PropId", "DocumentId", "LandmarkId", "Beat"]) UNIONS[name] = stringUnion(name);

/** Occupant variants: kind -> { key -> { optional, type } }. */
const OCCUPANT = (() => {
  const m = api.match(/export type Occupant\s*=([\s\S]*?\});/);
  if (!m) throw new Error("api.ts: Occupant not found");
  const variants = new Map();
  for (const v of m[1].matchAll(/\{([^}]*)\}/g)) {
    const fields = new Map();
    for (const part of v[1].split(";")) {
      const f = part.trim().match(/^(\w+)(\?)?\s*:\s*(.+)$/);
      if (!f) continue;
      const raw = f[3].trim();
      let type;
      if (raw.startsWith('"')) type = { literals: new Set([...raw.matchAll(/"([^"]+)"/g)].map((x) => x[1])) };
      else if (raw === "number" || raw === "string") type = { primitive: raw };
      else if (UNIONS[raw]) type = { union: raw };
      else throw new Error(`api.ts: Occupant field ${f[1]} has unhandled type ${raw}`);
      fields.set(f[1], { optional: !!f[2], type });
    }
    const kind = fields.get("kind")?.type.literals;
    if (!kind || kind.size !== 1) throw new Error("api.ts: Occupant variant without a single kind literal");
    fields.delete("kind");
    variants.set([...kind][0], fields);
  }
  return variants;
})();

const OPTION_FIELDS = interfaceFields("OptionStaging");
const NODE_FIELDS = interfaceFields("NodeStaging");

// ------------------------------------------------------------ helpers

const isInt = (n) => Number.isInteger(n);

function certainDeaths(node, option) {
  if (node.rail) {
    const route = node.rail.routes.find((r) => r.optionId === option.id);
    if (!route) return { count: 0, source: "rail (no route)" };
    let count = 0;
    for (const step of route.steps) {
      if (step.kind === "contact") {
        if (!step.present) continue;
        count += step.targets.reduce((sum, t) => sum + t.count, 0);
        if (step.stopsWhenOccupied) break;
      } else if (step.kind === "brake" && step.operational) break;
    }
    return { count, source: "rail cohort" };
  }
  const count = option.effects.filter((e) => e.kind === "casualties").reduce((sum, e) => sum + e.count, 0);
  return { count, source: "casualty effects" };
}

function checkValue(where, key, spec, value) {
  const t = spec.type;
  if (t.primitive === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) err(where, `${key} must be a finite number`);
  } else if (t.primitive === "string") {
    if (typeof value !== "string" || !value.trim()) err(where, `${key} must be a non-empty string`);
  } else if (t.union) {
    if (!UNIONS[t.union].has(value)) err(where, `${key} "${value}" is not a ${t.union}`);
  } else if (t.literals) {
    if (!t.literals.has(value)) err(where, `${key} "${value}" not in ${[...t.literals].join("|")}`);
  }
}

function checkOccupant(where, occ, stage) {
  const fields = OCCUPANT.get(occ?.kind);
  if (!fields) return err(where, `unknown occupant kind "${occ?.kind}"`);
  for (const key of Object.keys(occ)) if (key !== "kind" && !fields.has(key)) err(where, `unknown key "${key}" on ${occ.kind}`);
  for (const [key, spec] of fields) {
    if (occ[key] === undefined) {
      if (!spec.optional) err(where, `${occ.kind} is missing required "${key}"`);
      continue;
    }
    checkValue(where, key, spec, occ[key]);
  }
  if (occ.kind === "people") {
    if (!isInt(occ.count) || occ.count < PEOPLE_MIN || occ.count > PEOPLE_MAX) err(where, `people count ${occ.count} outside ${PEOPLE_MIN}..${PEOPLE_MAX}`);
    if (occ.name !== undefined && occ.name.length > NAME_MAX) err(where, `name longer than ${NAME_MAX}`);
    if (occ.pose === "tied" && stage === 1) err(where, "nobody is tied to the rails in stage 1");
  } else if (occ.count !== undefined && (!isInt(occ.count) || occ.count < 1)) err(where, `${occ.kind} count must be a positive integer`);
  if (occ.kind === "prop" && occ.scale !== undefined && !(occ.scale > 0 && occ.scale <= 2)) err(where, `prop scale ${occ.scale} outside (0, 2]`);
  if (occ.kind === "document" && occ.label !== undefined) {
    if (occ.label !== occ.label.toUpperCase()) err(where, `document label "${occ.label}" must be uppercase`);
    if (occ.label.length > LABEL_MAX) err(where, `document label "${occ.label}" longer than ${LABEL_MAX}`);
  }
}

// ------------------------------------------------------------ coverage

const nodes = CAMPAIGN_NODES.filter((n) => STAGES.has(n.stage));
const byId = new Map(nodes.map((n) => [n.id, n]));
for (const id of byId.keys()) if (!STAGING_1_2[id]) err(id, "node is not staged");
for (const id of Object.keys(STAGING_1_2)) if (!byId.has(id)) err(id, "staged node is not an S1/S2 campaign node");
for (const id of byId.keys()) if (!GRAMMAR_1_2[id]) err(id, "no grammar class");
for (const id of Object.keys(GRAMMAR_1_2)) if (!byId.has(id)) err(id, "grammar class for an unknown node");

// ------------------------------------------------------------ per node

let options = 0;
let occupants = 0;
let people = 0;
for (const node of nodes) {
  const staging = STAGING_1_2[node.id];
  if (!staging) continue;
  for (const key of Object.keys(staging)) if (!NODE_FIELDS.has(key)) err(node.id, `unknown NodeStaging key "${key}"`);
  if (typeof staging.describe !== "string" || !staging.describe.trim()) err(node.id, "describe is required");
  else {
    if (/\n/.test(staging.describe)) err(node.id, "describe must be one line");
    if (staging.describe.length > DESCRIBE_MAX) err(node.id, `describe longer than ${DESCRIBE_MAX}`);
  }
  for (const lm of staging.landmarks ?? []) if (!UNIONS.LandmarkId.has(lm)) err(node.id, `landmark "${lm}" is not a LandmarkId`);

  const authored = node.options.map((o) => o.id);
  const staged = Object.keys(staging.options ?? {});
  for (const id of authored) if (!staged.includes(id)) err(node.id, `option "${id}" is not staged`);
  for (const id of staged) if (!authored.includes(id)) err(node.id, `staged option "${id}" does not exist (authored: ${authored.join(", ")})`);

  for (const option of node.options) {
    const s = staging.options?.[option.id];
    if (!s) continue;
    options++;
    const where = `${node.id}/${option.id}`;
    for (const key of Object.keys(s)) if (!OPTION_FIELDS.has(key)) err(where, `unknown OptionStaging key "${key}"`);
    if (!Array.isArray(s.occupants) || s.occupants.length === 0) err(where, "occupants must be a non-empty array");
    if (s.destination !== undefined && !UNIONS.LandmarkId.has(s.destination)) err(where, `destination "${s.destination}" is not a LandmarkId`);
    if (typeof s.sign !== "string" || !s.sign.trim()) err(where, "sign is required");
    else {
      if (s.sign !== s.sign.toUpperCase()) err(where, `sign "${s.sign}" must be uppercase`);
      if (s.sign.length > SIGN_MAX) err(where, `sign "${s.sign}" is ${s.sign.length} > ${SIGN_MAX} characters`);
      if (s.sign !== s.sign.trim() || /\s{2,}/.test(s.sign)) err(where, "sign has stray whitespace");
    }
    if (s.beat === undefined) err(where, "beat must be explicit (the renderer treats a missing beat as a strike)");
    else if (!UNIONS.Beat.has(s.beat)) err(where, `beat "${s.beat}" is not a Beat`);

    const list = Array.isArray(s.occupants) ? s.occupants : [];
    list.forEach((occ, i) => {
      occupants++;
      if (occ?.kind === "people") people += occ.count ?? 0;
      checkOccupant(`${where}#${i}`, occ, node.stage);
    });

    // Renderer semantics.
    const onRail = ON_RAIL.has(s.beat);
    const living = list.filter((o) => o.kind === "people" || o.kind === "animal");
    const railPeople = onRail ? list.filter((o) => o.kind === "people").reduce((sum, o) => sum + o.count, 0) : 0;
    const deaths = certainDeaths(node, option);
    if (onRail && living.length && !(list[0].kind === "people" || list[0].kind === "animal"))
      err(where, "on-rail branch with living occupants must lead with them (the glass marks at the first stake)");
    if (node.stage === 1 && onRail && living.length) err(where, "stage 1 strikes nobody: people/animals only beside the line");
    if (onRail && list.some((o) => o.kind === "animal")) err(where, "animals on an on-rail beat would be struck");
    if (railPeople !== deaths.count) {
      const exempt = OFF_RAIL_DEATHS[where];
      if (railPeople === 0 && exempt) warn(where, `${deaths.count} certain death(s) not on the rail: ${exempt}`);
      else err(where, `${railPeople} people on the rail but ${deaths.count} certain death(s) from ${deaths.source}`);
    }
    if (node.rail) {
      const index = node.options.findIndex((o) => o.id === option.id);
      const figures = node.scene.figures[index === 0 ? "left" : "right"];
      if (railPeople !== figures) err(where, `rail node: ${railPeople} on the rail but scene.figures says ${figures}`);
    }
  }
}

// ------------------------------------------------------------ report

const grammar = {};
for (const id of byId.keys()) {
  const g = GRAMMAR_1_2[id];
  if (g) grammar[g] = (grammar[g] ?? 0) + 1;
}
const beats = {};
for (const node of nodes) for (const o of Object.values(STAGING_1_2[node.id]?.options ?? {})) beats[o.beat] = (beats[o.beat] ?? 0) + 1;

console.log(`staging-check 1-2: ${byId.size} nodes, ${options} options, ${occupants} occupants, ${people} people`);
console.log(`  grammar: ${Object.entries(grammar).sort().map(([k, v]) => `${k}=${v}`).join(" ")}`);
console.log(`  beats:   ${Object.entries(beats).sort().map(([k, v]) => `${k}=${v}`).join(" ")}`);
for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.error(`  ERROR ${e}`);
if (errors.length) {
  console.error(`FAILED: ${errors.length} error(s)`);
  process.exit(1);
}
console.log("OK");
