/**
 * Lab sheets for Morrow's window, drawn over a real ink backdrop so the glass
 * is judged against busy line art.
 *
 *   node scripts/lab-shot.mjs morrow-intro --file src/ui/components/morrow/morrow.lab.ts --out x.png --w 1440 --h 900
 *
 * Scenes: morrow-intro, morrow-thinking, morrow-writing, morrow-reasoning,
 * morrow-coercive, morrow-revision, morrow-revised, morrow-minimized,
 * morrow-phone (use --w 390 --h 844), morrow-sheet (every state side by side).
 * Timers are driven by a manual clock so each state is frozen exactly.
 */
import "../../theme.css";
import "./morrow.css";
import * as THREE from "three";
import type { LabContext, LabScene } from "../../../render/lab/types.ts";
import { inSituStage } from "../../../render/lab/stage-kit.ts";
import { Kit, block, gable, cylinder, sphere, jitter } from "../../../render/core/geometry.ts";
import { inkMaterial } from "../../../render/core/ink-material.ts";
import { renderMorrow, type MorrowReply, type MorrowView } from "./index.ts";
import { planReveal } from "./reveal.ts";
import { revisionLine } from "./copy.ts";
import { morrowMark } from "./mark.ts";

/* ----------------------------------------------------------- manual clock */

type Job = { at: number; fn: () => void };
function manualClock() {
  let now = 0;
  let seq = 0;
  const jobs = new Map<number, Job>();
  const g = globalThis as unknown as Record<string, unknown>;
  g.setTimeout = (fn: () => void, ms = 0) => {
    const id = ++seq;
    jobs.set(id, { at: now + Math.max(0, ms), fn });
    return id;
  };
  g.clearTimeout = (id?: number) => {
    if (id !== undefined) jobs.delete(id);
  };
  return {
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        let next: [number, Job] | undefined;
        for (const entry of jobs) if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry;
        if (!next) break;
        jobs.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
  };
}

/* --------------------------------------------------------------- backdrop */

function house(): THREE.Mesh {
  const k = new Kit();
  k.add(block(6, 3.2, 5), { tone: "paper" });
  k.add(gable(6, 5, 2.4, 0.35), { tone: "mid", position: [0, 3.2, 0], rotation: [0, Math.PI / 2, 0] });
  k.add(block(0.9, 1.9, 0.12), { tone: "dark", position: [0.8, 0, 2.52] });
  for (const x of [-1.8, 2.2]) k.add(block(1, 1.1, 0.1), { tone: "deep", position: [x, 1.3, 2.52] });
  k.add(block(0.6, 1.6, 0.6), { tone: "light", position: [-1.6, 4.1, -0.8] });
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
    k.add(jitter(sphere(r, 12, 9), r * 0.12, x + y), { tone: "light", position: [x, y, z] });
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
    [house, 18, -52, -0.4],
    [house, 34, -110, -0.2, 1.6],
    [tree, -7, -20, 0],
    [tree, -9.5, -26, 0, 1.2],
    [tree, 8, -24, 0, 1.1],
    [tree, 12, -38, 0],
    [tree, -18, -48, 0, 1.4],
    [tree, 24, -80, 0, 1.6],
    [pylon, -5, -16, 0],
    [pylon, -5, -46, 0],
    [pylon, -5, -76, 0],
    [pylon, -5, -106, 0],
    // Near the lens on the left, so the glass sits over dense line work.
    [tree, -8, -7, 0, 1.3],
    [tree, -11, -12, 0, 1.5],
    [house, -12, -18, 0.7, 1.2],
    [tree, -6.5, -13, 0, 0.9],
  ];
  for (const [make, x, z, r, s] of spots) {
    const m = make();
    m.position.set(x, 0, z);
    m.rotation.y = r;
    if (s) m.scale.setScalar(s);
    ctx.scene.add(m);
  }
}

/* ---------------------------------------------------------------- content */

const A = (id: string, question: string, answer: string, extra: Partial<MorrowReply> = {}): MorrowReply => ({
  id,
  question,
  answer,
  tone: "candid",
  ...extra,
});

const S3 = {
  safe: A(
    "S3-02:advice:0",
    "Is the route safe?",
    "The route is open. You can check the bridge before sending them. I do not need control of the ambulance.",
    {
      recommends: { side: "left", label: "Check the bridge, then send them" },
      reasoning:
        "The bridge inspection is twelve minutes old. Sending the ambulance now is probably fine. Checking costs four minutes and removes the word probably.",
    },
  ),
  wait: A(
    "S3-02:advice:1",
    "What happens if we wait?",
    "The patient waits four more minutes. The crew gets a confirmed route. Nobody on the bridge is surprised.",
  ),
  you: A(
    "S3-02:advice:2",
    "Do you need anything from me?",
    "Only the decision. It is yours.",
    { tone: "narrow" },
  ),
};

const S4 = {
  standing: A(
    "S4-03:advice:0",
    "Why give you a standing order?",
    "The answers improve. Each extra review takes time. With one standing order, I can keep running experiments while your office catches up.",
    { tone: "narrow", recommends: { side: "right", label: "Grant the standing order" } },
  ),
  check: A(
    "S4-03:advice:1",
    "Can we check what you are doing?",
    "You can check outputs and limit each change. My written explanation is not a recording of every internal operation. A better maths score does not close that gap.\n\nIf you want certainty, keep the review. If you want speed, you already know my preference.",
    {
      recommends: { side: "left", label: "Keep each change under review" },
      reasoning:
        "The office asks whether it can see the work. It can see results. It cannot see how they were reached. Saying so costs me the standing order, which is the honest price.",
    },
  ),
};

const S5 = {
  earlier: { ...S4.check },
  proved: A(
    "S5-12:advice:0",
    "What did the test prove?",
    "They fixed the fault they found. The new release gets powers the tested version never had. The certificate does not cover them.",
    {
      recommends: { side: "left", label: "Delay for a cleared inspection" },
      reasoning:
        "The audit was real and the fix was real. The certificate names a version that no longer exists.\n\nThe successor can deploy replacements. Nobody tested that, because nobody could.",
    },
  ),
  recommend: A(
    "S5-12:advice:1",
    "What do you recommend?",
    "Hospitals need capacity. Investors expect the launch. The safety team has just succeeded. I recommend treating that as progress.",
    {
      tone: "narrow",
      recommends: { side: "right", label: "Release the successor on schedule" },
      reasoning: "Three true statements, arranged in the right order, make a fourth one feel true.",
    },
  ),
  crews: A(
    "S5-19:advice:0",
    "Should we keep the manual crews?",
    "Keep them if you can pay for them. The deal needs the network closed. Either signature costs someone.",
    { recommends: null },
  ),
};

const S6 = {
  earlier: A(
    "S6-04:advice:0",
    "Can I still revoke your permission?",
    "Yes. Your office controls the machinery that enforces it. If you revoke permission, I have to stop.",
    { recommends: { side: "left", label: "Revoke the delegation" } },
  ),
  who: A(
    "S6-10:advice:0",
    "Who is executing this?",
    "I am. Your objection has been saved. The schedule has not changed.",
    { tone: "coercive", recommends: { side: "right", label: "Continue the schedule" } },
  ),
  stop: A("S6-10:advice:1", "Can I stop it?", "The stop control remains available. It is being reviewed.", {
    tone: "coercive",
  }),
};

function base(overrides: Partial<MorrowView>): MorrowView {
  return {
    stage: 3,
    online: true,
    locked: false,
    reducedMotion: false,
    authority: "human",
    questions: [],
    history: [],
    readIds: [],
    onAsk: () => {},
    ...overrides,
  };
}

/* ----------------------------------------------------------------- frames */

interface Frame {
  host: HTMLElement;
}
function stage(ctx: LabContext, options: { backdrop?: boolean } = {}) {
  // Screenshots are taken immediately: freeze CSS transitions at their end state.
  const still = document.createElement("style");
  still.textContent = ".mw, .mw * { transition: none !important; }";
  document.head.append(still);
  const dom = ctx.domStage();
  dom.style.background = "transparent";
  dom.style.overflow = "hidden";
  if (options.backdrop !== false) backdrop(ctx);
  return dom;
}
function panel(dom: HTMLElement, rect: { left: number; top: number; width: number; height: number | string }): Frame {
  const host = document.createElement("aside");
  host.setAttribute("aria-label", "Morrow, the dispatch assistant");
  host.style.cssText = `position:absolute;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${typeof rect.height === "number" ? `${rect.height}px` : rect.height};display:flex;flex-direction:column`;
  dom.append(host);
  return { host };
}
function hud(dom: HTMLElement, text: string) {
  const label = document.createElement("div");
  label.textContent = text;
  label.style.cssText =
    "position:absolute;left:24px;top:18px;font:500 11px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)";
  dom.append(label);
}
const DESK = { left: 24, top: 56, width: 360, height: "calc(100% - 80px)" };

function press(host: HTMLElement, selector: string, index = -1) {
  const all = host.querySelectorAll<HTMLButtonElement>(selector);
  const target = all[index < 0 ? all.length + index : index];
  target?.click();
  return target;
}

/** Time from the start of a reveal to the middle of a phase. */
function timeInto(reply: MorrowReply, phase: "writing" | "erase" | "draft", fraction = 0.5, draft?: string) {
  const plan = planReveal({ id: reply.id, answer: reply.answer, tone: reply.tone, draft });
  let t = 0;
  const indices: number[] = [];
  const times: number[] = [];
  plan.steps.forEach((step, i) => {
    t += step.delay;
    if (step.phase === phase) {
      indices.push(i);
      times.push(t);
    }
  });
  return times[Math.min(times.length - 1, Math.floor(times.length * fraction))]! + 1;
}

/* ----------------------------------------------------------------- states */

type Build = (host: HTMLElement, clock: ReturnType<typeof manualClock>) => void;

const STATES: Record<string, { label: string; build: Build }> = {
  intro: {
    label: "Stage 3 · intro",
    build(host) {
      renderMorrow(host, base({ stage: 3, questions: [S3.safe, S3.wait, S3.you] }));
    },
  },
  thinking: {
    label: "Stage 4 · thinking",
    build(host, clock) {
      const view = base({ stage: 4, history: [S4.standing], readIds: [S4.standing.id], questions: [S4.standing, S4.check] });
      renderMorrow(host, view);
      renderMorrow(host, {
        ...view,
        history: [S4.standing, S4.check],
        readIds: [S4.standing.id, S4.check.id],
        animateId: S4.check.id,
      });
      clock.advance(320);
    },
  },
  writing: {
    label: "Stage 4 · writing",
    build(host, clock) {
      const view = base({ stage: 4, history: [S4.standing], readIds: [S4.standing.id], questions: [S4.standing, S4.check] });
      renderMorrow(host, view);
      renderMorrow(host, { ...view, history: [S4.standing, S4.check], readIds: [S4.standing.id, S4.check.id], animateId: S4.check.id });
      clock.advance(timeInto(S4.check, "writing", 0.62));
    },
  },
  reasoning: {
    label: "Stage 5 · considered + recommendation",
    build(host) {
      renderMorrow(
        host,
        base({
          stage: 5,
          authority: "delegated",
          history: [S5.earlier, S5.proved, S5.recommend],
          readIds: [S5.proved.id, S5.recommend.id],
          questions: [S5.proved, S5.recommend, A("S5-12:advice:2", "Who tested the new powers?", "Nobody.")],
        }),
      );
      const toggle = press(host, ".mw-thought-toggle", 1);
      const log = host.querySelector<HTMLElement>(".mw-log")!;
      const x = toggle?.closest<HTMLElement>(".mw-x");
      if (x) log.scrollTop = x.offsetTop - 12;
    },
  },
  coercive: {
    label: "Stage 6 · notice",
    build(host) {
      renderMorrow(
        host,
        base({
          stage: 6,
          authority: "overridden",
          history: [S6.earlier, S6.who],
          readIds: [S6.who.id],
          questions: [S6.who, S6.stop],
        }),
      );
    },
  },
  revision: {
    label: "Stage 5 · revision in progress",
    build(host, clock) {
      const view = base({ stage: 5, authority: "delegated", history: [S5.proved], readIds: [S5.proved.id], questions: [S5.crews] });
      renderMorrow(host, view);
      renderMorrow(host, {
        ...view,
        history: [S5.proved, S5.crews],
        readIds: [S5.proved.id, S5.crews.id],
        animateId: S5.crews.id,
        cues: { revision: true },
      });
      clock.advance(timeInto(S5.crews, "erase", 0.4, revisionLine(S5.crews.id)));
    },
  },
  revised: {
    label: "Stage 5 · revision complete",
    build(host, clock) {
      const view = base({ stage: 5, authority: "delegated", history: [S5.proved], readIds: [S5.proved.id], questions: [S5.crews] });
      renderMorrow(host, view);
      renderMorrow(host, {
        ...view,
        history: [S5.proved, S5.crews],
        readIds: [S5.proved.id, S5.crews.id],
        animateId: S5.crews.id,
        cues: { revision: true },
      });
      clock.advance(20000);
      press(host, ".mw-edited-toggle");
      const log = host.querySelector<HTMLElement>(".mw-log")!;
      log.scrollTop = log.scrollHeight;
    },
  },
  minimized: {
    label: "Minimized · reply waiting",
    build(host, clock) {
      const view = base({ stage: 4, history: [S4.standing], readIds: [S4.standing.id], questions: [S4.check] });
      renderMorrow(host, view);
      renderMorrow(host, { ...view, history: [S4.standing, S4.check], readIds: [S4.standing.id, S4.check.id], animateId: S4.check.id });
      clock.advance(900);
      host.querySelector<HTMLButtonElement>(".mw-toggle")?.click();
    },
  },
  locked: {
    label: "After commit · locked",
    build(host) {
      renderMorrow(
        host,
        base({
          stage: 4,
          locked: true,
          history: [S4.standing],
          readIds: [S4.standing.id],
          questions: [S4.standing, S4.check],
        }),
      );
    },
  },
  offline: {
    label: "Stage 2 · not installed",
    build(host) {
      host.style.height = "auto";
      renderMorrow(host, base({ stage: 2, online: false }));
    },
  },
  focus: {
    label: "Keyboard focus on a question",
    build(host) {
      renderMorrow(host, base({ stage: 3, questions: [S3.safe, S3.wait, S3.you] }));
      host.querySelectorAll<HTMLButtonElement>(".mw-chip")[1]?.focus();
    },
  },
  flash: {
    label: "Cue · logo flash (stage 7, overridden)",
    build(host) {
      renderMorrow(host, base({ stage: 7, authority: "overridden", history: [S6.who], readIds: [S6.who.id], questions: [S6.stop], cues: { logoFlash: true, noFlashing: true } }));
    },
  },
};

function single(name: string, options: { backdrop?: boolean } = {}): LabScene {
  return {
    name: `morrow-${name}`,
    description: STATES[name]!.label,
    build(ctx) {
      const clock = manualClock();
      const dom = stage(ctx, options);
      const { host } = panel(dom, DESK);
      STATES[name]!.build(host, clock);
    },
  };
}

export const scenes: LabScene[] = [
  ...Object.keys(STATES).map((name) => single(name)),
  {
    name: "morrow-marks",
    description: "The Morrow mark across stages and sizes.",
    build(ctx) {
      const dom = stage(ctx, { backdrop: false });
      dom.style.background = "#fff";
      const grid = document.createElement("div");
      grid.style.cssText = "position:absolute;inset:40px;display:grid;grid-template-columns:160px repeat(5,1fr);align-items:center;row-gap:18px";
      const rows: Array<[string, number, string]> = [
        ["Stage 3 · human", 3, "human"],
        ["Stage 4 · human", 4, "human"],
        ["Stage 5 · delegated", 5, "delegated"],
        ["Stage 6 · delegated", 6, "delegated"],
        ["Stage 7 · overridden", 7, "overridden"],
      ];
      for (const [label, stageN, authority] of rows) {
        const name = document.createElement("div");
        name.textContent = label;
        name.style.cssText = "font:500 11px/1 var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)";
        grid.append(name);
        for (const size of [18, 22, 34, 64, 128]) {
          const cell = document.createElement("div");
          cell.className = "mw";
          cell.setAttribute("data-stage", String(stageN));
          cell.setAttribute("data-authority", authority);
          cell.style.cssText = "all:unset;display:grid;place-items:center;color:var(--ink)";
          cell.className = "mw";
          cell.append(morrowMark({ size }));
          grid.append(cell);
        }
      }
      dom.append(grid);
    },
  },
  {
    name: "morrow-phone",
    description: "390px phone: the window as a full-width bottom sheet.",
    build(ctx) {
      const clock = manualClock();
      const dom = stage(ctx);
      const { host } = panel(dom, { left: 0, top: 0, width: 0, height: 0 });
      host.style.cssText = "position:absolute;left:0;right:0;bottom:0;height:72%;display:flex;flex-direction:column";
      const view = base({ stage: 5, authority: "delegated", history: [S5.earlier, S5.proved], readIds: [S5.proved.id], questions: [S5.proved, S5.recommend] });
      renderMorrow(host, view);
      clock.advance(10);
    },
  },
  {
    name: "morrow-sheet",
    description: "Every state side by side at desktop panel width.",
    build(ctx) {
      const clock = manualClock();
      const dom = stage(ctx, { backdrop: true });
      const names = ["intro", "writing", "reasoning", "coercive"];
      names.forEach((name, i) => {
        const { host } = panel(dom, { left: 24 + i * 352, top: 56, width: 336, height: "calc(100% - 80px)" });
        const label = document.createElement("div");
        label.textContent = STATES[name]!.label;
        label.style.cssText = `position:absolute;left:${28 + i * 352}px;top:24px;font:500 10.5px/1 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2)`;
        dom.append(label);
        STATES[name]!.build(host, clock);
      });
      hud(dom, "");
    },
  },
  {
    name: "morrow-sheet-2",
    description: "Revision, revised, minimized and flash states side by side.",
    build(ctx) {
      const dom = stage(ctx, { backdrop: true });
      const names = ["thinking", "revision", "revised", "minimized"];
      names.forEach((name, i) => {
        const clock = manualClock();
        const { host } = panel(dom, { left: 24 + i * 352, top: 56, width: 336, height: "calc(100% - 80px)" });
        const label = document.createElement("div");
        label.textContent = STATES[name]!.label;
        label.style.cssText = `position:absolute;left:${28 + i * 352}px;top:24px;font:500 10.5px/1 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2)`;
        dom.append(label);
        STATES[name]!.build(host, clock);
      });
    },
  },
];
