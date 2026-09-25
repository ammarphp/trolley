/**
 * Wire lab scenes. The panel floats over the real ink pipeline (the cab's
 * in-situ track, plus some buildings) so glass readability is judged over
 * actual line art.
 *
 *   node scripts/lab-shot.mjs wire-crisis --file src/ui/components/wire/wire.lab.ts --out shot.png --w 1440 --h 900
 *
 * params: {"reduced":true} renders with reduced motion; {"bg":"plain"} skips 3D;
 * {"width":300} narrows the desk panel; {"seeds":[...]} picks contact-sheet seeds.
 */
import "../../theme.css";
import "./wire.css";
import * as THREE from "three";
import { inkMaterial } from "../../../render/core/ink-material.ts";
import {
  Kit,
  block,
  gable,
  cylinder,
  sphere,
  jitter,
} from "../../../render/core/geometry.ts";
import { inSituStage } from "../../../render/lab/stage-kit.ts";
import type { LabContext, LabScene } from "../../../render/lab/types.ts";
import { renderTicker } from "./ticker.ts";
import { wireBrand, wireMotifs } from "./brand-bridge.ts";
import { toWireView } from "./normalize.ts";
import { renderWire } from "./wire.ts";
import {
  BOTS,
  CRISIS,
  CRISIS_NEXT,
  EARLY,
  FRENZY,
  type WireFixture,
} from "./wire.fixtures.ts";
import type { WireView } from "./types.ts";

function house(seed: number): THREE.Mesh {
  const k = new Kit();
  const w = 5 + (seed % 3);
  k.add(block(w, 3.2 + (seed % 2), 5), { tone: "paper" });
  k.add(gable(w, 5, 2.4, 0.35), {
    tone: "mid",
    position: [0, 3.2 + (seed % 2), 0],
    rotation: [0, Math.PI / 2, 0],
  });
  k.add(block(0.9, 1.9, 0.12), { tone: "dark", position: [0.8, 0, 2.52] });
  for (const x of [-1.6, 1.9])
    k.add(block(1, 1.1, 0.1), { tone: "deep", position: [x, 1.3, 2.52] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true }));
}

function tree(seed: number): THREE.Mesh {
  const k = new Kit();
  k.add(cylinder(0.14, 0.26, 3.2, 8), { tone: "dark", position: [0, 1.6, 0] });
  const blobs: [number, number, number, number][] = [
    [0, 4.2, 0, 1.6],
    [0.9, 3.7, 0.3, 1.1],
    [-0.8, 3.8, -0.2, 1.2],
    [0.2, 5.1, -0.3, 1.0],
  ];
  for (const [x, y, z, r] of blobs)
    k.add(jitter(sphere(r, 12, 9), r * 0.12, x + y + seed), {
      tone: "light",
      position: [x, y, z],
    });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true }));
}

function world(ctx: LabContext) {
  if (ctx.params.bg === "plain") return;
  inSituStage(ctx);
  for (let i = 0; i < 10; i++) {
    const hz = -14 - i * 11;
    const side = i % 2 ? 1 : -1;
    const h = house(i);
    h.position.set(side * (9 + (i % 3) * 3), 0, hz);
    h.rotation.y = side * 0.3;
    ctx.scene.add(h);
    const t = tree(i);
    t.position.set(-side * (7 + (i % 4)), 0, hz - 4);
    ctx.scene.add(t);
  }
}

interface Layout {
  width: number;
  top: number;
  right: number;
  bottom: number;
  tickerBottom?: boolean;
  variant?: WireView["variant"];
}

function stage(ctx: LabContext): HTMLElement {
  const dom = ctx.domStage();
  dom.style.background = "transparent";
  dom.style.overflow = "hidden";
  return dom;
}

function viewFor(
  f: WireFixture,
  reduced: boolean,
  extra: Partial<WireView> = {},
  ambient = f.ambient,
): WireView {
  return {
    ...toWireView(f.news, ambient, {
      stage: f.stage,
      botSaturation: f.botSaturation,
      reducedMotion: reduced,
      today: f.today,
      causeLabel: (id) => f.causes?.[id] ?? null,
    }),
    ...extra,
  };
}

function mount(
  ctx: LabContext,
  f: WireFixture,
  layout: Layout,
  extra: Partial<WireView> = {},
) {
  world(ctx);
  const dom = stage(ctx);
  const reduced = ctx.params.reduced === true;
  const host = document.createElement("div");
  const width = Number(ctx.params.width) || layout.width;
  host.style.cssText = `position:absolute;top:${layout.top}px;right:${layout.right}px;bottom:${layout.bottom}px;width:${width}px;display:flex;flex-direction:column`;
  dom.append(host);
  let tickerHost: HTMLElement | null | undefined;
  if (layout.tickerBottom) {
    tickerHost = document.createElement("div");
    tickerHost.style.cssText =
      "position:absolute;left:24px;right:24px;bottom:18px";
    dom.append(tickerHost);
  }
  const view = viewFor(f, reduced, { variant: layout.variant, ...extra });
  renderWire(host, view, { tickerHost });
  return { host, view, reduced, tickerHost };
}

/** Let slide-ins, banners and read timers settle before the shot. */
const settle = (ms = 900) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const DESK: Layout = {
  width: 372,
  top: 24,
  right: 24,
  bottom: 64,
  tickerBottom: true,
};

export const scenes: LabScene[] = [
  {
    name: "wire-early",
    description: "Stage 2: a quaint local feed, few items.",
    build(ctx) {
      mount(ctx, EARLY, DESK, {
        readIds: ["a-e1", "a-e2", "a-e3", "news:s1-02"],
      });
    },
  },
  {
    name: "wire-frenzy",
    description:
      "Stage 4 financing frenzy at 0.3 bot saturation (subtle). One card opened to show its detail line.",
    build(ctx) {
      const { host } = mount(ctx, FRENZY, DESK, {
        readIds: FRENZY.ambient.map((a) => a.id).slice(0, 6),
      });
      const card = host.querySelectorAll<HTMLElement>(".wr-card")[2];
      if (card) card.dataset.open = "true";
    },
  },
  {
    name: "wire-crisis",
    description: "Stage 6 crisis: breaking banner arrives on an update.",
    async build(ctx) {
      const { host, reduced, tickerHost } = mount(ctx, CRISIS, DESK);
      const next = viewFor(CRISIS, reduced, {}, [
        ...CRISIS.ambient,
        ...CRISIS_NEXT,
      ]);
      renderWire(host, next, { tickerHost });
      await settle();
    },
  },
  {
    name: "wire-bots",
    description:
      "Stage 7 at 0.9 bot saturation: identical faces, one minute, piles, badges, tombstones.",
    build(ctx) {
      mount(ctx, BOTS, DESK);
    },
  },
  {
    name: "wire-bots-compare",
    description: "The same late feed at 0.3 (left) and 0.9 (right).",
    build(ctx) {
      world(ctx);
      const dom = stage(ctx);
      const reduced = ctx.params.reduced === true;
      const levels = [0, 0.3, 0.6, 0.9];
      levels.forEach((sat, i) => {
        const host = document.createElement("div");
        host.style.cssText = `position:absolute;top:24px;bottom:24px;left:${24 + i * 348}px;width:332px;display:flex;flex-direction:column`;
        dom.append(host);
        renderWire(host, viewFor({ ...BOTS, botSaturation: sat }, reduced), {
          tickerHost: null,
        });
        const tag = document.createElement("div");
        tag.textContent = `bot saturation ${sat.toFixed(1)}`;
        tag.style.cssText =
          "position:absolute;top:-2px;right:14px;font:500 10px/1 'Geist Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:#7d8087;z-index:5;transform:translateY(-100%)";
        host.style.top = "44px";
        host.append(tag);
      });
    },
  },
  {
    name: "wire-ticker",
    description:
      "The ticker: moving strip (top), reduced-motion strip (middle), crisis strip (bottom).",
    build(ctx) {
      world(ctx);
      const dom = stage(ctx);
      const rows: [string, boolean, WireFixture][] = [
        ["top:24px", false, FRENZY],
        ["top:76px", true, FRENZY],
        ["bottom:18px", false, CRISIS],
      ];
      for (const [pos, reduced, f] of rows) {
        const host = document.createElement("div");
        host.style.cssText = `position:absolute;left:24px;right:24px;${pos}`;
        dom.append(host);
        const v = viewFor(f, reduced);
        renderTicker(host, {
          lines: v.ticker,
          reducedMotion: reduced,
          stage: f.stage,
        });
      }
    },
  },
  {
    name: "wire-phone",
    description:
      "390px phone: the wire as a full-width sheet with the inline ticker.",
    async build(ctx) {
      const { host, reduced } = mount(ctx, CRISIS, {
        width: 0,
        top: 120,
        right: 0,
        bottom: 0,
        variant: "sheet",
      });
      host.style.left = "0";
      host.style.width = "auto";
      renderWire(
        host,
        viewFor(CRISIS, reduced, { variant: "sheet" }, [
          ...CRISIS.ambient,
          ...CRISIS_NEXT,
        ]),
      );
      await settle();
    },
  },
  {
    name: "wire-thumbs",
    description:
      "Contact sheet: every thumbnail motif, wide and square, two seeds; avatars and marks.",
    build(ctx) {
      const dom = ctx.domStage();
      dom.style.cssText +=
        ";padding:24px;display:flex;flex-wrap:wrap;gap:18px;align-content:flex-start;background:#fff";
      for (const motif of wireMotifs()) {
        for (const seed of (ctx.params.seeds as string[] | undefined) ?? [
          "alpha",
          "omega",
        ]) {
          const cell = document.createElement("div");
          cell.style.cssText = "display:flex;gap:10px;align-items:flex-end";
          const wide = document.createElement("div");
          wide.style.cssText =
            "width:256px;aspect-ratio:16/9;border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px rgba(17,18,20,.12)";
          wide.className = "wr-hero";
          wide.append(
            wireBrand.thumbnail(motif, `${motif}:${seed}`, { wide: true }),
          );
          const sq = document.createElement("div");
          sq.className = "wr-thumb";
          sq.append(
            wireBrand.thumbnail(motif, `${motif}:${seed}`, { wide: false }),
          );
          const cap = document.createElement("div");
          cap.textContent = motif;
          cap.style.cssText =
            "font:500 10px/1 'Geist Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:#7d8087;width:60px";
          cell.append(wide, sq, cap);
          dom.append(cell);
        }
      }
      const faces = document.createElement("div");
      faces.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;width:100%";
      const handles = [
        "lena_okafor",
        "kwame.builds",
        "ravi.dsouza",
        "hanne_v",
        "ines.w",
        "tomas_reyes",
        "m.adeyemi",
        "dr_amaka",
        "marguerite_b",
        "junctionwatcher",
        "quant_ottoline",
        "citizen_4471",
      ];
      for (const handle of handles) {
        const a = document.createElement("div");
        a.className = "wr-av";
        a.style.cssText = "width:48px;height:48px";
        a.append(wireBrand.avatar(handle, { bot: false, size: 48 }));
        faces.append(a);
      }
      const blank = document.createElement("div");
      blank.className = "wr-av";
      blank.style.cssText = "width:48px;height:48px";
      blank.append(wireBrand.avatar("x", { bot: true, blank: true, size: 48 }));
      faces.append(blank);
      for (const id of [
        "ledger",
        "relay",
        "common-rail",
        "morrow",
        "vela",
        "meridian",
        "northwind",
        "holloway-gazette",
      ]) {
        const m = document.createElement("div");
        m.style.cssText = "width:32px;height:32px";
        m.append(wireBrand.logo(id, { size: 32, name: id }));
        faces.append(m);
      }
      for (const n of ["ostra", "veld", "caspia", "north-march"]) {
        const f = document.createElement("div");
        f.append(wireBrand.flag(n, 36));
        faces.append(f);
      }
      dom.append(faces);
    },
  },
  {
    name: "wire-interactive",
    description:
      "Live harness: window.__wirePush(n) files n new items; callbacks are recorded on window.",
    build(ctx) {
      const w = window as unknown as Record<string, unknown>;
      const reads: string[] = [];
      const opens: string[] = [];
      w.__wireReads = reads;
      w.__wireOpens = opens;
      world(ctx);
      const dom = stage(ctx);
      const host = document.createElement("div");
      host.style.cssText =
        "position:absolute;top:24px;right:24px;bottom:24px;width:372px;display:flex;flex-direction:column";
      dom.append(host);
      const reduced = ctx.params.reduced === true;
      let ambient = [...FRENZY.ambient];
      let n = 0;
      const options = {
        tickerHost: undefined,
        onRead: (ids: string[]) => reads.push(...ids),
        onOpen: (item: { id: string }) => opens.push(item.id),
      };
      const draw = () =>
        renderWire(
          host,
          viewFor({ ...FRENZY, today: 214 + n }, reduced, {}, ambient),
          options,
        );
      draw();
      w.__wirePush = (count: number, breaking = false) => {
        for (let i = 0; i < count; i++) {
          n++;
          ambient = [
            ...ambient,
            breaking && i === 0
              ? {
                  id: `live-b${n}`,
                  kind: "breaking" as const,
                  outletId: "relay",
                  topic: "security",
                  text: `Signals fail on line ${n}`,
                  dateLabel: `DAY ${215 + n} · 09:${String(n % 60).padStart(2, "0")}`,
                  day: 214 + n,
                  isBot: false,
                  thumbnailTopic: "security",
                  severity: 2,
                }
              : {
                  id: `live${n}`,
                  kind: "post" as const,
                  authorHandle: `voice${n}`,
                  authorName: `Voice ${n}`,
                  topic: "",
                  text: `${["Trains", "Markets", "Clinics", "Schools", "Depots", "Ferries", "Mines", "Farms", "Courts", "Docks"][n % 10]} report ${["delays", "calm", "queues", "closures", "records"][n % 5]} this morning.`,
                  dateLabel: `DAY ${215 + n} · 10:${String(n % 60).padStart(2, "0")}`,
                  day: 214 + n,
                  isBot: n % 2 === 0,
                  engagement: 10 * n,
                  severity: 0,
                },
          ];
        }
        draw();
      };
      w.__wireState = () => {
        const scroller = host.querySelector<HTMLElement>(".wr-scroll")!;
        const cards = [...host.querySelectorAll<HTMLElement>(".wr-card")];
        return {
          scrollTop: scroller.scrollTop,
          keys: cards.map((c) => c.dataset.key),
          visible: cards.filter((c) => !c.hidden).map((c) => c.dataset.key),
          active:
            (document.activeElement as HTMLElement | null)?.dataset?.key ??
            document.activeElement?.className ??
            null,
          pill:
            host.querySelector<HTMLElement>(".wr-pill")?.hidden === false
              ? host.querySelector(".wr-pill")!.textContent
              : null,
          banner: host.querySelector(".wr-banner-hl")?.textContent ?? null,
          unread: cards
            .filter((c) => c.dataset.read === "false")
            .map((c) => c.dataset.key),
          count: host.querySelector(".wr-count")?.getAttribute("aria-label"),
          setsize: cards.find((c) => !c.hidden)?.getAttribute("aria-setsize"),
        };
      };
    },
  },
  {
    name: "wire-empty",
    description: "Before any news: the quiet state.",
    build(ctx) {
      mount(ctx, { ...EARLY, news: [], ambient: [] }, DESK);
    },
  },
];
