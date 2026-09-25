/**
 * renderHistoryCard(): the "history of this dilemma" card for the details
 * drawer (or inline, collapsed, under a decision).
 *
 * A disclosure (APG pattern: a button inside the heading, aria-expanded,
 * aria-controls) over: the distinction under test, a lineage paragraph with
 * glossary terms highlighted, a reference timeline that separates registry
 * sources from bibliographic references, how the game adapts the case, and
 * any evidence note. Collapsed content is `hidden`, so nothing is reachable
 * only through animation.
 */
import {
  BIBLIOGRAPHIC_LABEL,
  FAMILY_LABEL,
  type HistoryCard,
  type HistoryReference,
} from "../../content/history.ts";
import { registrySource, sourceHost } from "../../content/glossary.ts";
import { annotate } from "./annotate.ts";

export interface HistoryCardOptions {
  /** Render the body behind a disclosure button (default true). */
  collapsible?: boolean;
  /** Initial state when collapsible (default false). */
  expanded?: boolean;
  /** Highlight glossary terms in the lineage (default true). Needs mountGlossary() for the popover. */
  annotate?: boolean;
  /** Shared "seen" set so terms highlighted elsewhere on screen are not repeated. */
  seen?: Set<string>;
  /** Heading level for the card title (default 3). */
  headingLevel?: 2 | 3 | 4;
  /** "card" draws its own glass surface; "plain" for hosts that already are one. */
  surface?: "card" | "plain";
  reducedMotion?: boolean;
  onToggle?: (expanded: boolean) => void;
  /** A registry link was activated (it opens in a new tab). */
  onSourceOpen?: (registryId: string) => void;
}

export interface HistoryCardHandle {
  readonly element: HTMLElement;
  readonly expanded: boolean;
  setExpanded(value: boolean): void;
  destroy(): void;
}

let cards = 0;

function yearSpan(refs: HistoryReference[]): string {
  const years = refs
    .map((r) => r.year)
    .filter((y): y is number => typeof y === "number");
  if (!years.length) return "";
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

export function renderHistoryCard(
  host: HTMLElement,
  card: HistoryCard,
  options: HistoryCardOptions = {},
): HistoryCardHandle {
  const doc = host.ownerDocument;
  const uid = `ghc-${++cards}`;
  const collapsible = options.collapsible ?? true;
  let expanded = collapsible ? (options.expanded ?? false) : true;
  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    cls = "",
    text?: string,
  ) => {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const root = el("article", "ghc");
  root.dataset.family = card.family;
  root.dataset.surface = options.surface ?? "card";
  if (options.reducedMotion) root.dataset.motion = "reduced";
  root.setAttribute("aria-labelledby", `${uid}-title`);

  /* ------------------------------------------------------------- head */
  const head = el("header", "ghc-head");
  const kicker = el("p", "ghc-kicker");
  kicker.append(
    el("span", "ghc-kicker-main", "History of the dilemma"),
    el("span", "ghc-family", FAMILY_LABEL[card.family]),
  );
  const heading = el(`h${options.headingLevel ?? 3}` as "h3", "ghc-title");
  heading.id = `${uid}-title`;
  const body = el("div", "ghc-body");
  body.id = `${uid}-body`;
  let toggle: HTMLButtonElement | null = null;
  if (collapsible) {
    toggle = el("button", "ghc-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-controls", body.id);
    const chevron = el("span", "ghc-chevron");
    chevron.setAttribute("aria-hidden", "true");
    toggle.append(el("span", "ghc-title-text", card.title), chevron);
    heading.append(toggle);
  } else heading.textContent = card.title;

  const distinction = el("p", "ghc-distinction");
  distinction.id = `${uid}-tests`;
  distinction.append(
    el("span", "ghc-label", "Tests"),
    doc.createTextNode(card.distinction),
  );
  if (toggle) toggle.setAttribute("aria-describedby", distinction.id);

  const refs = [...card.references].sort(
    (a, b) => (a.year ?? 9999) - (b.year ?? 9999),
  );
  const registryCount = refs.filter((r) => r.verified === "registry").length;
  const meta = el("p", "ghc-meta");
  const span = yearSpan(refs);
  const metaParts = [
    refs.length
      ? `${refs.length} ${refs.length === 1 ? "reference" : "references"}`
      : "No references",
    registryCount ? `${registryCount} in registry` : "",
    span,
  ].filter(Boolean);
  meta.textContent = metaParts.join(" · ");
  head.append(kicker, heading, distinction, meta);

  /* ------------------------------------------------------------- body */
  const lineage = el("p", "ghc-lineage");
  if (options.annotate === false) lineage.textContent = card.lineage;
  else
    lineage.append(
      annotate(card.lineage, { document: doc, seen: options.seen }),
    );
  body.append(lineage);

  if (refs.length || card.adaptation) {
    const section = el("section", "ghc-timeline");
    const label = el("h4", "ghc-label", "Lineage");
    label.id = `${uid}-refs`;
    section.setAttribute("aria-labelledby", label.id);
    const list = el("ol", "ghc-refs");
    for (const ref of refs) {
      const item = el("li", "ghc-ref");
      item.dataset.verified = ref.verified;
      const year = el("span", "ghc-year", ref.year ? String(ref.year) : "n.d.");
      const node = el("span", "ghc-node");
      node.setAttribute("aria-hidden", "true");
      const content = el("div", "ghc-ref-body");
      content.append(el("p", "ghc-cite", ref.citation));
      const row = el("p", "ghc-ref-meta");
      if (ref.verified === "registry" && ref.registryId) {
        const source = registrySource(ref.registryId);
        row.append(el("span", "ghc-badge", "In project registry"));
        if (source?.url) {
          const a = el("a", "ghc-link");
          a.href = source.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.append(
            el("span", "", sourceHost(source.url)),
            el("span", "gl-sr", " (opens in a new tab)"),
          );
          a.addEventListener("click", () =>
            options.onSourceOpen?.(ref.registryId!),
          );
          row.append(a);
        }
        content.append(row);
        if (source?.limits.length) {
          const limits = el("p", "ghc-limits");
          limits.append(
            el("span", "ghc-label", "Limits"),
            doc.createTextNode(source.limits.join(" ")),
          );
          content.append(limits);
        }
      } else {
        // Reads as BIBLIOGRAPHIC_LABEL; drawn as a dashed badge plus a plain qualifier.
        const [kind, qualifier] = BIBLIOGRAPHIC_LABEL.split(", ");
        row.append(
          el("span", "ghc-badge ghc-badge-bib", kind),
          el("span", "gl-sr", ", "),
          el("span", "ghc-unverified", qualifier),
        );
        content.append(row);
      }
      item.append(year, node, content);
      list.append(item);
    }
    if (card.adaptation) {
      const item = el("li", "ghc-ref ghc-here");
      const node = el("span", "ghc-node");
      node.setAttribute("aria-hidden", "true");
      const content = el("div", "ghc-ref-body");
      const cite = el("p", "ghc-cite");
      cite.append(
        el("span", "gl-sr", "In this game: "),
        doc.createTextNode(card.adaptation),
      );
      content.append(cite);
      const year = el("span", "ghc-year", "Here");
      year.setAttribute("aria-hidden", "true");
      item.append(year, node, content);
      list.append(item);
    }
    section.append(label, list);
    body.append(section);
  }

  if (card.note) {
    const note = el("p", "ghc-note");
    note.append(
      el("span", "ghc-label", "Evidence note"),
      doc.createTextNode(card.note),
    );
    body.append(note);
  }

  root.append(head, body);
  host.append(root);

  function apply() {
    root.dataset.expanded = String(expanded);
    body.hidden = !expanded;
    toggle?.setAttribute("aria-expanded", String(expanded));
  }
  apply();
  toggle?.addEventListener("click", () => {
    expanded = !expanded;
    apply();
    options.onToggle?.(expanded);
  });

  return {
    element: root,
    get expanded() {
      return expanded;
    },
    setExpanded(value: boolean) {
      if (!collapsible) return;
      expanded = value;
      apply();
    },
    destroy() {
      root.remove();
    },
  };
}
