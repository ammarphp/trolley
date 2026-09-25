/**
 * A mechanical digit window. Each digit is a clipped strip of numerals that
 * rolls to its new position; separators, signs and letters are static glyphs.
 * The window is decorative (aria-hidden): the gauge carries the full-precision
 * reading as text for assistive technology.
 */
import { planCells } from "./odometer-plan.ts";

const STRIP = "0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n1\n2\n3\n4\n5\n6\n7\n8\n9";

interface Cell {
  char: string;
  el: HTMLElement;
  strip: HTMLElement | null;
  anim: Animation | null;
}

export interface RollOptions {
  animate: boolean;
  /** Sign of the numeric change; chooses the roll direction. */
  dir?: number;
  /** Fresh digits make a full turn before settling (boot self-test). */
  spin?: boolean;
  delay?: number;
  duration?: number;
  /** Extra delay per place, counted from the units digit leftward. */
  stagger?: number;
}

const position = (p: number) => `translateY(${-p * 5}%)`;

function createCell(char: string): Cell {
  if (char >= "0" && char <= "9") {
    const el = document.createElement("span");
    el.className = "ins-odo-d";
    const strip = document.createElement("span");
    strip.className = "ins-odo-strip";
    strip.textContent = STRIP;
    strip.style.transform = position(Number(char));
    el.append(strip);
    return { char, el, strip, anim: null };
  }
  const el = document.createElement("span");
  el.className =
    char === "," || char === "." ? "ins-odo-g ins-odo-sep" : "ins-odo-g";
  el.textContent = char === " " ? "\u00a0" : char;
  return { char, el, strip: null, anim: null };
}

export class Odometer {
  readonly el: HTMLSpanElement;
  private cells: Cell[] = [];

  constructor(className = "") {
    this.el = document.createElement("span");
    this.el.className = `ins-odo ${className}`.trim();
    this.el.setAttribute("aria-hidden", "true");
  }

  get text(): string {
    return this.cells.map((c) => c.char).join("");
  }

  set(text: string, o: RollOptions): void {
    const plan = planCells(
      this.cells.map((c) => c.char),
      text,
      o.dir ?? 1,
      o.spin,
    );
    const old = this.cells;
    const n = plan.length;
    const m = old.length;
    const next: Cell[] = new Array(n);
    for (let k = 0; k < Math.max(n, m); k++) {
      const p = plan[n - 1 - k];
      const prev = old[m - 1 - k];
      if (!p) {
        prev?.anim?.cancel();
        prev?.el.remove();
        continue;
      }
      let cell: Cell;
      if (p.reuse && prev) {
        cell = prev;
        cell.char = p.char;
      } else {
        cell = createCell(p.char);
        if (prev) {
          prev.anim?.cancel();
          prev.el.replaceWith(cell.el);
        } else this.el.prepend(cell.el);
      }
      next[n - 1 - k] = cell;
    }
    this.cells = next;

    const duration = o.duration ?? 720;
    for (let i = 0; i < n; i++) {
      const p = plan[i]!;
      const cell = next[i]!;
      if (!cell.strip || p.from === null || p.to === null) continue;
      cell.anim?.cancel();
      cell.anim = null;
      cell.strip.style.transform = position(p.to % 10);
      if (
        !o.animate ||
        p.from === p.to ||
        typeof cell.strip.animate !== "function"
      )
        continue;
      const place = n - 1 - i;
      cell.anim = cell.strip.animate(
        [{ transform: position(p.from) }, { transform: position(p.to) }],
        {
          duration: duration + place * 40,
          delay: (o.delay ?? 0) + (o.stagger ?? 0) * place,
          easing: "cubic-bezier(0.2, 0.9, 0.25, 1)",
          fill: "backwards",
        },
      );
    }
  }

  /** Jump every rolling digit to its resting place. */
  finish(): void {
    for (const c of this.cells) {
      try {
        c.anim?.finish();
      } catch {
        /* cancelled animations cannot finish; the resting transform is already set */
      }
    }
  }
}
