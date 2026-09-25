/**
 * annotate(): turns authored plain text into a DocumentFragment in which the
 * first occurrence of each glossary term is a focusable
 * <button type="button" class="term" data-term="…">.
 *
 * Text only: authored copy never becomes HTML. Terms never nest. Each button
 * is described (aria-describedby) by a hidden span holding the entry's short
 * definition, so a screen reader hears the definition on focus without having
 * to open anything. The popover (mountGlossary) supplies the rest.
 *
 * Do not annotate text that sits inside another interactive element, such as
 * an option button's label: nested buttons are invalid HTML.
 */
import {
  GLOSSARY,
  glossaryEntry,
  segmentText,
  type GlossaryEntry,
  type MatchOptions,
} from "../../content/glossary.ts";

export interface AnnotateOptions {
  /** Maximum number of terms to wrap in this call. */
  max?: number;
  /** Shared across calls so a term is highlighted once per screen. Mutated. */
  seen?: Set<string>;
  /** Glossary ids never to highlight here. */
  exclude?: Iterable<string>;
  /** Alternative glossary (tests). */
  entries?: readonly GlossaryEntry[];
  /** Document to build in (tests). Defaults to the global document. */
  document?: Document;
  /** Extra class names for the term buttons. */
  className?: string;
}

export const TERM_CLASS = "term";
export const DESCRIPTION_STORE_ID = "gl-descriptions";
export const descriptionId = (id: string) => `gl-desc-${id}`;

/**
 * Ensures a hidden span with the entry's short definition exists in a single
 * store at the end of <body>. Hidden content still supplies a description.
 */
function ensureDescription(doc: Document, entry: GlossaryEntry): void {
  const body = doc.body;
  if (!body || typeof doc.getElementById !== "function") return;
  if (doc.getElementById(descriptionId(entry.id))) return;
  let store = doc.getElementById(DESCRIPTION_STORE_ID);
  if (!store) {
    store = doc.createElement("div");
    store.id = DESCRIPTION_STORE_ID;
    store.hidden = true;
    body.append(store);
  }
  const span = doc.createElement("span");
  span.id = descriptionId(entry.id);
  span.textContent = `${entry.term}: ${entry.short}`;
  store.append(span);
}

export function annotate(
  text: string,
  options: AnnotateOptions = {},
): DocumentFragment {
  const doc = options.document ?? document;
  const entries = options.entries ?? GLOSSARY;
  const lookup = (id: string) =>
    options.entries
      ? entries.find((entry) => entry.id === id)
      : glossaryEntry(id);
  const match: MatchOptions = {
    max: options.max,
    seen: options.seen,
    exclude: options.exclude,
    entries,
  };
  const fragment = doc.createDocumentFragment();
  for (const segment of segmentText(text, match)) {
    if (segment.id === undefined) {
      fragment.append(doc.createTextNode(segment.text));
      continue;
    }
    const entry = lookup(segment.id);
    const button = doc.createElement("button");
    button.type = "button";
    button.className = options.className
      ? `${TERM_CLASS} ${options.className}`
      : TERM_CLASS;
    button.setAttribute("data-term", segment.id);
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    if (entry) ensureDescription(doc, entry);
    button.setAttribute("aria-describedby", descriptionId(segment.id));
    button.textContent = segment.text;
    fragment.append(button);
  }
  return fragment;
}

/** Convenience: replace an element's children with annotated text. */
export function annotateInto(
  host: HTMLElement,
  text: string,
  options: AnnotateOptions = {},
): HTMLElement {
  host.replaceChildren(
    annotate(text, { document: host.ownerDocument, ...options }),
  );
  return host;
}
