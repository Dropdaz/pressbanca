export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |err| < 1.5e-7). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** z-score that leaves `p` of a normal distribution below it, for the few levels we use. */
export const Z80 = 1.2816;

/** Fraction of `others` below `v` (ties count half). Returns 0.5 when there is nothing to compare. */
export function percentile(v: number, others: number[]): number {
  if (!others.length) return 0.5;
  let below = 0;
  for (const o of others) below += o < v ? 1 : o === v ? 0.5 : 0;
  return below / others.length;
}

/** Run `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Deterministic PRNG (mulberry32) seeded from a string — used by demo data. */
export function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
    int: (lo: number, hi: number) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)],
    normal: (mu = 0, sd = 1) => mu + sd * Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()),
    chance: (p: number) => next() < p,
  };
}
export type Rng = ReturnType<typeof rng>;
