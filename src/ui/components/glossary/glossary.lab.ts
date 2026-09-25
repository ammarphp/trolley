/**
 * Lab sheets for the glossary card, highlighted terms and dilemma history,
 * drawn over a real ink backdrop so the glass is judged against line art.
 *
 *   node scripts/lab-shot.mjs glossary-popover --file src/ui/components/glossary/glossary.lab.ts --out x.png --w 1440 --h 900 --t 0.5
 *
 * Scenes: glossary-popover, glossary-readmore, glossary-history,
 * glossary-phone (--w 390 --h 844), glossary-phone-history (--w 390 --h 844),
 * glossary-index.
 */
import "../../theme.css";
import "./glossary.css";
import * as THREE from "three";
import type { LabContext, LabScene } from "../../../render/lab/types.ts";
import { inSituStage } from "../../../render/lab/stage-kit.ts";
import {
  Kit,
  block,
  gable,
  cylinder,
  sphere,
  jitter,
} from "../../../render/core/geometry.ts";
import { inkMaterial } from "../../../render/core/ink-material.ts";
import {
  annotate,
  historyCardFor,
  mountGlossary,
  renderGlossaryIndex,
  renderHistoryCard,
  type GlossaryPopoverController,
} from "./index.ts";

/* --------------------------------------------------------------- backdrop */

function house(): THREE.Mesh {
  const k = new Kit();
  k.add(block(6, 3.2, 5), { tone: "paper" });
  k.add(gable(6, 5, 2.4, 0.35), {
    tone: "mid",
    position: [0, 3.2, 0],
    rotation: [0, Math.PI / 2, 0],
  });
  k.add(block(0.9, 1.9, 0.12), { tone: "dark", position: [0.8, 0, 2.52] });
  for (const x of [-1.8, 2.2])
    k.add(block(1, 1.1, 0.1), { tone: "deep", position: [x, 1.3, 2.52] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true }));
}
function tree(): THREE.Mesh {
  const k = new Kit();
  k.add(cylinder(0.14, 0.26, 3.2, 8), { tone: "dark", position: [0, 1.6, 0] });
  for (const [x, y, z, r] of [
    [0, 4.2, 0, 1.6],
    [0.9, 3.7, 0.3, 1.1],
    [-0.8, 3.8, -0.2, 1.2],
    [0.2, 5.1, -0.3, 1.0],
  ] as const)
    k.add(jitter(sphere(r, 12, 9), r * 0.12, x + y), {
      tone: "light",
      position: [x, y, z],
    });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true }));
}
function pylon(): THREE.Mesh {
  const k = new Kit();
  k.add(cylinder(0.12, 0.18, 9, 6), { tone: "dark", position: [0, 4.5, 0] });
  k.add(block(3.2, 0.18, 0.18), { tone: "dark", position: [0, 8.2, 0] });
  k.add(block(2.2, 0.14, 0.14), { tone: "dark", position: [0, 7.2, 0] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true }));
}
function backdrop(ctx: LabContext) {
  inSituStage(ctx);
  const spots: Array<[() => THREE.Mesh, number, number, number, number?]> = [
    [house, -13, -34, 0.5],
    [house, -24, -70, 0.2, 1.3],
    [house, 16, -46, -0.4],
    [house, 30, -96, -0.2, 1.6],
    [tree, -7, -20, 0],
    [tree, -9.5, -26, 0, 1.2],
    [tree, 7.5, -22, 0, 1.1],
    [tree, 11, -32, 0],
    [tree, 9, -14, 0, 0.9],
    [tree, -18, -48, 0, 1.4],
    [tree, 22, -70, 0, 1.6],
    [pylon, -5, -16, 0],
    [pylon, -5, -46, 0],
    [pylon, -5, -76, 0],
    [pylon, 5, -30, 0],
    [pylon, 5, -60, 0],
  ];
  for (const [make, x, z, r, s] of spots) {
    const m = make();
    m.position.set(x, 0, z);
    m.rotation.y = r;
    if (s) m.scale.setScalar(s);
    ctx.scene.add(m);
  }
}

/* ---------------------------------------------------------------- frames */

const S4_03 = {
  id: "S4-03",
  kicker: "Stage 4 · S4-03 · Infrastructure authorizer",
  title: "Better answers, no transcript",
  prompt:
    "Vela's new build thinks in loops before it speaks. Give it more turns and it clears problems that stumped the maths group for months: the reservoir schedule, the coil geometry, done before lunch. Priya from audit stands in your doorway with the printouts. 'The answers check out. I can't tell you how it got there. There's no transcript of the loops, only what it chose to write afterwards.' The lab director is on line two, wanting a standing order so nobody has to wait for your pen. Do you sign once, or once per experiment?",
  options: [
    "Sign the standing order. Let the experiments run.",
    "Approve each experiment yourself. Keep audit in the loop.",
  ],
};

function stage(ctx: LabContext, options: { backdrop?: boolean } = {}) {
  const still = document.createElement("style");
  still.textContent = `
    .glp, .glp *, .ghc, .ghc *, .term { transition: none !important; animation: none !important; }
    /* The game's global button rule, so the overrides are exercised. */
    button { min-height: 44px; padding: 10px 14px; border: 0; background: none; cursor: pointer; }
    button:hover { color: #616161; }
    .lab-panel { position: absolute; box-sizing: border-box; background: var(--glass); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border: 1px solid var(--hairline); border-radius: var(--r-4); box-shadow: var(--shadow-2); color: var(--ink); font-family: var(--font-sans); }
    .lab-kicker { margin: 0 0 10px; font: 500 10.5px/1.2 var(--font-mono); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); }
    .lab-title { margin: 0 0 12px; font: 600 var(--step-3)/1.12 var(--font-sans); letter-spacing: -.022em; }
    .lab-prompt { margin: 0; font: 400 var(--step-1)/1.58 var(--font-sans); color: var(--ink); text-wrap: pretty; }
    .lab-options { display: grid; gap: 8px; margin-top: 18px; }
    .lab-option { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; min-height: 52px; padding: 12px 14px; border: 1px solid var(--hairline-strong); border-radius: var(--r-2); background: rgba(255,255,255,.7); font: 500 var(--step-0)/1.35 var(--font-sans); color: var(--ink); }
    .lab-option kbd { flex: none; display: inline-grid; place-items: center; width: 22px; height: 22px; border: 1px solid var(--hairline-strong); border-radius: 5px; font: 500 11px/1 var(--font-mono); color: var(--ink-2); }
    .lab-foot { display: flex; justify-content: space-between; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--hairline); font: 500 10.5px/1.2 var(--font-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
    .lab-hud { position: absolute; left: 24px; top: 18px; font: 500 11px/1 var(--font-mono); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); }
    .lab-drawer-top { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 12px; border-bottom: 1px solid var(--hairline); }
    .lab-drawer-top h2 { margin: 0; font: 600 var(--step-1)/1.2 var(--font-sans); letter-spacing: -.01em; }
    .lab-drawer-top span { font: 500 10.5px/1 var(--font-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
    .lab-drawer-body { padding: 16px 18px 18px; overflow: auto; display: grid; gap: 12px; align-content: start; }
  `;
  document.head.append(still);
  const dom = ctx.domStage();
  dom.style.background = "transparent";
  dom.style.overflow = "hidden";
  if (options.backdrop !== false) backdrop(ctx);
  return dom;
}

function hud(dom: HTMLElement, text: string) {
  const label = document.createElement("div");
  label.className = "lab-hud";
  label.textContent = text;
  dom.append(label);
}

function decisionPanel(
  dom: HTMLElement,
  rect: {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
    width: number | string;
  },
) {
  const panel = document.createElement("section");
  panel.className = "lab-panel";
  panel.setAttribute("aria-label", "Decision");
  const pos = Object.entries(rect)
    .map(([k, v]) => `${k}:${typeof v === "number" ? `${v}px` : v}`)
    .join(";");
  panel.style.cssText = `${pos};padding:20px 22px 16px`;
  const kicker = document.createElement("p");
  kicker.className = "lab-kicker";
  kicker.textContent = S4_03.kicker;
  const title = document.createElement("h2");
  title.className = "lab-title";
  title.textContent = S4_03.title;
  const prompt = document.createElement("p");
  prompt.className = "lab-prompt";
  const seen = new Set<string>();
  prompt.append(annotate(S4_03.prompt, { seen }));
  const options = document.createElement("div");
  options.className = "lab-options";
  S4_03.options.forEach((label, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lab-option";
    const k = document.createElement("kbd");
    k.textContent = String(i + 1);
    b.append(k, document.createTextNode(label));
    options.append(b);
  });
  const foot = document.createElement("div");
  foot.className = "lab-foot";
  foot.innerHTML =
    "<span>Day 412 · 09:40</span><span>Details and history</span>";
  panel.append(kicker, title, prompt, options, foot);
  dom.append(panel);
  return panel;
}

async function settle() {
  await document.fonts?.ready;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
}

async function openOn(
  ctrl: GlossaryPopoverController,
  scope: HTMLElement,
  id: string,
) {
  await settle();
  const t = scope.querySelector<HTMLElement>(`button.term[data-term="${id}"]`);
  if (!t) throw new Error(`No annotated term ${id}`);
  ctrl.open(t, "api");
  await settle();
  ctrl.reposition();
  return t;
}

function drawer(dom: HTMLElement, rect: string, title: string, meta: string) {
  const panel = document.createElement("aside");
  panel.className = "lab-panel";
  panel.style.cssText = `${rect};display:flex;flex-direction:column;overflow:hidden`;
  const top = document.createElement("div");
  top.className = "lab-drawer-top";
  const h = document.createElement("h2");
  h.textContent = title;
  const s = document.createElement("span");
  s.textContent = meta;
  top.append(h, s);
  const body = document.createElement("div");
  body.className = "lab-drawer-body";
  panel.append(top, body);
  dom.append(panel);
  return body;
}

/* ----------------------------------------------------------------- scenes */

export const scenes: LabScene[] = [
  {
    name: "glossary-popover",
    description:
      "A stage-4 prompt with highlighted terms and an open glossary card.",
    async build(ctx) {
      const dom = stage(ctx);
      hud(dom, "Glossary · hover card over a stage-4 prompt");
      const panel = decisionPanel(dom, { right: 24, top: 64, width: 420 });
      const ctrl = mountGlossary({ root: dom });
      await openOn(ctrl, panel, "latent-reasoning");
    },
  },
  {
    name: "glossary-readmore",
    description:
      "The card expanded, reached from the keyboard, with related terms.",
    async build(ctx) {
      const dom = stage(ctx);
      hud(dom, "Glossary · read more, sources, related");
      const panel = decisionPanel(dom, { right: 24, top: 64, width: 420 });
      const ctrl = mountGlossary({ root: dom });
      await openOn(ctrl, panel, "chain-of-thought");
      ctrl.element.querySelector<HTMLButtonElement>(".glp-toggle")?.click();
      await settle();
      ctrl.reposition();
    },
  },
  {
    name: "glossary-history",
    description:
      "The history card for the canonical switch case in a details drawer.",
    async build(ctx) {
      const dom = stage(ctx);
      hud(dom, "History · S2-01, expanded, and S2-03 collapsed");
      const body = drawer(
        dom,
        "right:24px;top:64px;bottom:24px;width:384px",
        "Details and history",
        "S2-01",
      );
      const seen = new Set<string>();
      renderHistoryCard(body, historyCardFor("S2-01")!, {
        expanded: true,
        surface: "plain",
        seen,
      });
      const loop = renderHistoryCard(body, historyCardFor("S2-03")!, { seen });
      loop.element.style.marginTop = "6px";
      mountGlossary({ root: dom });
      await settle();
    },
  },
  {
    name: "glossary-history-collapsed",
    description: "Collapsed history cards: the drawer's at-a-glance state.",
    async build(ctx) {
      const dom = stage(ctx);
      hud(dom, "History · collapsed cards");
      const body = drawer(
        dom,
        "right:24px;top:64px;bottom:24px;width:384px",
        "Details and history",
        "4 cards",
      );
      for (const id of ["S2-01", "S2-13", "S4-03", "S1-11"])
        renderHistoryCard(body, historyCardFor(id)!, {});
      mountGlossary({ root: dom });
      await settle();
    },
  },
  {
    name: "glossary-history-open",
    description: "A glossary card opened from a term inside the history card.",
    async build(ctx) {
      const dom = stage(ctx);
      hud(dom, "History · term inside lineage");
      const body = drawer(
        dom,
        "right:24px;top:64px;bottom:24px;width:384px",
        "Details and history",
        "S2-03",
      );
      renderHistoryCard(body, historyCardFor("S2-03")!, {
        expanded: true,
        surface: "plain",
      });
      const ctrl = mountGlossary({ root: dom });
      await openOn(ctrl, body, "double-effect");
    },
  },
  {
    name: "glossary-phone",
    description: "Phone width: the decision as a full-width sheet, card open.",
    async build(ctx) {
      const dom = stage(ctx);
      const panel = decisionPanel(dom, {
        left: 0,
        right: 0,
        bottom: 0,
        width: "auto",
      });
      panel.style.borderRadius = "var(--r-4) var(--r-4) 0 0";
      panel.style.padding = "18px 16px 14px";
      const ctrl = mountGlossary({ root: dom });
      await openOn(ctrl, panel, "standing-order");
    },
  },
  {
    name: "glossary-phone-history",
    description: "Phone width: history card as a full-width sheet.",
    async build(ctx) {
      const dom = stage(ctx);
      const body = drawer(
        dom,
        "left:0;right:0;bottom:0;top:72px;border-radius:var(--r-4) var(--r-4) 0 0",
        "Details and history",
        "S2-01",
      );
      renderHistoryCard(
        body,
        historyCardFor(String(ctx.params.node ?? "S2-01"))!,
        { expanded: true, surface: "plain" },
      );
      mountGlossary({ root: dom });
      await settle();
      if (ctx.params.scroll) body.scrollTop = body.scrollHeight;
    },
  },
  {
    name: "glossary-interactive",
    description:
      "Nothing pre-opened: for driving hover, focus, Escape and tab order by hand or script.",
    async build(ctx) {
      const dom = stage(ctx);
      hud(dom, "Glossary · interactive");
      decisionPanel(dom, { right: 24, top: 64, width: 420 });
      const log: string[] = [];
      const ctrl = mountGlossary({
        root: dom,
        onOpen: (id, via) => log.push(`open:${id}:${via}`),
        onClose: (id) => log.push(`close:${id}`),
      });
      // A modal dialog with a term inside, as the app's details drawer is.
      const dialog = document.createElement("dialog");
      dialog.id = "lab-dialog";
      dialog.className = "lab-panel";
      dialog.style.cssText =
        "left:24px;top:64px;width:380px;margin:0;padding:18px";
      dom.append(dialog);
      renderHistoryCard(dialog, historyCardFor("S2-03")!, {
        expanded: true,
        surface: "plain",
      });
      const after = document.createElement("button");
      after.type = "button";
      after.id = "lab-after";
      after.textContent = "After the card";
      dialog.append(after);
      (window as unknown as { __glossary: unknown }).__glossary = { ctrl, log };
      await settle();
    },
  },
  {
    name: "glossary-index",
    description: "The whole glossary as a searchable list in a drawer.",
    async build(ctx) {
      const dom = stage(ctx);
      hud(dom, "Glossary index · search 'oversight'");
      const body = drawer(
        dom,
        "right:24px;top:64px;bottom:24px;width:384px",
        "Glossary",
        "80 terms",
      );
      const index = renderGlossaryIndex(body, { query: "" });
      index.setQuery(String(ctx.params.q ?? "oversight"));
      await settle();
    },
  },
];
