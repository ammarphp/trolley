/**
 * Pure planning for the rolling digit window. Each digit cell is a strip of
 * twenty numerals (0–9, 0–9); position p shows digit p % 10. Rolling up from 9
 * to 2 travels 9 → 12, one short hop through 0, instead of spinning backwards
 * through every numeral. After a roll the strip snaps to the canonical p % 10.
 */

export interface CellPlan {
  char: string;
  digit: boolean;
  /** True when the existing cell at this right-aligned slot is kept. */
  reuse: boolean;
  /** Strip positions for digits (null for separators and signs). */
  from: number | null;
  to: number | null;
}

const isDigit = (c: string) => c >= "0" && c <= "9";

/**
 * Plan a transition from the old cell characters to `text`, aligned from the
 * right so units stay units. `dir` is the sign of the numeric change.
 * `spin` makes freshly created digits travel a full turn (boot self-test).
 */
export function planCells(
  old: readonly string[],
  text: string,
  dir: number,
  spin = false,
): CellPlan[] {
  const next = [...text];
  const plans: CellPlan[] = [];
  for (let k = 0; k < next.length; k++) {
    const char = next[next.length - 1 - k]!;
    const prev = old[old.length - 1 - k];
    const digit = isDigit(char);
    if (!digit) {
      plans.push({ char, digit, reuse: prev === char, from: null, to: null });
      continue;
    }
    const d = Number(char);
    if (prev !== undefined && isDigit(prev)) {
      const o = Number(prev);
      if (dir < 0)
        plans.push({
          char,
          digit,
          reuse: true,
          from: o + 10,
          to: d <= o ? d + 10 : d,
        });
      else
        plans.push({
          char,
          digit,
          reuse: true,
          from: o,
          to: d >= o ? d : d + 10,
        });
    } else {
      plans.push({ char, digit, reuse: false, from: 0, to: spin ? d + 10 : d });
    }
  }
  return plans.reverse();
}
