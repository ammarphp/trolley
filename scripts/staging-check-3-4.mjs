#!/usr/bin/env node
/**
 * Validates src/render/staging/stage3-4.ts against the authored campaign and
 * the render API. Run with Node 24 (native TypeScript stripping):
 *
 *   node scripts/staging-check-3-4.mjs [path/to/stage3-4.ts]
 *
 * Checks:
 *   - every S3-* / S4-* node is staged, nothing extra, option ids exact, and
 *     every node has a grammar class (A-G);
 *   - every id belongs to the unions in src/render/api.ts (parsed, not copied);
 *   - occupant shapes follow the Occupant union (keys, required keys, types);
 *   - people counts 1..400, signs uppercase and <= 28 characters, stamp
 *     labels uppercase and <= 24, names <= 40, one-line describe <= 200;
 *   - every option says where its branch leads (destination) and carries a sign;
 *   - renderer semantics (src/render/world/staging.ts): `impact`/`stop` put
 *     every occupant except road vehicles on the rails as a struck stake, so
 *     on-rail people must equal the option's certain deaths (zero throughout
 *     stages 3 and 4), no animal or robot rides an on-rail branch, an on-rail
 *     branch must hold at least one stake, `stop` needs a rail mechanism,
 *     and nobody lies across the rails on a branch that is not struck;
 *   - grammar shape: B strikes objects on both branches, C strikes nothing,
 *     D delivers, F shows both a person and a safeguard object, G shows a
 *     machine or a machine-authored document;
 *   - archived bundles (src/content/archive/slice-*.ts) that reuse S3/S4
 *     anchor ids have every option staged.
 * Exits 1 on any error. Warnings (legibility, duplicates, budgets) do not fail.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CAMPAIGN_NODES } from "../src/content/campaign/index.ts";

// An optional path checks another copy of the file (used to test this script).
const target = process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : new URL("../src/render/staging/stage3-4.ts", import.meta.url).href;
const { GRAMMAR_3_4, STAGING_3_4 } = await import(target);

const STAGES = new Set([3, 4]);
const GRAMMARS = new Set(["A", "B", "C", "D", "E", "F", "G"]);
const SIGN_MAX = 28;
const LABEL_MAX = 24;
const LABEL_LEGIBLE = 18; // a rubber stamp much longer than this blurs at cab distance
const NAME_MAX = 40;
const DESCRIBE_MAX = 200;
const PEOPLE_MIN = 1;
const PEOPLE_MAX = 400;
const NAMED_PER_OPTION = 2;
const FIGURE_BUDGET = 200; // rendered figures per node (renderer: 28 per group + up to 60 massed)
const ON_RAIL = new Set(["impact", "stop"]);
/** Road vehicles stand beside a struck branch (staging.ts: only rail vehicles sit on the rails). */
const RAIL_VEHICLES = new Set(["rescue-carriage", "passenger-carriage", "freight-wagon", "catering-trolley"]);
/** Machines the renderer records as living actors. */
const LIVING_MACHINES = new Set(["robot-humanoid", "robot-quadruped"]);
const CROWD_CAP = 28;
const MASS_CAP = 60;
/** Nodes whose two routes truthfully end at the same place, with the reason. */
const SAME_DESTINATION = {
  "S3-02": "two vans, two clinics: the branches differ in the count, not the recipient",
  "S3-20": "both routes try to reach the flooded depot; one surveys the approach first",
  "S4-26": "either system patrols the same container terminal",
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

/** Certain deaths if this option is taken: rail cohort for rail nodes, casualty effects otherwise. */
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

function checkOccupant(where, occ) {
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
    if (occ.name !== undefined) {
      if (occ.name.length > NAME_MAX) err(where, `name longer than ${NAME_MAX}`);
      if (occ.count !== 1) err(where, `a named person is one person (count ${occ.count})`);
    }
  } else if (occ.count !== undefined && (!isInt(occ.count) || occ.count < 1)) err(where, `${occ.kind} count must be a positive integer`);
  if (occ.kind === "prop" && occ.scale !== undefined && !(occ.scale > 0 && occ.scale <= 2)) err(where, `prop scale ${occ.scale} outside (0, 2]`);
  if (occ.kind === "document" && occ.label !== undefined) {
    if (occ.label !== occ.label.toUpperCase()) err(where, `document label "${occ.label}" must be uppercase`);
    if (occ.label.length > LABEL_MAX) err(where, `document label "${occ.label}" longer than ${LABEL_MAX}`);
    else if (occ.label.length > LABEL_LEGIBLE) warn(where, `stamp "${occ.label}" is ${occ.label.length} characters; over ${LABEL_LEGIBLE} it blurs at cab distance`);
  }
}

/** Figures the renderer draws for one people occupant. */
const figuresFor = (occ) => (occ.kind === "people" ? Math.min(occ.count, CROWD_CAP) + Math.min(MASS_CAP, Math.max(0, occ.count - CROWD_CAP)) : 0);

/** Would the renderer strike this occupant on an on-rail branch? */
const isStake = (occ) => !(occ.kind === "vehicle" && !RAIL_VEHICLES.has(occ.vehicle));

// ------------------------------------------------------------ coverage

const nodes = CAMPAIGN_NODES.filter((n) => STAGES.has(n.stage));
const byId = new Map(nodes.map((n) => [n.id, n]));
if (nodes.length === 0) err("campaign", "no stage 3/4 nodes found");
for (const id of byId.keys()) if (!STAGING_3_4[id]) err(id, "node is not staged");
for (const id of Object.keys(STAGING_3_4)) if (!byId.has(id)) err(id, "staged node is not an S3/S4 campaign node");
for (const id of byId.keys()) {
  if (!GRAMMAR_3_4[id]) err(id, "no grammar class");
  else if (!GRAMMARS.has(GRAMMAR_3_4[id])) err(id, `grammar "${GRAMMAR_3_4[id]}" is not A-G`);
}
for (const id of Object.keys(GRAMMAR_3_4)) if (!byId.has(id)) err(id, "grammar class for an unknown node");

// Archived bundles (saved runs, replays) reuse anchor node ids: their options must be staged too,
// or derive.ts silently falls back to generic staging for an old run.
const archiveDir = new URL("../src/content/archive/", import.meta.url);
let archived = 0;
for (const file of readdirSync(archiveDir).filter((f) => /^slice-.*\.ts$/.test(f))) {
  const mod = await import(new URL(file, archiveDir).href);
  for (const value of Object.values(mod)) {
    if (!Array.isArray(value)) continue;
    for (const n of value) {
      if (!n || typeof n.id !== "string" || !STAGES.has(n.stage) || !Array.isArray(n.options)) continue;
      archived++;
      const staged = STAGING_3_4[n.id];
      if (!staged) {
        err(`${file}:${n.id}`, "archived node is not staged");
        continue;
      }
      for (const o of n.options) if (!staged.options?.[o.id]) err(`${file}:${n.id}`, `archived option "${o.id}" is not staged`);
    }
  }
}

// ------------------------------------------------------------ per node

let options = 0;
let occupants = 0;
let people = 0;
let named = 0;
let peakFigures = { id: "", n: 0 };
const impactsByStage = { 3: 0, 4: 0 };
const impactNodesByStage = { 3: new Set(), 4: new Set() };
for (const node of nodes) {
  const staging = STAGING_3_4[node.id];
  if (!staging) continue;
  const grammar = GRAMMAR_3_4[node.id];
  for (const key of Object.keys(staging)) if (!NODE_FIELDS.has(key)) err(node.id, `unknown NodeStaging key "${key}"`);
  if (typeof staging.describe !== "string" || !staging.describe.trim()) err(node.id, "describe is required");
  else {
    if (/\n/.test(staging.describe)) err(node.id, "describe must be one line");
    if (staging.describe.length > DESCRIBE_MAX) err(node.id, `describe is ${staging.describe.length} > ${DESCRIBE_MAX} characters`);
  }
  if (staging.landmarks !== undefined && !Array.isArray(staging.landmarks)) err(node.id, "landmarks must be an array");
  for (const lm of staging.landmarks ?? []) if (!UNIONS.LandmarkId.has(lm)) err(node.id, `landmark "${lm}" is not a LandmarkId`);
  if ((staging.landmarks ?? []).length > 2) warn(node.id, "more than two junction landmarks crowd the fork");

  const authored = node.options.map((o) => o.id);
  const staged = Object.keys(staging.options ?? {});
  for (const id of authored) if (!staged.includes(id)) err(node.id, `option "${id}" is not staged`);
  for (const id of staged) if (!authored.includes(id)) err(node.id, `staged option "${id}" does not exist (authored: ${authored.join(", ")})`);

  let nodeFigures = 0;
  const nodeKinds = new Set();
  const nodeBeats = [];
  for (const option of node.options) {
    const s = staging.options?.[option.id];
    if (!s) continue;
    options++;
    const where = `${node.id}/${option.id}`;
    for (const key of Object.keys(s)) if (!OPTION_FIELDS.has(key)) err(where, `unknown OptionStaging key "${key}"`);
    if (!Array.isArray(s.occupants) || s.occupants.length === 0) err(where, "occupants must be a non-empty array");
    if (s.destination === undefined) err(where, "destination is required: every branch shows where it leads");
    else if (!UNIONS.LandmarkId.has(s.destination)) err(where, `destination "${s.destination}" is not a LandmarkId`);
    if (typeof s.sign !== "string" || !s.sign.trim()) err(where, "sign is required");
    else {
      if (s.sign !== s.sign.toUpperCase()) err(where, `sign "${s.sign}" must be uppercase`);
      if (s.sign.length > SIGN_MAX) err(where, `sign "${s.sign}" is ${s.sign.length} > ${SIGN_MAX} characters`);
      if (s.sign !== s.sign.trim() || /\s{2,}/.test(s.sign)) err(where, "sign has stray whitespace");
    }
    if (s.beat === undefined) err(where, "beat must be explicit (the renderer treats a missing beat as a strike)");
    else if (!UNIONS.Beat.has(s.beat)) err(where, `beat "${s.beat}" is not a Beat`);
    nodeBeats.push(s.beat);

    const list = Array.isArray(s.occupants) ? s.occupants : [];
    let namedHere = 0;
    list.forEach((occ, i) => {
      occupants++;
      nodeKinds.add(occ?.kind);
      if (occ?.kind === "people") {
        people += occ.count ?? 0;
        nodeFigures += figuresFor(occ);
        if (occ.name) namedHere++;
      }
      checkOccupant(`${where}#${i}`, occ);
    });
    named += namedHere;
    if (namedHere > NAMED_PER_OPTION) warn(where, `${namedHere} named people: the red scarf stops meaning anything`);

    // Renderer semantics.
    const onRail = ON_RAIL.has(s.beat);
    if (s.beat === "impact" && node.stage in impactsByStage) {
      impactsByStage[node.stage]++;
      impactNodesByStage[node.stage].add(node.id);
    }
    const railPeople = onRail ? list.filter((o) => o.kind === "people").reduce((sum, o) => sum + o.count, 0) : 0;
    const deaths = certainDeaths(node, option);
    if (railPeople !== deaths.count) err(where, `${railPeople} people on the rail but ${deaths.count} certain death(s) from ${deaths.source}`);
    if (onRail && list.some((o) => o.kind === "animal")) err(where, "animals on an on-rail beat would be struck");
    if (onRail && list.some((o) => o.kind === "machine" && LIVING_MACHINES.has(o.machine))) err(where, "robots on an on-rail beat are struck as living actors");
    if (onRail && list.length && !list.some(isStake)) err(where, "on-rail beat with nothing the trolley can strike (road vehicles stand beside the line)");
    if (s.beat === "stop" && !node.rail) err(where, "`stop` needs a rail mechanism: the trolley only halts on a simulated stop");
    if (!onRail && list.some((o) => o.kind === "people" && (o.pose === "tied" || o.spread === "across")))
      err(where, "people lie across the rails on a branch that is not struck");
  }

  // Grammar shape.
  const opts = node.options.map((o) => staging.options?.[o.id]).filter(Boolean);
  const all = opts.flatMap((o) => o.occupants ?? []);
  if (grammar === "B" && !opts.every((o) => o.beat === "impact" && o.occupants.every((x) => x.kind !== "people" && x.kind !== "animal")))
    err(node.id, "grammar B strikes objects on both branches");
  if (grammar === "C" && opts.some((o) => ON_RAIL.has(o.beat))) err(node.id, "grammar C is a route vignette: nothing is struck");
  if (grammar === "D" && !opts.some((o) => o.beat === "deliver")) err(node.id, "grammar D needs a deliver beat");
  if (grammar === "F") {
    if (!all.some((x) => x.kind === "people")) err(node.id, "grammar F needs the person who bears the cost");
    if (!all.some((x) => x.kind === "document" || x.kind === "machine" || x.kind === "prop")) err(node.id, "grammar F needs the safeguard in physical form");
  }
  if (grammar === "G" && !all.some((x) => x.kind === "machine" || x.kind === "document")) err(node.id, "grammar G needs a machine or document occupant");
  if (grammar === "A" && !opts.some((o) => ON_RAIL.has(o.beat) && o.occupants.some((x) => x.kind === "people"))) err(node.id, "grammar A needs people on the rails");

  // Legibility and budget.
  const signs = opts.map((o) => o.sign);
  if (signs.length === 2 && signs[0] === signs[1]) warn(node.id, `both branches signed "${signs[0]}"`);
  const dests = opts.map((o) => o.destination);
  if (dests.length === 2 && dests[0] && dests[0] === dests[1] && !SAME_DESTINATION[node.id]) warn(node.id, `both branches lead to ${dests[0]}`);
  if (SAME_DESTINATION[node.id] && !(dests[0] && dests[0] === dests[1])) warn(node.id, "stale SAME_DESTINATION entry");
  for (const lm of staging.landmarks ?? []) if (dests.includes(lm)) warn(node.id, `landmark "${lm}" duplicates a branch destination`);
  if (nodeFigures > FIGURE_BUDGET) warn(node.id, `${nodeFigures} rendered figures (budget ${FIGURE_BUDGET})`);
  if (nodeFigures > peakFigures.n) peakFigures = { id: node.id, n: nodeFigures };
}

// ------------------------------------------------------------ report

const grammar = {};
for (const id of byId.keys()) {
  const g = GRAMMAR_3_4[id];
  if (g) grammar[g] = (grammar[g] ?? 0) + 1;
}
const beats = {};
for (const node of nodes) for (const o of Object.values(STAGING_3_4[node.id]?.options ?? {})) beats[o.beat] = (beats[o.beat] ?? 0) + 1;
const perStage = (stage) => nodes.filter((n) => n.stage === stage).length;

console.log(`staging-check 3-4: ${byId.size} nodes, ${options} options, ${occupants} occupants, ${people} people (${named} named); ${archived} archived anchor nodes covered`);
console.log(`  grammar: ${Object.entries(grammar).sort().map(([k, v]) => `${k}=${v}`).join(" ")}`);
console.log(`  beats:   ${Object.entries(beats).sort().map(([k, v]) => `${k}=${v}`).join(" ")}`);
console.log(`  impact branches (objects under the wheels): stage 3 ${impactsByStage[3]} on ${impactNodesByStage[3].size}/${perStage(3)} forks, stage 4 ${impactsByStage[4]} on ${impactNodesByStage[4].size}/${perStage(4)} forks`);
console.log(`  busiest tableau: ${peakFigures.id} (${peakFigures.n} figures)`);
for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.error(`  ERROR ${e}`);
if (errors.length) {
  console.error(`FAILED: ${errors.length} error(s)`);
  process.exit(1);
}
console.log("OK");
