import { clamp, mean, percentile } from '@/core/math';
import type { MatchDto, ParticipantDto } from './dto';

export const QUEUES: Record<number, string> = { 420: 'Solo/Dúo', 440: 'Flexible' };
export const ROLE_NAMES: Record<string, string> = { TOP: 'Top', JUNGLE: 'Jungla', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };

/** Display names of the score categories (the keys stay English in code). */
export const CATEGORY_ES: Record<string, string> = { Laning: 'Fase de líneas', Teamfighting: 'Peleas', Objectives: 'Objetivos', Economy: 'Economía', Vision: 'Visión', Survival: 'Supervivencia' };

export const isRemake = (m: MatchDto) => m.info.gameDuration < 300;

/** Per-player numbers derived from a match, all role-comparable where possible. */
export interface PlayerMetrics {
  puuid: string;
  teamId: number;
  role: string;
  win: boolean;
  minutes: number;
  kda: number;
  cs: number;
  csPerMin: number;
  goldPerMin: number;
  damageShare: number;
  killParticipation: number;
  visionPerMin: number;
  deaths: number;
  /** Lane CS difference vs the opposing player in the same position at 10 minutes. */
  csDiff10: number | null;
  /** Share of the team's epic monsters the player took part in. */
  objectiveShare: number | null;
  objectiveDamage: number;
}

const cs10 = (p: ParticipantDto) => (p.challenges?.laneMinionsFirst10Minutes ?? 0) + (p.challenges?.jungleCsBefore10Minutes ?? 0);

export function opponentOf(m: MatchDto, p: ParticipantDto) {
  if (!p.teamPosition) return undefined;
  return m.info.participants.find((o) => o.teamId !== p.teamId && o.teamPosition === p.teamPosition);
}

export function metricsFor(m: MatchDto, p: ParticipantDto): PlayerMetrics {
  const minutes = Math.max(1, m.info.gameDuration / 60);
  const team = m.info.participants.filter((o) => o.teamId === p.teamId);
  const teamKills = team.reduce((s, o) => s + o.kills, 0);
  const teamDmg = team.reduce((s, o) => s + o.totalDamageDealtToChampions, 0);
  const t = m.info.teams.find((x) => x.teamId === p.teamId);
  const teamEpics = (t?.objectives.dragon?.kills ?? 0) + (t?.objectives.baron?.kills ?? 0) + (t?.objectives.riftHerald?.kills ?? 0);
  const epics = (p.challenges?.dragonTakedowns ?? 0) + (p.challenges?.baronTakedowns ?? 0) + (p.challenges?.riftHeraldTakedowns ?? 0);
  const opp = opponentOf(m, p);
  const hasLaneCs = p.challenges?.laneMinionsFirst10Minutes != null || p.challenges?.jungleCsBefore10Minutes != null;
  const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
  return {
    puuid: p.puuid,
    teamId: p.teamId,
    role: p.teamPosition,
    win: p.win,
    minutes,
    kda: (p.kills + p.assists) / Math.max(1, p.deaths),
    cs,
    csPerMin: cs / minutes,
    goldPerMin: p.goldEarned / minutes,
    damageShare: p.challenges?.teamDamagePercentage ?? (teamDmg ? p.totalDamageDealtToChampions / teamDmg : 0),
    killParticipation: p.challenges?.killParticipation ?? (teamKills ? (p.kills + p.assists) / teamKills : 0),
    visionPerMin: p.visionScore / minutes,
    deaths: p.deaths,
    csDiff10: opp && hasLaneCs ? cs10(p) - cs10(opp) : null,
    objectiveShare: teamEpics ? clamp(epics / teamEpics, 0, 1) : null,
    objectiveDamage: p.damageDealtToObjectives,
  };
}

const pct = (v: number | null, all: (number | null)[], invert = false) => {
  if (v == null) return 0.5;
  const others = all.filter((x): x is number => x != null);
  const p = percentile(v, others);
  return invert ? 1 - p : p;
};

/**
 * Category scores (0–10) of one player against the other nine in the same game. Percentiles inside
 * the lobby make the score independent of rank: 5.0 is the lobby median.
 */
export function breakdown(m: MatchDto, puuid: string) {
  const all = m.info.participants.map((p) => metricsFor(m, p));
  const me = all.find((x) => x.puuid === puuid)!;
  const others = all.filter((x) => x.puuid !== puuid);
  const col = <K extends keyof PlayerMetrics>(k: K) => others.map((x) => x[k] as number | null);
  const s = (v: number) => Math.round(v * 100) / 10;
  return {
    Laning: s(mean([pct(me.csDiff10, col('csDiff10')), pct(me.csPerMin, col('csPerMin'))])),
    Teamfighting: s(mean([pct(me.killParticipation, col('killParticipation')), pct(me.damageShare, col('damageShare')), pct(me.kda, col('kda'))])),
    Objectives: s(mean([pct(me.objectiveShare, col('objectiveShare')), pct(me.objectiveDamage, col('objectiveDamage'))])),
    Economy: s(pct(me.goldPerMin, col('goldPerMin'))),
    Vision: s(pct(me.visionPerMin, col('visionPerMin'))),
    Survival: s(pct(me.deaths, col('deaths'), true)),
  };
}

const WEIGHTS: Record<keyof ReturnType<typeof breakdown>, number> = {
  Laning: 0.18,
  Teamfighting: 0.3,
  Objectives: 0.12,
  Economy: 0.15,
  Vision: 0.1,
  Survival: 0.15,
};

/** Single 0–10 performance score; a small bonus for winning. */
export function scoreFor(m: MatchDto, puuid: string): number {
  const b = breakdown(m, puuid);
  const raw = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((s, k) => s + b[k] * WEIGHTS[k], 0);
  const win = m.info.participants.find((p) => p.puuid === puuid)?.win ? 0.4 : 0;
  return Math.round(clamp(raw * 1.05 + win, 0, 10) * 10) / 10;
}

/** One-line note about the game, picked from the strongest and weakest categories. */
export function noteFor(m: MatchDto, puuid: string): string {
  const b = breakdown(m, puuid);
  const entries = Object.entries(b).sort((x, y) => y[1] - x[1]);
  const [best, bv] = entries[0];
  const [worst, wv] = entries[entries.length - 1];
  const phr: Record<string, [string, string]> = {
    Laning: ['Ganaste la calle en CS', 'Te quedaste atrás pronto en la calle'],
    Teamfighting: ['Clave en todas las peleas', 'Poco impacto en las peleas'],
    Objectives: ['Presente en cada objetivo', 'Ausente en los objetivos'],
    Economy: ['El más rico de la partida', 'Sin oro'],
    Vision: ['Iluminaste el mapa', 'Te faltó visión'],
    Survival: ['Casi no moriste', 'Demasiadas muertes'],
  };
  if (bv >= 7 && wv <= 3.5) return `${phr[best][0]}, pero ${phr[worst][1].toLowerCase()}.`;
  if (bv >= 7) return `${phr[best][0]}.`;
  if (wv <= 3.5) return `${phr[worst][1]}.`;
  return 'Una partida equilibrada en todo.';
}
