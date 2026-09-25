/**
 * renderGlossaryIndex(): the whole glossary as a searchable reference list,
 * for a "Glossary" drawer or the debrief. Every entry is readable without
 * hover: definition, "Read more" disclosure, registry sources and related
 * terms (which jump within the list).
 */
import {
  DOMAIN_LABEL,
  GLOSSARY,
  sourceLinks,
  type GlossaryDomain,
  type GlossaryEntry,
} from "../../content/glossary.ts";

export interface GlossaryIndexOptions {
  /** Initial search text. */
  query?: string;
  /** Scroll to and highlight this entry after rendering. */
  focusId?: string;
  /** Heading level for domain groups (default 3; entries use one level deeper). */
  headingLevel?: 2 | 3;
  entries?: readonly GlossaryEntry[];
  onSourceOpen?: (sourceId: string, termId: string) => void;
}

export interface GlossaryIndexHandle {
  readonly element: HTMLElement;
  setQuery(query: string): void;
  reveal(id: string): void;
  destroy(): void;
}

const ORDER: GlossaryDomain[] = [
  "ethics",
  "decision",
  "evidence",
  "safety",
  "systems",
  "governance",
  "economy",
  "rail",
];
let indexes = 0;

function normalise(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, "'");
}

export function renderGlossaryIndex(
  host: HTMLElement,
  options: GlossaryIndexOptions = {},
): GlossaryIndexHandle {
  const doc = host.ownerDocument;
  const uid = `gli-${++indexes}`;
  const entries = options.entries ?? GLOSSARY;
  const level = options.headingLevel ?? 3;
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
  const entryDomId = (id: string) => `${uid}-${id}`;

  const root = el("section", "gli");
  root.setAttribute("aria-label", "Glossary");
  const bar = el("div", "gli-bar");
  const label = el("label", "gli-search-label", "Search the glossary");
  label.htmlFor = `${uid}-q`;
  const input = el("input", "gli-search");
  input.type = "search";
  input.id = `${uid}-q`;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = "Search terms";
  const count = el("p", "gli-count");
  count.id = `${uid}-count`;
  count.setAttribute("aria-live", "polite");
  input.setAttribute("aria-describedby", count.id);
  bar.append(label, input, count);
  root.append(bar);

  const rows = new Map<
    string,
    { row: HTMLElement; haystack: string; group: HTMLElement }
  >();
  const groups: HTMLElement[] = [];
  for (const domain of ORDER) {
    const list = entries
      .filter((e) => e.domain === domain)
      .sort((a, b) => a.term.localeCompare(b.term));
    if (!list.length) continue;
    const group = el("section", "gli-group");
    const h = el(`h${level}` as "h3", "gli-domain", DOMAIN_LABEL[domain]);
    h.id = `${uid}-d-${domain}`;
    group.setAttribute("aria-labelledby", h.id);
    const dl = el("div", "gli-list");
    for (const entry of list) {
      const row = el("article", "gli-entry");
      row.id = entryDomId(entry.id);
      row.tabIndex = -1;
      const title = el(`h${level + 1}` as "h4", "gli-term", entry.term);
      row.append(title, el("p", "gli-short", entry.short));
      if (entry.long) {
        const more = el("div", "gli-more");
        more.id = `${row.id}-more`;
        more.hidden = true;
        more.append(el("p", "", entry.long));
        const toggle = el("button", "gli-toggle", "Read more");
        toggle.type = "button";
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-controls", more.id);
        toggle.addEventListener("click", () => {
          const open = toggle.getAttribute("aria-expanded") !== "true";
          toggle.setAttribute("aria-expanded", String(open));
          toggle.textContent = open ? "Show less" : "Read more";
          more.hidden = !open;
        });
        row.append(more, toggle);
      }
      const links = sourceLinks(entry.sourceIds).filter((s) => s.url);
      if (links.length) {
        const ul = el("ul", "gli-sources");
        ul.setAttribute("aria-label", `Sources for ${entry.term}`);
        for (const s of links) {
          const li = el("li");
          const a = el("a", "gli-source");
          a.href = s.url!;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.append(
            el("span", "gli-source-title", s.title),
            el("span", "gli-source-host", s.host),
            el("span", "gl-sr", " (opens in a new tab)"),
          );
          a.addEventListener("click", () =>
            options.onSourceOpen?.(s.id, entry.id),
          );
          li.append(a);
          ul.append(li);
        }
        row.append(ul);
      }
      const related = (entry.related ?? []).filter((id) =>
        entries.some((e) => e.id === id),
      );
      if (related.length) {
        const p = el("p", "gli-related");
        p.append(el("span", "gli-label", "See also"));
        for (const id of related) {
          const target = entries.find((e) => e.id === id)!;
          const a = el("a", "gli-rel", target.term);
          a.href = `#${entryDomId(id)}`;
          a.addEventListener("click", (event) => {
            event.preventDefault();
            api.reveal(id);
          });
          p.append(a);
        }
        row.append(p);
      }
      dl.append(row);
      rows.set(entry.id, {
        row,
        group,
        haystack: normalise(
          [entry.term, ...entry.aliases, entry.short, entry.long ?? ""].join(
            " ",
          ),
        ),
      });
    }
    group.append(h, dl);
    groups.push(group);
    root.append(group);
  }
  const empty = el("p", "gli-empty", "No term matches. Try a shorter word.");
  empty.hidden = true;
  root.append(empty);
  host.append(root);

  function filter(query: string) {
    const q = normalise(query.trim());
    let shown = 0;
    for (const { row, haystack } of rows.values()) {
      const hit = !q || haystack.includes(q);
      row.hidden = !hit;
      if (hit) shown++;
    }
    for (const group of groups)
      group.hidden = ![
        ...group.querySelectorAll<HTMLElement>(".gli-entry"),
      ].some((r) => !r.hidden);
    empty.hidden = shown > 0;
    count.textContent = q
      ? `${shown} of ${rows.size} terms`
      : `${rows.size} terms`;
  }
  input.addEventListener("input", () => filter(input.value));
  input.value = options.query ?? "";
  filter(input.value);

  const api: GlossaryIndexHandle = {
    element: root,
    setQuery(query: string) {
      input.value = query;
      filter(query);
    },
    reveal(id: string) {
      const target = rows.get(id);
      if (!target) return;
      if (target.row.hidden) {
        input.value = "";
        filter("");
      }
      for (const { row } of rows.values()) row.classList.remove("is-target");
      target.row.classList.add("is-target");
      target.row.scrollIntoView?.({ block: "nearest" });
      target.row.focus({ preventScroll: true });
    },
    destroy() {
      root.remove();
    },
  };
  if (options.focusId) api.reveal(options.focusId);
  return api;
}
