/*
 * Typed flags for the scripts. A boolean flag never consumes the token after
 * it, a value flag always needs one, an unknown flag or a bare word is
 * refused, and a value may be given as `--name value` or `--name=value`.
 *
 * Before this, `arg("no-store")` returned the next argv token, so
 * `--no-store --save out.json` read as store true and a measurement told not
 * to store packets stored them (review four, finding 12).
 */

export interface FlagSpec<B extends string, V extends string> {
  booleans: readonly B[];
  values: readonly V[];
}

export interface Flags<B extends string, V extends string> {
  booleans: Record<B, boolean>;
  values: Partial<Record<V, string>>;
}

export class FlagError extends Error {}

export function parseFlags<B extends string, V extends string>(argv: readonly string[], spec: FlagSpec<B, V>): Flags<B, V> {
  const booleans = Object.fromEntries(spec.booleans.map((b) => [b, false])) as Record<B, boolean>;
  const values: Partial<Record<V, string>> = {};
  const isBoolean = (n: string): n is B => (spec.booleans as readonly string[]).includes(n);
  const isValue = (n: string): n is V => (spec.values as readonly string[]).includes(n);
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) throw new FlagError(`unexpected argument "${token}"; flags start with --`);
    const eq = token.indexOf("=");
    const name = eq >= 0 ? token.slice(2, eq) : token.slice(2);
    const inline = eq >= 0 ? token.slice(eq + 1) : undefined;
    if (isBoolean(name)) {
      if (inline !== undefined) throw new FlagError(`--${name} takes no value`);
      booleans[name] = true;
    } else if (isValue(name)) {
      if (name in values) throw new FlagError(`--${name} given twice`);
      const next = inline ?? argv[i + 1];
      if (next === undefined || (inline === undefined && next.startsWith("--"))) throw new FlagError(`--${name} needs a value`);
      values[name] = next;
      if (inline === undefined) i++;
    } else {
      throw new FlagError(`unknown flag --${name}; known: ${[...spec.booleans, ...spec.values].map((n) => `--${n}`).join(", ")}`);
    }
  }
  return { booleans, values };
}

/** A positive integer, or the default when the flag is absent. Anything else is refused. */
export function positiveInteger(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1) throw new FlagError(`--${name} must be a positive integer, got "${value}"`);
  return Number(value);
}

/** One of the allowed words, or undefined when the flag is absent. Anything else is refused. */
export function oneOf<T extends string>(value: string | undefined, name: string, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) throw new FlagError(`--${name} must be one of ${allowed.join(", ")}, got "${value}"`);
  return value as T;
}
