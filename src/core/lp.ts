import { clamp, mean } from './math';

/**
 * LP forecasting. Riot's LP gains/losses depend on the gap between hidden MMR and visible rank:
 * MMR above the rank → bigger gains, smaller losses (and vice versa). The base model maps that gap
 * linearly; once real LP results are tracked for the player, the forecast blends toward them.
 */

/** LP at MMR = rank. Calibrated on real data (e.g. +18/−22 at Plat III → base ≈ 20). */
const BASE = 20;
/** LP per MMR point of gap: one division (100) above the rank ≈ +6 LP on wins, −6 on losses. */
const SLOPE = 0.06;

export interface TrackedLp {
  win: boolean;
  /** Signed LP (rating) change of that game. */
  delta: number;
}

/** One known pair of LP values for a queue (typed in by the player, or averaged from tracked games). */
export interface LpReference {
  win: number;
  loss: number;
}

/**
 * Invert the model: LP asymmetry → MMR gap. +18/−22 → (18 − 22) / (2 × 0.06) ≈ −33, i.e. MMR a third of
 * a division below the visible rank. Uncertainty ~70: LP rounding, and gains drift a little each game.
 */
export const gapFromLp = (r: LpReference) => (r.win - r.loss) / (2 * SLOPE);
export const LP_ANCHOR_SD = 70;

export interface LpForecast {
  lp: number;
  lo: number;
  hi: number;
}

export function forecastLp(gap: number, tracked: TrackedLp[], reference?: LpReference | null) {
  // A known reference replaces the model's base; the gap still nudges it toward the current estimate.
  const modelWin = reference ? reference.win : clamp(BASE + gap * SLOPE, 8, 45);
  const modelLoss = reference ? reference.loss : clamp(BASE - gap * SLOPE, 8, 40);
  // Promotions, demotion shields and dodges produce odd deltas; keep only plausible games.
  const wins = tracked.filter((t) => t.win && t.delta >= 5 && t.delta <= 60).map((t) => t.delta);
  const losses = tracked.filter((t) => !t.win && t.delta <= -5 && t.delta >= -60).map((t) => -t.delta);
  const blend = (model: number, obs: number[]) => {
    if (!obs.length) return { lp: Math.round(model), spread: reference ? 2 : 5 };
    const w = obs.length / (obs.length + 2);
    const recent = mean(obs.slice(0, 5));
    return { lp: Math.round((1 - w) * model + w * recent), spread: obs.length >= 3 ? 2 : 3 };
  };
  const w = blend(modelWin, wins);
  const l = blend(modelLoss, losses);
  return {
    win: { lp: w.lp, lo: w.lp - w.spread, hi: w.lp + w.spread } as LpForecast,
    loss: { lp: l.lp, lo: l.lp - l.spread, hi: l.lp + l.spread } as LpForecast,
    calibratedFrom: wins.length + losses.length,
  };
}

/** Elo expectation of beating opponents rated `vs`. */
export const winChance = (rating: number, vs: number) => 1 / (1 + Math.pow(10, (vs - rating) / 400));

/** Estimated MMR change of one game (Elo, K≈LP scale). */
export const mmrSwing = (rating: number, lobby: number, win: boolean, k = 48) => Math.round(k * ((win ? 1 : 0) - winChance(rating, lobby)));

/**
 * Games until the visible rank catches up with MMR at a 50% win rate: each game nets
 * (gain − loss) / 2 LP toward it. Null when they already agree.
 */
export function convergeGames(gap: number, win: number, loss: number) {
  if (Math.abs(gap) <= 25) return null;
  const net = Math.abs(win - loss) / 2;
  return net < 0.5 ? null : Math.round(Math.abs(gap) / net);
}
