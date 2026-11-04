import { clamp, mean } from '@/core/math';
import type { Benchmark, MetricRow } from '@/core/types';
import type { PlayerMetrics } from './metrics';

/**
 * Rank benchmarks.
 *
 * PROVISIONAL: the per-tier table below is a hand-made approximation of public averages, used
 * until a crawler aggregates real per-rank/per-role data (see README → "Benchmarks"). The UI marks
 * these as provisional. "Your lobbies" is real data: the lane opponents from the analysed games.
 */

export type MetricKey = 'csPerMin' | 'damageShare' | 'csDiff10' | 'objectiveShare' | 'visionPerMin' | 'deaths' | 'killParticipation' | 'goldPerMin';
type Values = Record<MetricKey, number | null>;

//                    Iron   Bronze Silver Gold   Plat   Emer   Dia    Master GM     Chall
const BASE: Record<MetricKey, number[]> = {
  csPerMin: [4.8, 5.3, 5.8, 6.2, 6.6, 6.9, 7.3, 7.7, 7.9, 8.1],
  visionPerMin: [0.62, 0.7, 0.78, 0.86, 0.94, 1.02, 1.12, 1.22, 1.27, 1.32],
  damageShare: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
  goldPerMin: [345, 355, 365, 375, 385, 395, 405, 418, 425, 432],
  killParticipation: [0.44, 0.46, 0.48, 0.5, 0.52, 0.54, 0.56, 0.58, 0.59, 0.6],
  deaths: [6.8, 6.5, 6.2, 5.9, 5.7, 5.5, 5.3, 5.1, 5.0, 4.9],
  objectiveShare: [0.4, 0.42, 0.44, 0.46, 0.48, 0.5, 0.52, 0.54, 0.55, 0.56],
  csDiff10: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

const ROLE_FACTOR: Record<MetricKey, Record<string, number>> = {
  csPerMin: { TOP: 1, JUNGLE: 0.85, MIDDLE: 1.05, BOTTOM: 1.08, UTILITY: 0.18 },
  visionPerMin: { TOP: 0.8, JUNGLE: 1.1, MIDDLE: 0.85, BOTTOM: 0.8, UTILITY: 2.2 },
  damageShare: { TOP: 1.05, JUNGLE: 0.85, MIDDLE: 1.2, BOTTOM: 1.25, UTILITY: 0.65 },
  goldPerMin: { TOP: 1.02, JUNGLE: 0.98, MIDDLE: 1.05, BOTTOM: 1.08, UTILITY: 0.7 },
  killParticipation: { TOP: 0.85, JUNGLE: 1.1, MIDDLE: 1, BOTTOM: 1, UTILITY: 1.1 },
  deaths: { TOP: 1, JUNGLE: 1, MIDDLE: 1, BOTTOM: 1, UTILITY: 1.08 },
  objectiveShare: { TOP: 0.6, JUNGLE: 1.6, MIDDLE: 0.9, BOTTOM: 1, UTILITY: 1 },
  csDiff10: { TOP: 1, JUNGLE: 1, MIDDLE: 1, BOTTOM: 1, UTILITY: 1 },
};

interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  lowerIsBetter?: boolean;
  /** Absolute deltas (CS) or percentage points (shares) instead of relative %. */
  delta: 'rel' | 'abs' | 'pts';
  fmt: (v: number) => string;
  /** Scale for bars/radar, as multiples of the Iron/Challenger benchmark (or absolute for csDiff10). */
  scale: (lo: number, hi: number) => [number, number];
}

const pctFmt = (v: number) => `${Math.round(v * 100)}%`;
const rel: MetricDef['scale'] = (lo, hi) => [lo * 0.55, hi * 1.3];

export const METRICS: MetricDef[] = [
  { key: 'csPerMin', label: 'Farmeo', unit: 'CS/min', delta: 'rel', fmt: (v) => v.toFixed(1), scale: rel },
  { key: 'damageShare', label: 'Daño del equipo', unit: 'del equipo', delta: 'rel', fmt: pctFmt, scale: (lo, hi) => [lo * 0.3, hi * 1.8] },
  { key: 'csDiff10', label: 'Early game', unit: 'dif. CS @10', delta: 'abs', fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`, scale: () => [-15, 15] },
  { key: 'objectiveShare', label: 'Control de objetivos', unit: 'participación', delta: 'pts', fmt: pctFmt, scale: () => [0.1, 0.95] },
  { key: 'killParticipation', label: 'Participación en kills', unit: 'KP', delta: 'pts', fmt: pctFmt, scale: () => [0.25, 0.8] },
  { key: 'visionPerMin', label: 'Visión', unit: 'puntos/min', delta: 'rel', fmt: (v) => v.toFixed(2), scale: rel },
  { key: 'goldPerMin', label: 'Economía', unit: 'oro/min', delta: 'rel', fmt: (v) => Math.round(v).toString(), scale: (lo, hi) => [lo * 0.75, hi * 1.15] },
  { key: 'deaths', label: 'Consistencia', unit: 'muertes/partida', lowerIsBetter: true, delta: 'rel', fmt: (v) => v.toFixed(1), scale: () => [2, 9.5] },
];

/** Radar axes in the order the radar draws them (clockwise from the top). */
export const RADAR: { key: MetricKey; label: string }[] = [
  { key: 'csPerMin', label: 'Farmeo' },
  { key: 'visionPerMin', label: 'Visión' },
  { key: 'damageShare', label: 'Daño' },
  { key: 'objectiveShare', label: 'Objetivos' },
  { key: 'csDiff10', label: 'Early game' },
  { key: 'deaths', label: 'Consistencia' },
];

export type RoleMix = Record<string, number>;

export function roleMix(ms: PlayerMetrics[]): RoleMix {
  const mix: RoleMix = {};
  const known = ms.filter((m) => m.role);
  for (const m of known) mix[m.role] = (mix[m.role] ?? 0) + 1 / known.length;
  return Object.keys(mix).length ? mix : { MIDDLE: 1 };
}

const factor = (key: MetricKey, mix: RoleMix) => Object.entries(mix).reduce((s, [role, w]) => s + w * (ROLE_FACTOR[key][role] ?? 1), 0);

export function tierBench(tierIndex: number, mix: RoleMix): Values {
  const i = clamp(tierIndex, 0, 9);
  const out = {} as Values;
  for (const m of METRICS) out[m.key] = BASE[m.key][i] * factor(m.key, mix);
  return out;
}

function avgOf(ms: PlayerMetrics[]): Values {
  const out = {} as Values;
  for (const m of METRICS) {
    const xs = ms.map((x) => x[m.key]).filter((v): v is number => v != null);
    out[m.key] = xs.length ? mean(xs) : null;
  }
  return out;
}
export const playerValues = avgOf;
/** Lane opponents' averages: what the player's own lobbies look like at their MMR. */
export const lobbyBench = avgOf;

function scaleFor(def: MetricDef, mix: RoleMix): [number, number] {
  const f = factor(def.key, mix);
  return def.scale(BASE[def.key][0] * f, BASE[def.key][9] * f);
}

/** 0–1, "further right = better". */
function goodness(def: MetricDef, v: number, mix: RoleMix) {
  const [lo, hi] = scaleFor(def, mix);
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return def.lowerIsBetter ? 1 - t : t;
}

function deltaOf(def: MetricDef, v: number, b: number): { text: string; tone: MetricRow['tone']; better: number } {
  const sign = def.lowerIsBetter ? -1 : 1;
  let text: string;
  let better: number; // normalised "how much better", for tone
  if (def.delta === 'abs') {
    const d = v - b;
    text = `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} CS`;
    better = (sign * d) / 3;
  } else if (def.delta === 'pts') {
    const d = (v - b) * 100;
    text = `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d))} pts`;
    better = (sign * d) / 3;
  } else {
    const d = b ? (v - b) / b : 0;
    text = `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d * 100))}%`;
    better = (sign * d) / 0.04;
  }
  return { text, tone: better >= 1 ? 'up' : better <= -1 ? 'dn' : 'eq', better };
}

export function buildBenchmark(
  id: string,
  button: string,
  name: string,
  provisional: boolean,
  player: Values,
  bench: Values,
  mix: RoleMix,
): Benchmark {
  const rows: MetricRow[] = [];
  for (const def of METRICS) {
    const v = player[def.key];
    const b = bench[def.key];
    if (v == null || b == null) continue;
    const d = deltaOf(def, v, b);
    rows.push({
      label: def.label,
      value: `${def.fmt(v)} ${def.unit}`,
      avg: def.fmt(b),
      delta: d.text,
      tone: d.tone,
      pct: goodness(def, v, mix),
      avgPct: goodness(def, b, mix),
    });
  }
  const radar = RADAR.map(({ key }) => {
    const def = METRICS.find((m) => m.key === key)!;
    const b = bench[key];
    return b == null ? 50 : 8 + 88 * goodness(def, b, mix);
  });
  return { id, button, name, provisional, radar, rows };
}

export function radarFor(player: Values, mix: RoleMix): number[] {
  return RADAR.map(({ key }) => {
    const def = METRICS.find((m) => m.key === key)!;
    const v = player[key];
    return v == null ? 50 : 8 + 88 * goodness(def, v, mix);
  });
}

/**
 * Rating points the player is leaving on the table: for every metric below the benchmark of the
 * tier they are estimated in, how many tiers of improvement that gap represents (capped).
 */
export function potential(player: Values, tierIndex: number, mix: RoleMix) {
  const bench = tierBench(tierIndex, mix);
  const iron = tierBench(0, mix);
  const chall = tierBench(9, mix);
  const gaps: { label: string; tiers: number }[] = [];
  for (const def of METRICS) {
    const v = player[def.key];
    const b = bench[def.key];
    if (v == null || b == null) continue;
    const step = def.key === 'csDiff10' ? 2 : Math.abs((chall[def.key]! - iron[def.key]!) / 9) || Math.abs(b) * 0.05;
    const behind = (def.lowerIsBetter ? v - b : b - v) / step;
    if (behind > 0.25) gaps.push({ label: def.label, tiers: Math.min(1.5, behind) });
  }
  gaps.sort((a, b) => b.tiers - a.tiers);
  const points = Math.min(240, gaps.reduce((s, g) => s + g.tiers * 35, 0));
  const held = gaps.slice(0, 2).map((g) => g.label);
  return { points, heldBackBy: held.length ? held.join(' y ') : 'Nada importante: sigue jugando partidas' };
}
