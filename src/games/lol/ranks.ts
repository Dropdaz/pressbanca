import type { LadderTier, RankLabel } from '@/core/types';

/**
 * LoL rating scale used by the estimator: every division is 100 points wide and LP fills it.
 * Iron IV 0 LP = 400 (anything below is still Iron IV), Gold IV = 1600, Diamond I 99 LP = 3199,
 * Master+ = 3200 + LP. Matches the ladder card: Iron < 800, Bronze 800–1199 … Diamond 2800–3199.
 */

export const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'] as const;
export type Tier = (typeof TIERS)[number];
const DIVISIONS = ['IV', 'III', 'II', 'I'] as const;
const APEX_BASE = 3200;
const IRON_BASE = 400;
/** Rough LP cut-offs used only to label apex ratings (they move every day on the real ladder). */
const GM_LP = 250;
const CHALL_LP = 700;

const TIER_META: Record<Tier, { name: string; short: string; color: string }> = {
  IRON: { name: 'Hierro', short: 'Hierro', color: 'var(--t-iron)' },
  BRONZE: { name: 'Bronce', short: 'Bronce', color: 'var(--t-bronze)' },
  SILVER: { name: 'Plata', short: 'Plata', color: 'var(--t-silver)' },
  GOLD: { name: 'Oro', short: 'Oro', color: 'var(--t-gold)' },
  PLATINUM: { name: 'Platino', short: 'Plat', color: 'var(--t-plat)' },
  EMERALD: { name: 'Esmeralda', short: 'Esme', color: 'var(--t-emerald)' },
  DIAMOND: { name: 'Diamante', short: 'Diam', color: 'var(--t-diamond)' },
  MASTER: { name: 'Maestro', short: 'Maestro', color: 'var(--t-master)' },
  GRANDMASTER: { name: 'Gran Maestro', short: 'GM', color: 'var(--t-gm)' },
  CHALLENGER: { name: 'Aspirante', short: 'Asp', color: 'var(--t-chall)' },
};

export const isApex = (t: Tier) => t === 'MASTER' || t === 'GRANDMASTER' || t === 'CHALLENGER';

export function toRating(tier: string, division: string, lp: number): number {
  const t = tier.toUpperCase() as Tier;
  const ti = TIERS.indexOf(t);
  if (ti < 0) return 0;
  if (isApex(t)) return APEX_BASE + lp;
  const di = Math.max(0, DIVISIONS.indexOf(division as (typeof DIVISIONS)[number]));
  return IRON_BASE + ti * 400 + di * 100 + Math.min(99, lp);
}

export function fromRating(rating: number): { tier: Tier; division: string | null; lp: number } {
  const r = Math.max(0, Math.round(rating));
  if (r >= APEX_BASE) {
    const lp = r - APEX_BASE;
    return { tier: lp >= CHALL_LP ? 'CHALLENGER' : lp >= GM_LP ? 'GRANDMASTER' : 'MASTER', division: null, lp };
  }
  if (r < IRON_BASE) return { tier: 'IRON', division: 'IV', lp: 0 };
  const x = r - IRON_BASE;
  return { tier: TIERS[Math.floor(x / 400)], division: DIVISIONS[Math.floor((x % 400) / 100)], lp: x % 100 };
}

export const tierOf = (rating: number) => fromRating(rating).tier;
export const tierColor = (t: Tier) => TIER_META[t].color;
export const tierName = (t: Tier) => TIER_META[t].name;

export function rankLabel(rating: number): RankLabel {
  const { tier, division } = fromRating(rating);
  const m = TIER_META[tier];
  return {
    label: division ? `${m.name} ${division}` : m.name,
    short: division ? `${m.short} ${division}` : m.short,
    color: m.color,
    rating: Math.round(rating),
  };
}

/** Ladder card rows, highest first. */
export const LADDER: LadderTier[] = [
  { name: 'Maestro+', color: TIER_META.MASTER.color, min: 3200, max: 3600, rangeLabel: '3.200+' },
  { name: 'Diamante', color: TIER_META.DIAMOND.color, min: 2800, max: 3200, rangeLabel: '2.800 – 3.199' },
  { name: 'Esmeralda', color: TIER_META.EMERALD.color, min: 2400, max: 2800, rangeLabel: '2.400 – 2.799' },
  { name: 'Platino', color: TIER_META.PLATINUM.color, min: 2000, max: 2400, rangeLabel: '2.000 – 2.399' },
  { name: 'Oro', color: TIER_META.GOLD.color, min: 1600, max: 2000, rangeLabel: '1.600 – 1.999' },
  { name: 'Plata', color: TIER_META.SILVER.color, min: 1200, max: 1600, rangeLabel: '1.200 – 1.599' },
  { name: 'Bronce', color: TIER_META.BRONZE.color, min: 800, max: 1200, rangeLabel: '800 – 1.199' },
  { name: 'Hierro', color: TIER_META.IRON.color, min: 0, max: 800, rangeLabel: 'Menos de 800' },
];
