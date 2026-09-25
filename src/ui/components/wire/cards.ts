/**
 * Card DOM. One <article> per entry; the article element is the keyed node
 * and is never replaced (only its children are, when its content changes),
 * so focus, hover and read state survive every update.
 */
import { icon, verifiedBadge, wireBrand } from "./brand-bridge.ts";
import {
  detailLine,
  formatCompact,
  noticeRef,
  postStamp,
  similarLabel,
  stackHandles,
} from "./details.ts";
import { hash32 } from "./hash.ts";
import type { WireEntry } from "./saturation.ts";

export interface CardContext {
  today: number | null;
  botSaturation: number;
  idPrefix: string;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = "",
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function box(cls: string, child: Element, label?: string) {
  const span = h("span", cls);
  span.append(child);
  if (label) {
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", label);
  } else span.setAttribute("aria-hidden", "true");
  return span;
}

export function cardIds(entry: WireEntry, ctx: CardContext) {
  const base = `${ctx.idPrefix}-${hash32(entry.key).toString(36)}`;
  return { title: `${base}-t`, who: `${base}-w`, detail: `${base}-d` };
}

/** Everything that changes what the card shows. */
export function cardSignature(entry: WireEntry, ctx: CardContext): string {
  const i = entry.item;
  return [
    i.id,
    i.kind,
    i.text,
    i.source.name,
    i.source.handle ?? "",
    i.severity,
    i.breaking ? 1 : 0,
    entry.dateLabel,
    entry.similar,
    entry.thinned ? 1 : 0,
    entry.collapsedAvatar ? 1 : 0,
    entry.verified ? 1 : 0,
    i.engagement
      ? `${i.engagement.replies}/${i.engagement.reposts}/${i.engagement.likes}`
      : "",
    detailLine(entry, ctx.today, ctx.botSaturation),
  ].join("\u0001");
}

function timeEl(entry: WireEntry, text = entry.dateLabel) {
  const t = h("time", "wr-time", text);
  if (text !== entry.dateLabel) t.title = entry.dateLabel;
  if (entry.collapsedTime) t.classList.add("is-collapsed");
  return t;
}

function unreadDot() {
  const dot = h("span", "wr-unread");
  dot.setAttribute("aria-hidden", "true");
  return dot;
}

function detail(entry: WireEntry, ctx: CardContext, id: string) {
  const wrap = h("div", "wr-detail");
  const p = h(
    "p",
    "wr-detail-in",
    detailLine(entry, ctx.today, ctx.botSaturation),
  );
  p.id = id;
  wrap.append(p);
  return wrap;
}

const DESKS: Record<string, string> = {
  markets: "Markets",
  datacenter: "Compute",
  lab: "Technology",
  health: "Health",
  grid: "Energy",
  rail: "Transport",
  security: "Security",
  civic: "Politics",
  labor: "Labor",
  disaster: "Climate",
  science: "Science",
  food: "Food",
  general: "World",
};

export function deskLabel(topic: string): string {
  const key = topic.toLowerCase();
  return (
    DESKS[key] ??
    topic.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

function fillHeadline(
  article: HTMLElement,
  entry: WireEntry,
  ctx: CardContext,
) {
  const item = entry.item;
  const ids = cardIds(entry, ctx);
  const hero =
    Boolean(item.thumbnailTopic) && (item.breaking || item.severity >= 1);
  article.classList.toggle("is-hero", hero);
  article.classList.toggle("is-breaking", item.breaking);
  const by = h("div", "wr-by");
  by.append(
    box(
      "wr-logo",
      wireBrand.logo(item.source.id, { size: 16, name: item.source.name }),
    ),
  );
  const src = h("span", "wr-src", item.source.name);
  src.id = ids.who;
  by.append(src);
  if (item.breaking) {
    const k = h("span", "wr-kicker", "Breaking");
    by.append(k);
  } else by.append(h("span", "wr-desk", deskLabel(item.topic)));
  by.append(h("span", "wr-fill"), unreadDot(), timeEl(entry));
  article.append(by);
  if (hero && item.thumbnailTopic) {
    const fig = h("figure", "wr-hero");
    fig.append(
      wireBrand.thumbnail(item.thumbnailTopic, item.id, { wide: true }),
    );
    fig.setAttribute("aria-hidden", "true");
    article.append(fig);
  }
  const body = h("div", "wr-body");
  const title = h("h3", "wr-hl", item.text);
  title.id = ids.title;
  body.append(title);
  if (!hero && item.thumbnailTopic) {
    const fig = h("figure", "wr-thumb");
    fig.setAttribute("aria-hidden", "true");
    fig.append(
      wireBrand.thumbnail(item.thumbnailTopic, item.id, { wide: false }),
    );
    body.append(fig);
  }
  article.append(body);
  if (entry.alsoCarriedBy.length) {
    const also = h("div", "wr-also");
    for (const name of entry.alsoCarriedBy.slice(0, 3)) {
      const chip = h("span", "wr-also-chip");
      chip.append(
        box(
          "wr-logo wr-logo-sm",
          wireBrand.logo(
            name
              .toLowerCase()
              .replace(/^the\s+/, "")
              .replace(/\s+/g, "-"),
            { size: 12, name },
          ),
        ),
        document.createTextNode(name),
      );
      also.append(chip);
    }
    article.append(also);
  }
  article.append(detail(entry, ctx, ids.detail));
  article.setAttribute("aria-labelledby", `${ids.title} ${ids.who}`);
}

function engagementRow(entry: WireEntry) {
  const e = entry.item.engagement;
  const row = h("div", "wr-eng");
  if (!e) return row;
  const cell = (name: string, n: number, label: string) => {
    const span = h("span", "wr-eng-cell");
    const visible = h("span", "wr-eng-n", formatCompact(n));
    visible.setAttribute("aria-hidden", "true");
    span.append(
      box("wr-eng-ic", icon(name, 13)),
      visible,
      h("span", "wr-sr", `${n.toLocaleString("en-US")} ${label}`),
    );
    return span;
  };
  row.append(
    cell("reply", e.replies, "replies"),
    cell("repost", e.reposts, "reposts"),
    cell("like", e.likes, "likes"),
  );
  return row;
}

function fillPost(article: HTMLElement, entry: WireEntry, ctx: CardContext) {
  const item = entry.item;
  const ids = cardIds(entry, ctx);
  article.classList.toggle("is-thinned", entry.thinned);
  article.classList.toggle("is-pile", entry.similar > 0);
  article.classList.toggle("is-faceless", entry.collapsedAvatar);
  const wrap = h("div", "wr-post");
  const av = h("div", "wr-av");
  av.setAttribute("aria-hidden", "true");
  if (entry.thinned) av.classList.add("is-void");
  else
    av.append(
      wireBrand.avatar(item.source.handle ?? item.source.id, {
        bot: item.isBot,
        blank: entry.collapsedAvatar,
        size: 36,
      }),
    );
  const main = h("div", "wr-main");
  const row = h("div", "wr-who");
  const who = h("span", "wr-who-in");
  who.id = ids.who;
  if (entry.thinned) {
    who.append(
      h(
        "span",
        "wr-handle is-struck",
        `@${item.source.handle ?? item.source.id}`,
      ),
    );
  } else {
    who.append(h("span", "wr-name", item.source.name));
    if (entry.verified) {
      const badge = box("wr-badge", verifiedBadge(13), "Verified");
      who.append(badge);
    }
    if (item.source.handle)
      who.append(h("span", "wr-handle", `@${item.source.handle}`));
  }
  row.append(who, unreadDot(), timeEl(entry, postStamp(entry, ctx.today)));
  main.append(row);
  const text = h(
    "p",
    "wr-text",
    entry.thinned ? "This account no longer exists." : item.text,
  );
  if (entry.thinned) text.classList.add("wr-tomb");
  text.id = ids.title;
  main.append(text);
  if (!entry.thinned) main.append(engagementRow(entry));
  if (entry.similar > 0) {
    const pile = h("div", "wr-pile");
    const faces = h("span", "wr-pile-faces");
    faces.setAttribute("aria-hidden", "true");
    for (const handle of stackHandles(entry, 4))
      faces.append(
        wireBrand.avatar(handle, {
          bot: true,
          blank: entry.collapsedAvatar,
          size: 18,
        }),
      );
    pile.append(faces, h("span", "wr-pile-n", similarLabel(entry.similar)));
    main.append(pile);
  }
  main.append(detail(entry, ctx, ids.detail));
  wrap.append(av, main);
  article.append(wrap);
  article.setAttribute("aria-labelledby", `${ids.who} ${ids.title}`);
}

function fillStatement(
  article: HTMLElement,
  entry: WireEntry,
  ctx: CardContext,
) {
  const item = entry.item;
  const ids = cardIds(entry, ctx);
  const wrap = h("div", "wr-notice");
  const mark = h("div", "wr-seal");
  mark.setAttribute("aria-hidden", "true");
  mark.append(
    item.source.nationId
      ? wireBrand.flag(item.source.nationId, 30)
      : wireBrand.seal(item.source.id, 30),
  );
  const main = h("div", "wr-main");
  const row = h("div", "wr-by");
  row.append(
    h("span", "wr-kick", "Official notice"),
    h("span", "wr-fill"),
    unreadDot(),
    timeEl(entry),
  );
  const issuer = h("div", "wr-issuer", item.source.name);
  issuer.id = ids.who;
  const text = h("p", "wr-text wr-text-notice", item.text);
  text.id = ids.title;
  const ref = h("div", "wr-ref", `Ref. ${noticeRef(entry)}`);
  main.append(row, issuer, text, ref, detail(entry, ctx, ids.detail));
  wrap.append(mark, main);
  article.append(wrap);
  article.setAttribute("aria-labelledby", `${ids.who} ${ids.title}`);
}

function fillMorrow(article: HTMLElement, entry: WireEntry, ctx: CardContext) {
  const item = entry.item;
  const ids = cardIds(entry, ctx);
  const by = h("div", "wr-by");
  by.append(box("wr-logo wr-logo-morrow", wireBrand.morrowMark(16)));
  const src = h("span", "wr-src wr-src-morrow", "Morrow");
  src.id = ids.who;
  by.append(
    src,
    h("span", "wr-desk", "Vela"),
    h("span", "wr-fill"),
    unreadDot(),
    timeEl(entry),
  );
  const text = h("p", "wr-text wr-text-morrow", item.text);
  text.id = ids.title;
  article.append(by, text, detail(entry, ctx, ids.detail));
  article.setAttribute("aria-labelledby", `${ids.who} ${ids.title}`);
}

/** Replace the card's children. The article element itself persists. */
export function fillCard(
  article: HTMLElement,
  entry: WireEntry,
  ctx: CardContext,
): void {
  const kind = entry.item.kind;
  // State lives in data-* attributes (data-read, data-open), not classes, so
  // resetting the class list here never loses it.
  article.className = `wr-card wr-card--${kind}`;
  article.replaceChildren();
  if (kind === "headline") fillHeadline(article, entry, ctx);
  else if (kind === "post") fillPost(article, entry, ctx);
  else if (kind === "statement") fillStatement(article, entry, ctx);
  else fillMorrow(article, entry, ctx);
  article.setAttribute("aria-describedby", cardIds(entry, ctx).detail);
}
