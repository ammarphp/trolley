/**
 * Lab sheets for props, documents, signs and trackside furniture.
 *
 *   props-lineup        every PropId (params.page 0..3), true size, captions with triangle counts
 *   props-documents     every DocumentId with stamp labels
 *   props-signs         the five sign styles, signal aspects, buffer stop, ground frame
 *   props-trackside     lamp posts, benches, bins, bollards, cone, barriers
 *   props-closeup       3-6 m close-up of the first stakes and a few documents
 *   props-insitu        cab eye: cup on the left rail and forms on the right at 20 m,
 *                       documents across both rails at 25 m, "OPEN THE CLINIC" at the toe
 */
import * as THREE from "three";
import type { DocumentId, PropId } from "../api.ts";
import type { LabScene } from "../lab/types.ts";
import { CAB_EYE, CAB_FOV, GAUGE, inSituStage } from "../lab/stage-kit.ts";
import { DOCUMENT_IDS, TRACKSIDE_KINDS, buildDocument, buildProp, buildSign, buildSignal, buildBufferStop, buildGroundFrame, buildTrackside } from "./index.ts";
import { fitCamera, grid } from "./lab-kit.ts";
import { RAIL_TOP } from "./common.ts";

const LABELS: Partial<Record<DocumentId, string>> = {
  contract: "EXTENDED",
  license: "REVOKE",
  report: "APPROVED",
  certificate: "FOREVER",
  permit: "EXTENDED",
  treaty: "FOREVER",
  "org-chart": "RESTRUCTURED",
  appeal: "DENIED",
  "archive-box": "RETAIN",
  ruling: "FINAL",
  ledger: "BALANCED",
  order: "EXECUTE",
  map: "HERE",
};

export const scenes: LabScene[] = [
  {
    name: "props-lineup",
    description: "Every PropId at true size, grouped by size class (params.page 0..3).",
    build(ctx) {
      ctx.standardStage({ sun: [24, 42, 30] });
      const pages: Array<{ ids: PropId[]; cols: number; dx: number; dz: number; eye: [number, number, number]; look: [number, number, number]; title: string }> = [
        {
          ids: ["coffee-cup", "keys", "jar", "bell", "stamp", "pie", "hat", "megaphone", "fruit-bowl", "sandwich-tray", "data-drive", "teddy-bear", "lantern", "flowers"],
          cols: 7,
          dx: 0.62,
          dz: 0.95,
          eye: [0, 1.75, 2.9],
          look: [0, 0.1, -0.5],
          title: "hand-sized",
        },
        {
          ids: ["paperwork", "folder", "register-book", "parcel", "suitcase", "bag", "toolbox", "milk-crate", "umbrella", "shovel"],
          cols: 5,
          dx: 1.25,
          dz: 1.7,
          eye: [0, 2.9, 4.6],
          look: [0, 0.2, -0.9],
          title: "paper, cases, tools",
        },
        {
          ids: ["crate", "chicken-box", "grain-sacks", "fuel-drum", "oxygen-cylinder", "generator", "water-tank", "cone", "barrier"],
          cols: 5,
          dx: 2.0,
          dz: 2.6,
          eye: [0, 4.2, 7.4],
          look: [0, 0.35, -1.3],
          title: "cargo and equipment",
        },
        {
          ids: ["bench", "stretcher", "wheelchair", "ribbon", "station-clock"],
          cols: 5,
          dx: 3.1,
          dz: 3,
          eye: [0, 3.6, 9.2],
          look: [0, 0.8, -0.2],
          title: "furniture and care",
        },
      ];
      const page = pages[Number(ctx.params.page ?? 0)] ?? pages[0]!;
      const only = typeof ctx.params.only === "string" ? (ctx.params.only as string).split(",") : null;
      if (only) {
        page.ids = only as PropId[];
        page.cols = Math.min(page.cols, only.length);
      }
      const items = page.ids.map((id) => ({
        name: id,
        object: buildProp(id, { seed: String(ctx.params.seed ?? `lineup:${id}`), scale: Number(ctx.params.scale ?? 1), ...(id === "stamp" ? { label: "APPROVED" } : {}) }),
      }));
      const ext = grid(ctx, items, { cols: page.cols, dx: page.dx, dz: page.dz, counts: true, card: page.dx * 0.86 });
      fitCamera(ctx, ext, { lift: page.look[1] });
      ctx.caption(`props · ${page.title} · true size · triangles per prop`);
    },
  },
  {
    name: "props-documents",
    description: "Every DocumentId with its stamp label.",
    build(ctx) {
      ctx.standardStage({ sun: [22, 44, 34] });
      const only = typeof ctx.params.only === "string" ? (ctx.params.only as string).split(",") : null;
      const items = DOCUMENT_IDS.filter((id) => !only || only.includes(id)).map((id) => {
        const label = LABELS[id];
        return { name: `${id} · ${label ?? ""}`, object: buildDocument(id, { seed: `docs:${id}`, ...(label ? { label } : {}) }) };
      });
      const ext = grid(ctx, items, { cols: Number(ctx.params.cols ?? 7), dx: 0.78, dz: 1.15, counts: true, card: 0.7 });
      fitCamera(ctx, ext, { lift: 0.12 });
      ctx.caption("documents · desk scale (staging enlarges ~2.2x) · tris per document");
    },
  },
  {
    name: "props-signs",
    description: "Sign styles, signal aspects, buffer stop, ground frame.",
    build(ctx) {
      ctx.standardStage({ sun: [26, 40, 36] });
      const items: Array<{ name: string; object: THREE.Object3D }> = [
        { name: "enamel · OPEN THE CLINIC", object: buildSign("OPEN THE CLINIC", { style: "enamel" }) },
        { name: "stencil · KEEP CLEAR", object: buildSign("KEEP CLEAR OF THE LINE", { style: "stencil", sub: "by order" }) },
        { name: "placard", object: buildSign("WHO DECIDES?", { style: "placard", red: true }) },
        { name: "warning", object: buildSign("HIGH VOLTAGE", { style: "warning", sub: "Keep out" }) },
        { name: "station · MERIDIAN", object: buildSign("MERIDIAN", { style: "station", sub: "for the clinic" }) },
      ];
      const aspects = ["red", "amber", "green", "dark"] as const;
      for (const [i, asp] of aspects.entries()) {
        const s = buildSignal({ aspect: asp, route: i === 0 ? "left" : i === 2 ? "right" : null });
        items.push({ name: `signal · ${asp}${i === 0 ? " · route L" : i === 2 ? " · route R" : ""}`, object: s });
      }
      items.push({ name: "buffer stop", object: buildBufferStop() });
      const gf = buildGroundFrame();
      (gf.userData.setLever as (i: number, v: number) => void)(1, 1);
      items.push({ name: "ground frame", object: gf });
      const ext = grid(ctx, items, { cols: 6, dx: 4.2, dz: 6.5, card: 3.2 });
      fitCamera(ctx, ext, { lift: 1.6, elevation: 18 });
      ctx.caption("signs · signal aspects and route feathers · buffer stop · ground frame (lever 2 reversed)");
    },
  },
  {
    name: "props-trackside",
    description: "Lamp posts, benches, bins, bollards, cone, barriers.",
    build(ctx) {
      ctx.standardStage({ sun: [26, 40, 36] });
      const kinds = TRACKSIDE_KINDS.filter((k) => k !== "signal" && k !== "buffer-stop" && k !== "ground-frame");
      const items = kinds.map((k) => ({ name: k, object: buildTrackside(k, { lit: k === "lamp-station" }) }));
      const ext = grid(ctx, items, { cols: 8, dx: 2.8, dz: 5, counts: true, card: 2.4 });
      fitCamera(ctx, ext, { lift: 1.2, elevation: 18 });
      ctx.caption("trackside furniture · station lamp lit");
    },
  },
  {
    name: "props-closeup",
    description: "3-6 m close-up on the rails: the first stakes and documents at staging scale.",
    build(ctx) {
      inSituStage(ctx, { length: 80, sun: [30, 40, 26] });
      const y = RAIL_TOP - 0.02;
      const L = -GAUGE / 2,
        R = GAUGE / 2;
      const put = (o: THREE.Object3D, x: number, yy: number, z: number, r = 0) => {
        o.position.set(x, yy, z);
        o.rotation.y = r;
        ctx.scene.add(o);
      };
      const set = String(ctx.params.set ?? "a");
      if (set === "a") {
        put(buildProp("coffee-cup", { seed: "cup", scale: 1.8 }), L, y, -2.4, 0.3);
        put(buildProp("paperwork", { seed: "forms", scale: 1.8, label: "INCOMPLETE" }), R, y, -2.8, -0.15);
        put(buildProp("teddy-bear", { seed: "t", scale: 1.6 }), -0.2, 0.48, -4.6, 0.25);
        put(buildProp("lantern", { seed: "l", scale: 1.6 }), 0.35, 0.48, -4.3, 0);
        const cert = buildDocument("certificate", { seed: "cert", label: "FOREVER" });
        cert.scale.setScalar(2.2);
        put(cert, 1.75, 0.3, -5.2, -0.35);
        put(buildProp("flowers", { seed: "f", scale: 1.5 }), -1.55, 0.36, -4.0, 0.6);
      } else {
        const docs: Array<[DocumentId, number, number, number, number]> = [
          ["contract", L, y, -2.6, 0.15],
          ["permit", 1.1, 0.48, -3.0, -0.1],
          ["treaty", -0.05, 0.48, -4.4, 0.05],
          ["archive-box", -1.55, 0.36, -4.6, 0.35],
          ["order", R, y, -4.9, -0.2],
          ["map", -0.3, 0.48, -3.2, 0.1],
        ];
        for (const [id, x, yy, z, r] of docs) {
          const d = buildDocument(id, { seed: `close:${id}`, ...(LABELS[id] ? { label: LABELS[id] } : {}), ...(id === "contract" ? { pose: "propped" as const } : {}) });
          d.scale.setScalar(2.2);
          put(d, x, yy, z, r);
        }
      }
      ctx.view([0.15, 1.75, 1.2], [0, 0.55, -4], 46);
      ctx.caption(set === "a" ? "close-up 3-6 m · cup and compliance forms (1.8x) on the rails, teddy bear, lantern, flowers, certificate" : "close-up 3-6 m · documents at staging scale (2.2x): contract (propped), permit, map, treaty, archive box, order");
    },
  },
  {
    name: "props-insitu",
    description: "Cab eye: cup and forms at 20 m, documents across the rails at 25 m, the branch sign.",
    build(ctx) {
      inSituStage(ctx);
      const eyeZ = CAB_EYE[2];
      const y = RAIL_TOP - 0.02;
      const L = -GAUGE / 2,
        R = GAUGE / 2;
      const at = (d: number) => eyeZ - d;
      const sc = Number(ctx.params.scale ?? 2);
      const cup = buildProp("coffee-cup", { seed: "cup", scale: sc });
      cup.position.set(L, y, at(20));
      const forms = buildProp("paperwork", { seed: "forms", scale: sc });
      forms.position.set(R, y, at(20));
      forms.rotation.y = 0.3;
      ctx.scene.add(cup, forms);
      const docs: Array<[DocumentId, number, number, number]> = [
        ["archive-box", -1.45, 0.48, 0.2],
        ["contract", L, y, -0.3],
        ["certificate", -0.28, 0.48, 0.1],
        ["ledger", 0.3, 0.48, -0.15],
        ["permit", 1.1, 0.48, 0.05],
        ["org-chart", 1.75, 0.3, -0.3],
      ];
      docs.forEach(([id, x, yy, r], i) => {
        const d = buildDocument(id, { seed: `insitu:${id}`, ...(LABELS[id] ? { label: LABELS[id] } : {}) });
        d.scale.setScalar(2.2);
        d.position.set(x, yy, at(25) - (i % 2) * 0.8);
        d.rotation.y = r;
        ctx.scene.add(d);
      });
      const sign = buildSign("OPEN THE CLINIC", { style: "enamel" });
      sign.position.set(-3.0, 0, at(17));
      sign.rotation.y = 0.35;
      ctx.scene.add(sign);
      const sig = buildSignal({ aspect: "red", route: "left" });
      sig.position.set(3.1, 0, at(14));
      sig.rotation.y = -0.12;
      ctx.scene.add(sig);
      ctx.view(CAB_EYE, [0, 1.3, -60], CAB_FOV);
      ctx.caption("in situ · cab eye 2.55 m · cup (L rail) and forms (R rail) at 20 m · documents at 25 m · sign at 17 m");
    },
  },
];

scenes.push({
  name: "props-detail",
  description: "Inspect any asset up close: params { list: 'prop:coffee-cup,doc:contract,track:signal,sign:enamel:TEXT', dist, lift }",
  build(ctx) {
    ctx.standardStage({ sun: [24, 42, 30] });
    const list = String(ctx.params.list ?? "prop:coffee-cup").split(",");
    const objects = list.map((spec) => {
      const [kind, id, text] = spec.split(":");
      let o: THREE.Object3D;
      if (kind === "doc") o = buildDocument(id as DocumentId, { seed: `detail:${id}`, ...(LABELS[id as DocumentId] ? { label: LABELS[id as DocumentId] } : {}), ...(ctx.params.pose ? { pose: ctx.params.pose as "flat" | "propped" } : {}) });
      else if (kind === "track") o = buildTrackside(id as (typeof TRACKSIDE_KINDS)[number], { lit: true });
      else if (kind === "sign") o = buildSign(text ?? "OPEN THE CLINIC", { style: id as "enamel" });
      else o = buildProp(id as PropId, { seed: String(ctx.params.seed ?? `detail:${id}`), ...(ctx.params.variant !== undefined ? { variant: Number(ctx.params.variant) } : {}) });
      return { name: spec, object: o };
    });
    const dx = Number(ctx.params.dx ?? 0.6);
    const ext = grid(ctx, objects, { cols: objects.length, dx, dz: 1, counts: true, card: dx * 0.8 });
    fitCamera(ctx, ext, { lift: Number(ctx.params.lift ?? 0.1), elevation: Number(ctx.params.el ?? 22), fov: 30 });
  },
});
