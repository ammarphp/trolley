#!/usr/bin/env node
/**
 * Validates src/render/staging/stage5-7.ts against the authored campaign and
 * the id unions in src/render/api.ts. Node 24 (native TypeScript stripping).
 *
 *   node scripts/staging-check-5-7.mjs          # exit 1 on any error
 *   node scripts/staging-check-5-7.mjs --quiet  # errors only
 *   node scripts/staging-check-5-7.mjs --file <module.ts>  # check another module
 *
 * Checks:
 *   - every S5-*, S6-*, S7-* node is staged, and nothing else is;
 *   - option keys exactly equal the node's semantic option ids;
 *   - every id (role, pose, species, vehicle, machine, prop, document,
 *     landmark, beat, spread) belongs to its api.ts union, parsed from source;
 *   - occupant shapes carry no unknown fields; counts are integers inside the
 *     renderer's caps, and people counts fall in 1..400;
 *   - each route has occupants, a destination, a beat and a sign of at most
 *     28 uppercase characters, and the two signs of a node differ;
 *   - document labels are uppercase and at most 16 characters (stamp width);
 *   - honesty: living occupants (people, animals, robots) stand on a struck
 *     route ("impact" or "stop") only when that option registers casualties;
 *   - each node has a describe line and a grammar class.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quiet = process.argv.includes("--quiet");
// `--file <path>` checks another module with the same exports (used to prove the checks fail).
const fileArg = process.argv.indexOf("--file");
const stagingPath = fileArg > 0 ? resolve(process.argv[fileArg + 1]) : resolve(root, "src/render/staging/stage5-7.ts");

const { CAMPAIGN_NODES } = await import(resolve(root, "src/content/campaign/index.ts"));
const { STAGING_5_7, GRAMMAR_5_7 } = await import(stagingPath);

// ------------------------------------------------------------ api.ts unions

const api = readFileSync(resolve(root, "src/render/api.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

function union(name) {
  const m = api.match(new RegExp(`export type ${name}\\s*=([\\s\\S]*?);`));
  if (!m) throw new Error(`api.ts: union ${name} not found`);
  const values = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  if (values.length === 0) throw new Error(`api.ts: union ${name} is empty`);
  return new Set(values);
}

const ROLES = union("PersonRole");
const POSES = union("Pose");
const ANIMALS = union("AnimalId");
const VEHICLES = union("VehicleId");
const MACHINES = union("MachineId");
const PROPS = union("PropId");
const DOCS = union("DocumentId");
const LANDMARKS = union("LandmarkId");
const BEATS = union("Beat");
const spreadMatch = api.match(/spread\?:\s*((?:"[^"]+"\s*\|?\s*)+)/);
if (!spreadMatch) throw new Error("api.ts: people spread union not found");
const SPREADS = new Set([...spreadMatch[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));

// Renderer caps (src/render/world/staging.ts): beyond these, extra instances are not drawn.
const CAPS = { prop: 8, document: 6, machine: 6, vehicle: 4, animal: 12 };
const FIELDS = {
  people: ["kind", "role", "count", "pose", "name", "spread"],
  prop: ["kind", "prop", "count", "scale"],
  animal: ["kind", "species", "count"],
  vehicle: ["kind", "vehicle", "count"],
  machine: ["kind", "machine", "count"],
  document: ["kind", "doc", "label", "count"],
};
const GRAMMARS = new Set(["A", "B", "C", "D", "E", "F", "G"]);
const LIVING_MACHINES = new Set(["robot-humanoid", "robot-quadruped"]);

// ------------------------------------------------------------------ checks

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;

function hasCasualties(option) {
  const effects = [
    ...option.effects,
    ...option.incidents.flatMap((i) => [...i.effects, ...i.otherwise]),
    ...option.delayed.flatMap((d) => d.effects ?? []),
  ];
  return effects.some((e) => e.kind === "casualties" && e.count > 0);
}

function checkOccupant(where, occ) {
  if (!occ || typeof occ !== "object") return fail(where, "occupant is not an object");
  const allowed = FIELDS[occ.kind];
  if (!allowed) return fail(where, `unknown occupant kind ${JSON.stringify(occ.kind)}`);
  for (const key of Object.keys(occ)) if (!allowed.includes(key)) fail(where, `unknown field "${key}" on ${occ.kind}`);
  switch (occ.kind) {
    case "people":
      if (!ROLES.has(occ.role)) fail(where, `unknown role ${JSON.stringify(occ.role)}`);
      if (!isInt(occ.count, 1, 400)) fail(where, `people count ${occ.count} outside 1..400`);
      if (occ.pose !== undefined && !POSES.has(occ.pose)) fail(where, `unknown pose ${JSON.stringify(occ.pose)}`);
      if (occ.spread !== undefined && !SPREADS.has(occ.spread)) fail(where, `unknown spread ${JSON.stringify(occ.spread)}`);
      if (occ.name !== undefined && (typeof occ.name !== "string" || occ.name.length === 0 || occ.name.length > 24)) fail(where, "name must be 1..24 characters");
      break;
    case "prop":
      if (!PROPS.has(occ.prop)) fail(where, `unknown prop ${JSON.stringify(occ.prop)}`);
      if (occ.count !== undefined && !isInt(occ.count, 1, CAPS.prop)) fail(where, `prop count ${occ.count} outside 1..${CAPS.prop}`);
      if (occ.scale !== undefined && !(typeof occ.scale === "number" && occ.scale > 0 && occ.scale <= 2)) fail(where, `prop scale ${occ.scale} outside (0, 2]`);
      break;
    case "animal":
      if (!ANIMALS.has(occ.species)) fail(where, `unknown species ${JSON.stringify(occ.species)}`);
      if (!isInt(occ.count, 1, CAPS.animal)) fail(where, `animal count ${occ.count} outside 1..${CAPS.animal}`);
      break;
    case "vehicle":
      if (!VEHICLES.has(occ.vehicle)) fail(where, `unknown vehicle ${JSON.stringify(occ.vehicle)}`);
      if (occ.count !== undefined && !isInt(occ.count, 1, CAPS.vehicle)) fail(where, `vehicle count ${occ.count} outside 1..${CAPS.vehicle}`);
      break;
    case "machine":
      if (!MACHINES.has(occ.machine)) fail(where, `unknown machine ${JSON.stringify(occ.machine)}`);
      if (occ.count !== undefined && !isInt(occ.count, 1, CAPS.machine)) fail(where, `machine count ${occ.count} outside 1..${CAPS.machine}`);
      break;
    case "document":
      if (!DOCS.has(occ.doc)) fail(where, `unknown document ${JSON.stringify(occ.doc)}`);
      if (occ.count !== undefined && !isInt(occ.count, 1, CAPS.document)) fail(where, `document count ${occ.count} outside 1..${CAPS.document}`);
      if (occ.label !== undefined) {
        if (typeof occ.label !== "string" || occ.label.length === 0 || occ.label.length > 16) fail(where, `label ${JSON.stringify(occ.label)} must be 1..16 characters`);
        else if (occ.label !== occ.label.toUpperCase()) fail(where, `label ${JSON.stringify(occ.label)} must be uppercase`);
      }
      break;
  }
}

const living = (occ) => occ.kind === "people" || occ.kind === "animal" || (occ.kind === "machine" && LIVING_MACHINES.has(occ.machine));

const range = CAMPAIGN_NODES.filter((n) => /^S[567]-/.test(n.id));
const rangeIds = new Set(range.map((n) => n.id));
for (const id of Object.keys(STAGING_5_7)) if (!rangeIds.has(id)) fail(id, "staged but not an S5-S7 campaign node");
for (const id of Object.keys(GRAMMAR_5_7)) if (!rangeIds.has(id)) fail(id, "grammar class for a node outside the range");

const tally = { grammar: {}, beat: {}, destination: {}, occupants: {}, people: 0, struckPeople: 0, docsOnRails: 0, options: 0 };
const bump = (bucket, key, n = 1) => (bucket[key] = (bucket[key] ?? 0) + n);

for (const node of range) {
  const staging = STAGING_5_7[node.id];
  if (!staging) {
    fail(node.id, "missing staging");
    continue;
  }
  for (const key of Object.keys(staging)) if (!["options", "landmarks", "describe"].includes(key)) fail(node.id, `unknown node field "${key}"`);
  if (typeof staging.describe !== "string" || staging.describe.trim().length < 20 || staging.describe.length > 240) fail(node.id, "describe must be a 20..240 character line");
  const grammar = GRAMMAR_5_7[node.id];
  if (!GRAMMARS.has(grammar)) fail(node.id, `grammar class ${JSON.stringify(grammar)} not in A..G`);
  else bump(tally.grammar, grammar);
  for (const lm of staging.landmarks ?? []) if (!LANDMARKS.has(lm)) fail(node.id, `unknown landmark ${JSON.stringify(lm)}`);

  const expected = node.options.map((o) => o.id).sort();
  const actual = Object.keys(staging.options ?? {}).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    fail(node.id, `option ids ${JSON.stringify(actual)} != content ${JSON.stringify(expected)}`);
  }
  const signs = [];
  for (const option of node.options) {
    const where = `${node.id}/${option.id}`;
    const route = staging.options?.[option.id];
    if (!route) continue;
    tally.options++;
    for (const key of Object.keys(route)) if (!["occupants", "destination", "sign", "beat"].includes(key)) fail(where, `unknown route field "${key}"`);
    if (!Array.isArray(route.occupants) || route.occupants.length === 0) fail(where, "no occupants");
    if (!LANDMARKS.has(route.destination)) fail(where, `destination ${JSON.stringify(route.destination)} is not a LandmarkId`);
    if (!BEATS.has(route.beat)) fail(where, `beat ${JSON.stringify(route.beat)} is not a Beat`);
    if (typeof route.sign !== "string" || route.sign.trim() !== route.sign || route.sign.length === 0) fail(where, "sign missing or padded");
    else {
      if (route.sign.length > 28) fail(where, `sign "${route.sign}" is ${route.sign.length} > 28 characters`);
      if (route.sign !== route.sign.toUpperCase()) fail(where, `sign "${route.sign}" is not uppercase`);
      signs.push(route.sign);
    }
    bump(tally.beat, route.beat);
    bump(tally.destination, route.destination);
    const struck = route.beat === "impact" || route.beat === "stop" || route.beat === undefined;
    for (const [i, occ] of (route.occupants ?? []).entries()) {
      checkOccupant(`${where}#${i}`, occ);
      bump(tally.occupants, occ.kind);
      if (occ.kind === "people") {
        tally.people += occ.count;
        if (struck) tally.struckPeople += occ.count;
      }
      if (occ.kind === "document" && struck) tally.docsOnRails++;
      if (struck && living(occ) && !hasCasualties(option)) {
        fail(`${where}#${i}`, `living ${occ.kind} on a struck route, but the option registers no casualties`);
      }
    }
  }
  if (signs.length === 2 && signs[0] === signs[1]) fail(node.id, "both routes carry the same sign");
}

// ------------------------------------------------------------------ report

const sorted = (o) => Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `${k} ${v}`).join(", ");
if (!quiet) {
  console.log(`nodes     ${Object.keys(STAGING_5_7).length} staged / ${range.length} in content, ${tally.options} routes`);
  console.log(`grammar   ${sorted(tally.grammar)}`);
  console.log(`beats     ${sorted(tally.beat)}`);
  console.log(`occupants ${sorted(tally.occupants)}`);
  console.log(`people    ${tally.people} figures staged, ${tally.struckPeople} on struck routes; ${tally.docsOnRails} documents on the rails`);
  console.log(`dest      ${sorted(tally.destination)}`);
}
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("staging-check-5-7: OK");
