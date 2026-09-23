/** sha256-counter-v1: canonical UTF-8 JSON tuple, first 32 bits big-endian,
 * rejection sampling. Namespaces and instance keys are part of the public format.
 * This is reproducible simulation randomness, not a secret or security token. */
export function canonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite canonical number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (
    typeof value === "object" &&
    value &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  ) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  throw new Error("Non-JSON value in canonical state");
}

export async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}

export async function draw(
  seed: string,
  domain: string,
  instance: string,
  name: string,
  bound: number,
): Promise<number> {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 0x100000000)
    throw new Error("Invalid random bound");
  const limit = Math.floor(0x100000000 / bound) * bound;
  for (let counter = 0; counter < 1024; counter++) {
    const digest = await sha256([
      "sha256-counter-v1",
      seed,
      domain,
      instance,
      name,
      counter,
    ]);
    const value = Number.parseInt(digest.slice(0, 8), 16);
    if (value < limit) return value % bound;
  }
  throw new Error("Random rejection limit exceeded");
}
