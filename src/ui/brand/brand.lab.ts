/**
 * Brand lab: identity boards for the fictional world, drawn in the DOM.
 *   node scripts/lab-shot.mjs brand-board --file src/ui/brand/brand.lab.ts --out shot.png --w 1440 --h 900
 * Scenes: brand-board (overview), brand-labs, brand-press, brand-nations,
 * brand-thumbs, brand-people, brand-zoom and brand-thumbs-zoom (critique).
 */
import type { LabContext, LabScene } from "../../render/lab/types.ts";
import { logoFor } from "./logos.ts";
import { flagFor } from "./flags.ts";
import { morrowLockup, morrowMark, MORROW_STATES } from "./morrow.ts";
import { COMMON_RAIL, LABS, MORROW, NATIONS, OUTLETS, botDisplayName, botHandles, persona } from "./entities.ts";
import { thumbnailFor, THUMB_TOPICS } from "./thumbs.ts";
import { FLAG_INK } from "./palette.ts";
import { brandForWire } from "./wire-adapter.ts";
import { LOGO_ENTITIES } from "./logos.ts";
import { avatarFor } from "./avatars.ts";
import { trolleyWordmark } from "./wordmarks.ts";

const FONT_CSS = `
@font-face{font-family:"Geist";font-weight:100 900;font-display:block;src:url(./fonts/geist-latin-wght-normal.woff2) format("woff2-variations")}
@font-face{font-family:"Geist";font-weight:100 900;font-display:block;src:url(./fonts/geist-latin-ext-wght-normal.woff2) format("woff2-variations");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F}
@font-face{font-family:"Geist Mono";font-weight:100 900;font-display:block;src:url(./fonts/geist-mono-latin-wght-normal.woff2) format("woff2-variations")}
`;

const BOARD_CSS = `
.bb{--ink:#111214;--ink2:#4c4f55;--ink3:#7d8087;--ink4:#a9abb0;--hair:rgba(17,18,20,.12);--hair2:rgba(17,18,20,.22);font:400 12px/1.42 Geist,Inter,sans-serif;color:var(--ink);background:#fff;min-height:100vh;box-sizing:border-box;padding:26px 34px 30px}
.bb *{box-sizing:border-box}
.bb svg{display:block}
.bb-mono{font:500 9px/1.3 "Geist Mono",ui-monospace,monospace;letter-spacing:.09em;text-transform:uppercase;color:var(--ink3)}
.bb-head{display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid var(--ink);margin-bottom:6px}
.bb-head h1{font:600 20px/1.1 Geist,sans-serif;letter-spacing:-.02em;margin:0 0 3px}
.bb-head .meta{display:flex;gap:26px;align-items:flex-end}
.bb-sec{display:grid;grid-template-columns:150px 1fr;gap:20px;padding:14px 0 15px;border-bottom:1px solid var(--hair)}
.bb-sec:last-child{border-bottom:0}
.bb-sec>.lab{padding-top:2px}
.bb-sec>.lab b{display:block;font:600 12.5px/1.25 Geist,sans-serif;letter-spacing:-.005em;margin:5px 0 4px;color:var(--ink)}
.bb-sec>.lab p{margin:0;color:var(--ink2);font-size:11px;line-height:1.4}
.bb-row{display:flex;flex-wrap:wrap;gap:16px 26px;align-items:flex-end}
.bb-cell{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.bb-card{border:1px solid var(--hair);border-radius:3px;padding:14px 14px 11px;display:flex;flex-direction:column;gap:10px;background:#fff}
.bb-card .cap{display:flex;justify-content:space-between;gap:10px;align-items:baseline;width:100%}
.bb-name{font:600 11.5px/1.2 Geist,sans-serif}
.bb-small{font-size:10.5px;color:var(--ink2);line-height:1.35}
.bb-grid{display:grid;gap:12px}
.bb-dark{background:#111214;border-color:#111214}
.bb-dark .bb-mono{color:#a9abb0}
.bb-thumb{outline:1px solid var(--hair2);outline-offset:0}
`;

async function stage(ctx: LabContext): Promise<HTMLElement> {
  const root = ctx.domStage();
  const style = document.createElement("style");
  style.textContent = FONT_CSS + BOARD_CSS;
  document.head.append(style);
  await Promise.all([
    document.fonts.load('400 16px "Geist"'),
    document.fonts.load('650 16px "Geist"'),
    document.fonts.load('300 16px "Geist"'),
    document.fonts.load('900 16px "Geist"'),
    document.fonts.load('500 16px "Geist Mono"'),
  ]).catch(() => undefined);
  const board = document.createElement("div");
  board.className = "bb";
  root.append(board);
  return board;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function header(title: string, sheet: string): string {
  return `<div class="bb-head">
    <div style="display:flex;gap:22px;align-items:flex-end">
      ${trolleyWordmark({ height: 40 })}
      <div><div class="bb-mono" style="margin-bottom:4px">World identity system · ${esc(sheet)}</div><h1>${esc(title)}</h1></div>
    </div>
    <div class="meta">
      <div class="bb-mono" style="text-align:right;line-height:1.55">All names, marks and flags are invented.<br>No real organisation or person is depicted.</div>
      ${morrowLockup({ height: 26, byline: true })}
    </div>
  </div>`;
}

function section(label: string, title: string, note: string, body: string): string {
  return `<div class="bb-sec"><div class="lab"><div class="bb-mono">${esc(label)}</div><b>${esc(title)}</b><p>${esc(note)}</p></div><div>${body}</div></div>`;
}

const HUMANS = ["maudellery", "ravi_on_the_740", "bea_nightshift", "kofibakes", "junharlow", "amara.o", "teo_votes", "wenlock_nurse", "larkspur_rosalind", "dispatch_renee", "tamsin_ledger", "khart_relay", "winnie_arsw", "leni_aurich", "senbrennock", "priyadore"];

/* ================================================================ scenes */

export const scenes: LabScene[] = [
  {
    name: "brand-board",
    description: "Overview board: labs, press, nations, plates, people, Morrow.",
    async build(ctx) {
      const b = await stage(ctx);
      const labs = `<div class="bb-row" style="gap:14px 34px;align-items:center">
        ${logoFor("vela", { size: 40, variant: "lockup" })}
        ${logoFor("orrin", { size: 40, variant: "lockup" })}
        ${logoFor("tessaly", { size: 40, variant: "lockup" })}
        ${logoFor("halberd", { size: 40, variant: "lockup" })}
        ${logoFor("common-rail", { size: 40, variant: "lockup" })}
        ${logoFor("authority", { size: 44, variant: "lockup" })}
      </div>`;
      const morrow = `<div class="bb-row" style="gap:18px;align-items:center">
        ${MORROW_STATES.map((s) => `<div class="bb-cell" style="align-items:center">${morrowMark(s, { size: 50 })}<div class="bb-mono">${s}</div></div>`).join("")}
        <div style="width:1px;height:56px;background:var(--hair)"></div>
        ${[16, 20, 24, 32].map((z) => morrowMark("idle", { size: z })).join("")}
        <div class="bb-card bb-dark" style="padding:10px;flex-direction:row;gap:10px;align-items:center">${morrowMark("idle", { size: 30, tile: "#1b1d22" })}${morrowMark("thinking", { size: 30 })}</div>
      </div>`;
      const press = `<div class="bb-grid" style="grid-template-columns:repeat(13,1fr);gap:10px">
        ${OUTLETS.map((o) => `<div class="bb-cell" style="gap:5px">${logoFor(o.id, { size: 44, variant: "mark" })}<div class="bb-name" style="font-size:10.5px">${esc(o.name)}</div><div class="bb-mono" style="font-size:8px">${esc(o.desk)}</div></div>`).join("")}
      </div>`;
      const nations = `<div class="bb-grid" style="grid-template-columns:repeat(10,1fr);gap:12px">
        ${NATIONS.map((n) => `<div class="bb-cell" style="gap:5px">${flagFor(n.id, 72, { uniform: true })}<div class="bb-name" style="font-size:10.5px">${esc(n.shortName)}</div><div class="bb-mono" style="font-size:8px">${esc(n.capital)}</div></div>`).join("")}
      </div>`;
      const plates = ["data-centre", "protest", "chart-down", "grid", "storm", "ai-chip", "hospital", "drone-swarm"];
      const strip = `<div class="bb-row" style="gap:10px">${plates.map((t) => `<div class="bb-cell" style="gap:4px"><div class="bb-thumb">${thumbnailFor(t, "board", { width: 140 })}</div><div class="bb-mono" style="font-size:8px">${t}</div></div>`).join("")}</div>`;
      const bots = botHandles(8, "board", 4);
      const people = `<div style="display:flex;gap:26px;align-items:flex-start">
        <div><div class="bb-mono" style="margin-bottom:6px">People</div><div class="bb-row" style="gap:6px">${HUMANS.slice(0, 8).map((h) => avatarFor(h, { size: 34 })).join("")}</div></div>
        <div><div class="bb-mono" style="margin-bottom:6px">Accounts that are not people</div><div class="bb-row" style="gap:6px">${bots.map((h) => avatarFor(h, { size: 34, bot: true })).join("")}</div></div>
      </div>`;
      b.innerHTML =
        header("The world outside the cab", "Board 00 · Overview") +
        section("01 · Labs & operator", "Vela, its rivals, the railway", "Marks on a 48-unit grid; Geist wordmarks, each with its own weight and case.", labs) +
        section("02 · Morrow", "The assistant", "A dawn with a pupil. Cobalt always; red exactly once.", morrow) +
        section("03 · The press", "Thirteen voices", "Pigment only where it means something: the tabloid's alarm, the state channel's flag, the radio's lamp.", press) +
        section("04 · Nations", "Ten flags", "Printed inks, geometric construction, a hairline edge.", nations) +
        section("05 · The wire", "News plates & accounts", "Pen-and-ink plates drawn in true perspective and lit from the left.", strip + `<div style="height:12px"></div>` + people);
    },
  },
  {
    name: "brand-labs",
    description: "Laboratories, operator, Morrow and the game wordmark at presentation size.",
    async build(ctx) {
      const b = await stage(ctx);
      const card = (id: string, sub: string, note: string, big = 50) =>
        `<div class="bb-card" style="gap:16px"><div style="display:flex;gap:22px;align-items:center">${logoFor(id, { size: 64, variant: "mark" })}${logoFor(id, { size: big, variant: "wordmark" })}</div><div class="cap"><div><div class="bb-name">${esc(sub)}</div><div class="bb-small">${esc(note)}</div></div></div></div>`;
      const labCards = LABS.map((l) => card(l.id, `${l.name} — ${l.tagline}`, `${l.ceo.title} ${l.ceo.name} · ${l.hq} · flagship ${l.flagship}`)).join("");
      const ops = card("halberd", "Halberd Compute", "Chief Executive Wendell Kaske · data campuses") + card("common-rail", `${COMMON_RAIL.name} — ${COMMON_RAIL.motto}`, `${COMMON_RAIL.head.title} ${COMMON_RAIL.head.name}`);
      const morrow = `<div class="bb-card" style="gap:14px"><div style="display:flex;gap:18px;align-items:center">${MORROW_STATES.map((s) => `<div class="bb-cell" style="align-items:center">${morrowMark(s, { size: 76 })}<div class="bb-mono">${s}</div></div>`).join("")}</div>
        <div style="display:flex;gap:18px;align-items:center">${morrowLockup({ height: 40, byline: true })}<div class="bb-small" style="max-width:320px">${esc(MORROW.tagline)} The pupil sits at the half-sun's centre of mass; at 16 px the strokes thicken and the pupil grows.</div></div></div>`;
      const seal = `<div class="bb-card" style="flex-direction:row;gap:22px;align-items:center">${logoFor("authority", { size: 120, variant: "mark" })}<div style="display:flex;flex-direction:column;gap:12px">${logoFor("authority", { size: 52, variant: "wordmark" })}<div class="bb-small" style="max-width:250px">Authority notices are published by Common Rail. Legends are set glyph by glyph around the rim.</div></div></div>`;
      const game = `<div class="bb-card" style="gap:18px"><div style="display:flex;gap:40px;align-items:flex-end">${trolleyWordmark({ height: 64 })}${trolleyWordmark({ height: 64, variant: "rail" })}</div><div class="bb-card bb-dark" style="flex-direction:row;gap:40px;padding:16px 18px;align-items:center">${trolleyWordmark({ height: 44, tone: "reverse" })}${logoFor("vela", { size: 40, variant: "lockup", tone: "reverse" })}${morrowMark("idle", { size: 40 })}</div></div>`;
      b.innerHTML =
        header("Laboratories, operator, assistant", "Board 01") +
        section("Frontier labs", "Vela · Orrin · Tessaly", "Three typographic temperaments inside one family: drawn geometric lower-case; enterprise capitals; light academic lower-case.", `<div class="bb-grid" style="grid-template-columns:repeat(3,1fr)">${labCards}</div>`) +
        section("Infrastructure", "Compute and rail", "The campus builder and the railway you work for.", `<div class="bb-grid" style="grid-template-columns:repeat(2,1fr)">${ops}</div>`) +
        section("Morrow", "Five states", "idle · thinking · alert · glitch · red", `<div class="bb-grid" style="grid-template-columns:1.3fr 1fr">${morrow}${seal}</div>`) +
        section("The game", "trolley.", "Lower-case, tight, the stop as a true circle in signal red. Rail variant for title cards.", game);
    },
  },
  {
    name: "brand-press",
    description: "Every outlet lockup with its desk and house voice.",
    async build(ctx) {
      const b = await stage(ctx);
      const card = (o: (typeof OUTLETS)[number], h: number, minH: number) => `<div class="bb-card" style="min-height:${minH}px;justify-content:space-between">
          <div style="height:${h + 10}px;display:flex;align-items:center">${logoFor(o.id, { size: o.id === "authority" ? h * 1.15 : h, variant: "lockup" })}</div>
          <div><div class="cap"><div class="bb-name">${esc(o.name)}</div><div class="bb-mono">@${esc(o.handle)}</div></div><div class="bb-small" style="margin-top:3px">${esc(o.desk)} · ${esc(NATIONS.find((n) => n.id === o.nation)!.shortName)}${o.founded ? ` · est. ${o.founded}` : ""}</div><div class="bb-small" style="margin-top:5px;color:var(--ink3)">${esc(o.voice)}</div></div>
        </div>`;
      const engine = OUTLETS.filter((o) => ["ledger", "relay", "authority"].includes(o.id));
      const rest = OUTLETS.filter((o) => !["ledger", "relay", "authority"].includes(o.id));
      b.innerHTML =
        header("The press", "Board 02") +
        section("Engine outlets", "What the simulation publishes through", "Every authored consequence reaches the wire as The Ledger, Relay or an Authority notice.", `<div class="bb-grid" style="grid-template-columns:repeat(3,1fr);gap:12px">${engine.map((o) => card(o, 56, 176)).join("")}</div>`) +
        section("Ambient press", "Ten more voices", "Tabloid, business, tech, broadcast, science, local, regional, state, aggregator and international.", `<div class="bb-grid" style="grid-template-columns:repeat(5,1fr);gap:12px">${rest.map((o) => card(o, 38, 172)).join("")}</div>`);
    },
  },
  {
    name: "brand-nations",
    description: "Ten fictional nations: flags, capitals, leaders.",
    async build(ctx) {
      const b = await stage(ctx);
      const cards = NATIONS.map(
        (n) => `<div class="bb-card" style="gap:12px">
          <div style="height:92px;display:flex;align-items:center">${flagFor(n.id, n.flag.ratio > 0.9 ? 92 : n.flag.ratio < 0.6 ? 170 : 138)}</div>
          <div><div class="cap"><div class="bb-name">${esc(n.name)}</div><div class="bb-mono">${esc(n.demonym)}</div></div>
          <div class="bb-small" style="margin-top:3px">${esc(n.capital)} · ${esc(n.leader.title)} ${esc(n.leader.name)}</div>
          <div class="bb-small" style="margin-top:5px;color:var(--ink3)">${esc(n.flag.meaning)}</div></div>
        </div>`,
      ).join("");
      const inks = Object.entries(FLAG_INK)
        .map(([name, hex]) => `<div class="bb-cell" style="gap:5px"><div style="width:64px;height:40px;background:${hex};outline:1px solid var(--hair)"></div><div class="bb-mono" style="font-size:8px">${name}<br>${hex}</div></div>`)
        .join("");
      const feed = NATIONS.map((n) => `<div style="display:flex;gap:7px;align-items:center">${flagFor(n.id, 24, { uniform: true })}<span class="bb-small" style="color:var(--ink)">${esc(n.shortName)}</span></div>`).join("");
      b.innerHTML =
        header("Nations", "Board 03") +
        `<div style="height:12px"></div><div class="bb-grid" style="grid-template-columns:repeat(5,1fr);gap:12px">${cards}</div>` +
        `<div style="height:8px"></div>` +
        section("Flag inks", "Ten printed inks", "Flags are the one place with a wider palette; every ink is muted and flat, like a two- or three-colour letterpress job.", `<div class="bb-row" style="gap:10px">${inks}</div>`) +
        section("At feed size", "24 px, uniform 3:2", "The wire letterboxes every flag into the same box so rows align; native proportions (1:2, 2:3, 1:1) are kept on the boards above.", `<div class="bb-row" style="gap:10px 22px">${feed}</div>`);
    },
  },
  {
    name: "brand-thumbs",
    description: "Every news plate family at feed size.",
    async build(ctx) {
      const b = await stage(ctx);
      const seed = (ctx.params.seed as string | undefined) ?? "plates";
      const w = (ctx.params.w as number | undefined) ?? 160;
      const cells = THUMB_TOPICS.map((t) => `<div class="bb-cell" style="gap:4px"><div class="bb-thumb">${thumbnailFor(t, seed, { width: w })}</div><div class="bb-mono" style="font-size:8.5px">${t}</div></div>`).join("");
      b.innerHTML = header("News plates", `Board 04 · ${THUMB_TOPICS.length} families`) + `<div style="height:12px"></div><div class="bb-grid" style="grid-template-columns:repeat(8,${w}px);gap:12px 13px">${cells}</div>`;
    },
  },
  {
    name: "brand-people",
    description: "Human avatars against bot avatars; bot handles from the generator.",
    async build(ctx) {
      const b = await stage(ctx);
      const cell = (svg: string, name: string, handle: string) =>
        `<div class="bb-cell" style="gap:5px;min-width:0">${svg}<div class="bb-name" style="font-size:10px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(name)}</div><div class="bb-mono" style="font-size:7.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">@${esc(handle)}</div></div>`;
      const grid = (inner: string) => `<div class="bb-grid" style="grid-template-columns:repeat(16,minmax(0,1fr));gap:12px 8px">${inner}</div>`;
      const human = HUMANS.map((h) => cell(avatarFor(h, { size: 56 }), persona(h)?.name ?? h, h)).join("");
      const bots = botHandles(16, "people", 3)
        .map((h) => cell(avatarFor(h, { size: 56, bot: true }), botDisplayName(h), h))
        .join("");
      const late = botHandles(24, "late", 7)
        .map((h) => avatarFor(h, { size: 30, bot: true }))
        .join("");
      const blanks = Array.from({ length: 24 }, () => avatarFor("collapsed", { size: 30, blank: true })).join("");
      const sizes = [16, 20, 24, 32, 40, 56].map((z) => avatarFor("maudellery", { size: z })).join("");
      const squares = HUMANS.slice(0, 8)
        .map((h) => avatarFor(h, { size: 40, shape: "square" }))
        .join("");
      b.innerHTML =
        header("People and accounts", "Board 05") +
        section("Humans", "Cut-paper profiles", "Brow, nose, lips, chin, neck, hair and paper-white details all vary with the handle. No skin is drawn.", grid(human)) +
        section("Bots", "One stock profile", "The average face, upright, centred, always facing the same way, on one of three nearly identical greys.", grid(bots)) +
        section("Late wire", "Saturation", "Stage-7 handles, then the blank default face of accounts that have stopped pretending.", `<div class="bb-row" style="gap:4px">${late}</div><div style="height:8px"></div><div class="bb-row" style="gap:4px">${blanks}</div>`) +
        section("Sizes", "16 to 56 px", "Circle (default) and rounded square.", `<div class="bb-row" style="gap:14px;align-items:flex-end">${sizes}<div style="width:18px"></div>${squares}</div>`);
    },
  },
  {
    name: "brand-zoom",
    description: "Marks at large size for detail critique. params: {ids: string[], size, variant}",
    async build(ctx) {
      const b = await stage(ctx);
      const ids = (ctx.params.ids as string[] | undefined) ?? OUTLETS.map((o) => o.id);
      const size = (ctx.params.size as number | undefined) ?? 150;
      const variant = (ctx.params.variant as "mark" | "wordmark" | "lockup" | undefined) ?? "mark";
      let html = `<div class="bb-row" style="gap:30px 40px">`;
      for (const id of ids) {
        const svg = id.startsWith("flag:")
          ? flagFor(id.slice(5), size * 1.5)
          : id.startsWith("morrow:")
            ? morrowMark(id.slice(7) as never, { size })
            : id.startsWith("avatar:")
              ? avatarFor(id.slice(7), { size })
              : id.startsWith("bot:")
                ? avatarFor(id.slice(4), { size, bot: true })
                : logoFor(id, { size, variant });
        html += `<div class="bb-cell" style="outline:1px dashed rgba(0,0,0,.08)">${svg}<div class="bb-mono">${id}</div></div>`;
      }
      b.innerHTML = html + `</div>`;
    },
  },
  {
    name: "brand-thumbs-zoom",
    description: "News plates enlarged for critique. params: {topics?: string[], scale?: number, seed?: string}",
    async build(ctx) {
      const b = await stage(ctx);
      const topics = (ctx.params.topics as string[] | undefined) ?? [...THUMB_TOPICS];
      const scale = (ctx.params.scale as number | undefined) ?? 2;
      const seed = (ctx.params.seed as string | undefined) ?? "a";
      let html = `<div class="bb-row" style="gap:16px 16px">`;
      for (const t of topics) html += `<div class="bb-cell"><div style="outline:1px solid rgba(0,0,0,.14)">${thumbnailFor(t, seed, { width: 160 * scale })}</div><div class="bb-mono">${t}</div></div>`;
      b.innerHTML = html + `</div>`;
    },
  },
  {
    name: "brand-selftest",
    description: "Parses every generated SVG with DOMParser (as the wire does) and reports sizes.",
    async build(ctx) {
      const b = await stage(ctx);
      const wire = brandForWire();
      const groups: Array<[string, string[]]> = [
        ["logos (mark, wordmark, lockup)", LOGO_ENTITIES.flatMap((id) => (["mark", "wordmark", "lockup"] as const).map((v) => logoFor(id, { size: 40, variant: v })))],
        ["logos, unknown ids (monogram)", ["holloway-gazette", "the-meridian", "@growthsignal"].map((id) => logoFor(id, { size: 40, name: id }))],
        ["flags", NATIONS.flatMap((n) => [flagFor(n.id, 60), flagFor(n.id, 60, { uniform: true })])],
        ["thumbnails (2 seeds each)", THUMB_TOPICS.flatMap((t) => [thumbnailFor(t, "a"), thumbnailFor(t, "b")])],
        ["avatars (human, bot, blank)", [...HUMANS.map((h) => avatarFor(h)), ...botHandles(16, "t").map((h) => avatarFor(h, { bot: true })), avatarFor("x", { blank: true })]],
        ["morrow (static + animated)", MORROW_STATES.flatMap((st) => [morrowMark(st), morrowMark(st, { animate: true, size: 16 })])],
        ["wordmarks", [trolleyWordmark(), trolleyWordmark({ variant: "rail" }), morrowLockup({ byline: true })]],
        ["wire adapter", [wire.logo("ledger", { size: 20 }), wire.avatar("a", { bot: false, size: 32 }), wire.thumbnail("economy", "s", { wide: true }), wire.flag("tavrin", 20), wire.seal("common-rail", 30), wire.morrowMark(16)]],
      ];
      let rows = "";
      let failures = 0;
      for (const [label, list] of groups) {
        let bad = 0;
        let bytes = 0;
        let maxBytes = 0;
        let elements = 0;
        for (const svg of list) {
          const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
          if (doc.querySelector("parsererror") || doc.documentElement.nodeName !== "svg") bad++;
          bytes += svg.length;
          maxBytes = Math.max(maxBytes, svg.length);
          elements += doc.getElementsByTagName("*").length;
        }
        failures += bad;
        rows += `<tr><td>${esc(label)}</td><td>${list.length}</td><td>${bad}</td><td>${(bytes / list.length / 1024).toFixed(1)} KB</td><td>${(maxBytes / 1024).toFixed(1)} KB</td><td>${Math.round(elements / list.length)}</td></tr>`;
      }
      // Determinism: the same inputs must produce identical strings.
      const same = thumbnailFor("protest", "x") === thumbnailFor("protest", "x") && avatarFor("q") === avatarFor("q") && logoFor("vela", { variant: "lockup" }) === logoFor("vela", { variant: "lockup" });
      b.innerHTML =
        header("Self-test", "parse · size · determinism") +
        `<table style="border-collapse:collapse;font:12px/1.6 Geist,sans-serif;margin-top:14px" cellpadding="6"><thead><tr style="text-align:left;border-bottom:1px solid #111"><th>group</th><th>count</th><th>parse errors</th><th>mean size</th><th>max size</th><th>mean elements</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="bb-small" style="margin-top:14px">Total parse errors: <b id="st-fail">${failures}</b>. Deterministic output: <b id="st-det">${same ? "yes" : "NO"}</b>.</p>`;
      (window as unknown as { __brandSelftest?: unknown }).__brandSelftest = { failures, deterministic: same };
    },
  },
];
