import { clamp, normCdf, Z80 } from './math';

/**
 * Game-agnostic hidden-rating estimator.
 *
 * Every game exposes a numeric rating scale (LoL: 100 points per division). The estimate is a
 * Bayesian normal update:
 *   prior        — the visible rank (weak evidence: rank lags MMR, especially early in a season)
 *   observations — the average rating of the players in each lobby. Matchmaking pairs players of
 *                  similar MMR, so a lobby's mean is a noisy reading of the searched player's MMR.
 *                  Newer lobbies weigh more (MMR drifts).
 *   performance  — a win rate away from 50% against those lobbies means the player is above/below
 *                  them; converted with the Elo logistic and shrunk toward 50%.
 */

export interface LobbyObservation {
  /** Mean rating of the other players in the lobby whose rank we know. */
  value: number;
  /** How many players that mean is built from. */
  players: number;
  win: boolean;
  /** Unix ms, used for ordering and recency weighting. */
  at: number;
}

export interface EstimateInput {
  /** Rating implied by the visible rank, if the player is ranked. */
  shown: number | null;
  lobbies: LobbyObservation[];
  /** Results of all analysed games (wider than the lobby sample), newest first. */
  results: boolean[];
  /**
   * Direct reading of the MMR from the player's LP gains/losses (see core/lp.ts). Independent of the
   * lobbies, so it is combined with the lobby-based estimate by precision.
   */
  anchor?: { value: number; sd: number } | null;
}

export interface Estimate {
  mean: number;
  sd: number;
  lo80: number;
  hi80: number;
  /** 0–100: how much the observations narrowed the prior. */
  confidence: number;
  /** Change of the running estimate across the observed window. */
  trend: number;
  /** Running estimate after each lobby, oldest → newest. */
  history: number[];
  lobbyMean: number | null;
  winRateShift: number;
}

const PRIOR_SD_RANKED = 260;
const PRIOR_SD_UNRANKED = 600;
/** Spread of lobby means around the player's MMR when every player's rank is known. */
const SD_MATCHMAKING = 110;
/** Spread of an individual's visible rank around the lobby MMR. */
const SD_INDIVIDUAL = 230;
const HALF_LIFE_GAMES = 12;
const FALLBACK_CENTER = 1600;

export function obsSd(players: number) {
  return Math.sqrt(SD_MATCHMAKING ** 2 + SD_INDIVIDUAL ** 2 / Math.max(1, players));
}

export function winRateShift(results: boolean[]): number {
  if (!results.length) return 0;
  const wins = results.filter(Boolean).length;
  const p = (wins + 5) / (results.length + 10); // shrink toward 50% with 10 virtual games
  return 400 * Math.log10(p / (1 - p));
}

export function estimate({ shown, lobbies, results, anchor }: EstimateInput): Estimate {
  const ordered = [...lobbies].sort((a, b) => a.at - b.at);
  const priorMean = shown ?? (ordered.length ? ordered.reduce((s, o) => s + o.value, 0) / ordered.length : FALLBACK_CENTER);
  const priorSd = shown != null ? PRIOR_SD_RANKED : PRIOR_SD_UNRANKED;
  const shift = winRateShift(results);

  let precision = 1 / priorSd ** 2;
  let weighted = priorMean * precision;
  const history: number[] = [];
  ordered.forEach((o, i) => {
    const age = ordered.length - 1 - i; // 0 = newest
    const w = Math.pow(0.5, age / HALF_LIFE_GAMES);
    const p = w / obsSd(o.players) ** 2;
    precision += p;
    weighted += o.value * p;
    // Running performance shift: results up to and including this lobby.
    const seen = ordered.slice(0, i + 1).map((x) => x.win);
    history.push(weighted / precision + winRateShift(seen) * 0.5);
  });

  let sd = Math.sqrt(1 / precision);
  let mean = weighted / precision + shift * (ordered.length ? 1 : 0.5);
  if (anchor) {
    const p1 = 1 / sd ** 2, p2 = 1 / anchor.sd ** 2;
    mean = (mean * p1 + anchor.value * p2) / (p1 + p2);
    sd = Math.sqrt(1 / (p1 + p2));
  }
  const half = Math.max(1, Math.floor(history.length / 2));
  const trend = history.length >= 4 ? history[history.length - 1] - history[half - 1] : 0;
  const lobbyMean = ordered.length ? ordered.reduce((s, o) => s + o.value, 0) / ordered.length : null;

  return {
    mean,
    sd,
    lo80: mean - Z80 * sd,
    hi80: mean + Z80 * sd,
    confidence: Math.round(clamp(100 * (1 - sd / PRIOR_SD_RANKED), 5, 97)),
    trend,
    history: history.length ? [...history.slice(0, -1), mean] : [mean],
    lobbyMean,
    winRateShift: shift,
  };
}

export interface ReachInput {
  est: Estimate;
  shown: number | null;
  /** Rating points recoverable by closing the weaknesses gap (game-specific). */
  potential: number;
  /** Recent win rate (0–1), newest results. */
  winRate: number;
}

export interface Reach {
  target: number;
  lo: number;
  hi: number;
  probability: number;
  games: number;
}

/**
 * Projection of the rank the player can reach: current MMR, half its uncertainty upward, the
 * positive part of the trend and the rating left on the table by weaknesses.
 */
export function reach({ est, shown, potential, winRate }: ReachInput): Reach {
  const momentum = Math.max(0, est.trend) * 0.5;
  const target = est.mean + 0.5 * est.sd + potential + momentum;
  // Future MMR if the player closes most of the gap: centre and a spread for how well that goes.
  const futureMean = est.mean + 0.85 * potential + momentum;
  const futureSd = Math.sqrt(est.sd ** 2 + 100 ** 2);
  const probability = Math.round(100 * (1 - normCdf((target - futureMean) / futureSd)));

  // Games to get there: LP per game grows with how far MMR sits above the visible rank, and the win
  // rate rises (Elo) as the player improves — on average by half the gain during the climb.
  const from = shown ?? est.mean;
  const gap = est.mean - from;
  const gain = clamp(22 + gap / 20, 12, 40);
  const loss = clamp(20 - gap / 25, 8, 30);
  const eloWin = 1 / (1 + Math.pow(10, -((futureMean - est.mean) / 2) / 400));
  const p = clamp((Math.max(winRate, 0.5) + eloWin) / 2 + 0.01, 0.5, 0.75);
  const net = Math.max(2, p * gain - (1 - p) * loss);
  const games = Math.round(clamp((target - from) / net, 5, 300));

  return { target, lo: target - Z80 * futureSd * 0.6, hi: target + Z80 * futureSd * 0.6, probability: clamp(probability, 1, 99), games };
}
