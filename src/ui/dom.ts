/** Text-only DOM construction: authored copy never becomes executable HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = "",
  text?: string,
) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function button(text: string, action: () => void, cls = "") {
  const node = el("button", cls, text);
  node.type = "button";
  node.onclick = action;
  return node;
}
export function append(
  parent: HTMLElement,
  ...children: (HTMLElement | string | null)[]
) {
  for (const child of children) if (child !== null) parent.append(child);
  return parent;
}
