/**
 * View models: what the UI renders. Every game module maps its own API data into these shapes,
 * so pages and components stay game-agnostic. All values are plain JSON (server → client).
 */

/** A CSS colour expression, usually a token such as `var(--t-gold)`. */
export type Color = string;

export interface RankLabel {
  /** "Platinum II" */
  label: string;
  /** "Plat II" */
  short: string;
  color: Color;
  rating: number;
}

export interface LadderTier {
  name: string;
  color: Color;
  min: number;
  max: number;
  rangeLabel: string;
}

export interface ShownRank extends RankLabel {
  lp: number;
  /** 0–1 progress inside the division. */
  progress: number;
  queueLabel: string;
  seasonGames: number;
}

export interface MmrView {
  value: number;
  lo: number;
  hi: number;
  confidence: number;
  trend: number;
  trendWindow: number;
  estimated: RankLabel;
  lobbyAvg: RankLabel | null;
  /** Estimated minus shown, in divisions. Null if unranked. */
  divisionsDelta: number | null;
  lobbiesRead: number;
  history: number[];
  verdict: { before: string; highlight: string; color: Color; after: string };
}

export interface ReachView {
  target: number;
  lo: number;
  hi: number;
  rank: RankLabel;
  rangeLabel: string;
  probability: number;
  games: number;
  heldBackBy: string;
}

export interface MetricRow {
  label: string;
  value: string;
  avg: string;
  delta: string;
  /** up = better than benchmark, dn = worse, eq = within noise */
  tone: 'up' | 'dn' | 'eq';
  /** 0–1 position of the player's value on the metric scale. */
  pct: number;
  /** 0–1 position of the benchmark. */
  avgPct: number;
}

export interface Benchmark {
  id: string;
  /** Segmented-button label: "Gold avg" */
  button: string;
  /** "Gold" → rendered as "Gold average" */
  name: string;
  provisional: boolean;
  radar: number[];
  rows: MetricRow[];
}

export interface PerformanceView {
  axes: string[];
  /** 0–100 per axis. */
  player: number[];
  benchmarks: Benchmark[];
}

export interface Feat {
  title: string;
  sub: string;
  when: string;
  mark: string;
  color: Color;
}

export interface EntityRow {
  name: string;
  image: string | null;
  color: Color;
  games: number;
  winRate: number;
  cells: string[];
  /** Optional delta badge in the last column. */
  badge?: { text: string; tone: 'up' | 'dn' | 'eq' };
}

export interface EntityTable {
  eyebrow: string;
  title: string;
  columns: string[];
  badgeColumn?: string;
  rows: EntityRow[];
}

export interface DistributionView {
  eyebrow: string;
  title: string;
  items: { name: string; games: number; pct: number; color: Color }[];
}

export interface MatchSummary {
  id: string;
  win: boolean;
  remake: boolean;
  queue: string;
  title: string;
  image: string | null;
  level: number;
  durationSec: number;
  endedAt: number;
  k: number;
  d: number;
  a: number;
  cs: number;
  csPerMin: number;
  items: (string | null)[];
  lobby: RankLabel | null;
  /** Secondary headline stat shown where op.gg-style sites show LP. */
  badge: { value: string; unit: string };
  /** Real LP change of this game, when rank tracking caught it. */
  lpDelta: number | null;
  /** Model estimate of the hidden-MMR change (Elo vs the lobby). */
  mmrDelta: number | null;
  score: number;
  note: string;
}

export interface PlayerHeader {
  game: string;
  gameName: string;
  region: string;
  name: string;
  tag: string;
  level: number;
  icon: string | null;
  shown: ShownRank | null;
  recent: { wins: number; losses: number };
  fetchedAt: number;
}

export interface LpForecast {
  lp: number;
  lo: number;
  hi: number;
}

/** Everything about one ranked queue: hidden MMR, LP forecast, goals, signals. */
export interface QueueOutlook {
  id: string;
  label: string;
  shown: ShownRank | null;
  mmr: number;
  mmrRank: RankLabel;
  lo: number;
  hi: number;
  confidence: number;
  lobbiesRead: number;
  /** MMR minus visible rank, in LP. */
  gapLp: number | null;
  nextWin: LpForecast | null;
  nextLoss: LpForecast | null;
  /** Tracked real games the LP forecast is calibrated with. */
  calibratedFrom: number;
  /** Known LP pair anchoring this queue (typed in by the player, or from tracked games). */
  reference: { win: number; loss: number; source: 'manual' | 'tracked'; at: number } | null;
  /** MMR implied by that LP asymmetry alone. */
  lpImpliedMmr: number | null;
  toNext: { lp: number; wins: number; label: string } | null;
  toDemote: { losses: number; label: string } | null;
  convergeGames: number | null;
  /** Elo chance of beating players at the visible rank. */
  winVsRank: number | null;
  season: { wins: number; losses: number } | null;
  /** Teammates minus enemies (visible ranks) across sampled lobbies. */
  balance: { avgDiff: number; weakerTeam: number; games: number } | null;
  tracked: { matchId: string; delta: number; win: boolean; at: number }[];
}

export interface LivePlayer {
  name: string;
  tag: string;
  champion: string;
  image: string | null;
  rank: RankLabel | null;
  me: boolean;
}

/** The player's game in progress (spectator data) with ranks and a win forecast. */
export interface LiveGameView {
  queue: string;
  startedAt: number;
  teams: { mine: boolean; avg: RankLabel | null; players: LivePlayer[] }[];
  /** Elo chance my team wins, from team ratings (my hidden MMR + visible ranks of the rest). */
  winChance: number | null;
  /** LP at stake when it is a ranked queue we forecast. */
  lp: { win: number; loss: number } | null;
}

export interface ProfileView {
  header: PlayerHeader;
  /** Identity used by lazily loaded match details. */
  ref: { game: string; region: string; puuid: string };
  mmr: MmrView;
  outlook: QueueOutlook[];
  live: LiveGameView | null;
  ladder: LadderTier[];
  /** Rank label of every division on the rating scale, for chart axes. */
  scale: RankLabel[];
  reach: ReachView;
  performance: PerformanceView;
  feats: Feat[];
  entities: EntityTable;
  distribution: DistributionView;
  matches: MatchSummary[];
  queues: string[];
  demo: boolean;
}

export interface DetailPlayer {
  name: string;
  tag: string;
  champion: string;
  image: string | null;
  rank: RankLabel | null;
  k: number;
  d: number;
  a: number;
  damage: number;
  gold: number;
  cs: number;
  vision: number;
  items: (string | null)[];
  score: number;
  me: boolean;
}

export interface DetailTeam {
  name: string;
  win: boolean;
  kills: number;
  gold: number;
  objectives: string;
  avgRank: RankLabel | null;
  players: DetailPlayer[];
}

export interface MatchDetailView {
  id: string;
  queue: string;
  durationSec: number;
  endedAt: number;
  me: { name: string; tag: string; puuid: string };
  win: boolean;
  champion: string;
  image: string | null;
  role: string;
  k: number;
  d: number;
  a: number;
  killParticipation: number;
  cs: number;
  score: number;
  scoreNote: string;
  lobby: { label: string; rank: RankLabel | null }[];
  teams: DetailTeam[];
  /** Gold difference (my team − enemy) per minute. */
  gold: number[];
  /** Cumulative damage per minute: my team, enemy. */
  damage: { mine: number[]; theirs: number[] };
  events: { minute: number; label: string; good: boolean }[];
  breakdown: { label: string; value: number; avg: number }[];
  analysis: PostGameView | null;
  demo: boolean;
}

/** Small summary for the home search card. */
export interface ProfilePeek {
  name: string;
  tag: string;
  region: string;
  icon: string | null;
  level: number;
  shown: { label: string; short: string; color: Color; lp: number } | null;
  estimated: RankLabel;
  direction: 'up' | 'down' | 'flat';
  demo: boolean;
}

export function toPeek(p: ProfileView): ProfilePeek {
  const s = p.header.shown;
  const d = p.mmr.divisionsDelta ?? 0;
  return {
    name: p.header.name,
    tag: p.header.tag,
    region: p.header.region,
    icon: p.header.icon,
    level: p.header.level,
    shown: s ? { label: s.label, short: s.short, color: s.color, lp: s.lp } : null,
    estimated: p.mmr.estimated,
    direction: d >= 0.5 ? 'up' : d <= -0.5 ? 'down' : 'flat',
    demo: p.demo,
  };
}

// ───────── Post-game analysis ─────────

export type InsightCategory = 'Laning' | 'Deaths' | 'Objectives' | 'Vision' | 'Farming' | 'Fighting' | 'Economy' | 'Build';

/** Display names of insight categories (the keys stay English in code). */
export const CATEGORY_LABEL: Record<InsightCategory, string> = { Laning: 'Fase de líneas', Deaths: 'Muertes', Objectives: 'Objetivos', Vision: 'Visión', Farming: 'Farmeo', Fighting: 'Peleas', Economy: 'Economía', Build: 'Build' };

export interface Insight {
  id: string;
  category: InsightCategory;
  title: string;
  detail: string;
  /** 1 minor · 2 notable · 3 major */
  severity: 1 | 2 | 3;
  minute?: number;
}

export interface Advice {
  id: string;
  category: InsightCategory;
  title: string;
  why: string;
  how: string[];
}

export interface DeathView {
  minute: number;
  /** Map position in game units (0–~14,800). */
  x: number;
  y: number;
  zone: string;
  kind: 'gank' | 'solo' | 'caught' | 'teamfight' | 'dive' | 'skirmish';
  killers: { champion: string; image: string | null }[];
  alliesNear: number;
  bounty: number;
  objectiveLost: string | null;
  note: string;
}

/** A kill you took part in (as killer or assist), for the kill map. */
export interface KillView {
  minute: number;
  x: number;
  y: number;
  zone: string;
  role: 'kill' | 'assist';
  victim: { champion: string; image: string | null };
  /** Other allies who took part. */
  with: { champion: string; image: string | null }[];
  bounty: number;
  note: string;
}

export interface CompareRow {
  label: string;
  you: string;
  other: string | null;
  /** your own average over your stored history */
  usual: string | null;
  tone: 'up' | 'dn' | 'eq';
}

export interface PostGameView {
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  headline: string;
  role: string;
  opponent: { name: string; champion: string; image: string | null } | null;
  laning: CompareRow[];
  /** Per minute: you vs lane opponent. */
  series: { cs: [number, number][]; gold: [number, number][]; xp: [number, number][] };
  deaths: DeathView[];
  kills: KillView[];
  /** Summoner's Rift minimap image (Data Dragon). */
  mapImage: string | null;
  objectives: { minute: number; label: string; good: boolean; involved: boolean; youDead: boolean }[];
  build: { minute: number; name: string; image: string | null; kind: 'legendary' | 'boots' }[];
  stats: { group: string; rows: CompareRow[] }[];
  strengths: Insight[];
  mistakes: Insight[];
  advice: Advice[];
  baselineGames: number;
}
