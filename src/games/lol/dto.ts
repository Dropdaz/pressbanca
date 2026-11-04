/** The subset of Riot API payloads PressBanca reads. Field names match the official DTOs. */

export interface AccountDto {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface SummonerDto {
  puuid: string;
  profileIconId: number;
  summonerLevel: number;
}

export interface LeagueEntryDto {
  queueType: 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR' | string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface ChallengesDto {
  killParticipation?: number;
  teamDamagePercentage?: number;
  laneMinionsFirst10Minutes?: number;
  jungleCsBefore10Minutes?: number;
  soloKills?: number;
  epicMonsterSteals?: number;
  dragonTakedowns?: number;
  baronTakedowns?: number;
  riftHeraldTakedowns?: number;
  perfectGame?: number;
  damagePerMinute?: number;
}

export interface ParticipantDto {
  puuid: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  summonerName?: string;
  championName: string;
  champLevel: number;
  teamId: number;
  teamPosition: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  damageDealtToObjectives: number;
  visionScore: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  largestMultiKill: number;
  pentaKills: number;
  quadraKills: number;
  firstBloodKill: boolean;
  gameEndedInEarlySurrender?: boolean;
  challenges?: ChallengesDto;
}

export interface TeamDto {
  teamId: number;
  win: boolean;
  objectives: Record<'baron' | 'champion' | 'dragon' | 'riftHerald' | 'tower' | 'horde' | 'inhibitor', { first: boolean; kills: number } | undefined>;
}

export interface MatchDto {
  metadata: { matchId: string; participants: string[] };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameEndTimestamp?: number;
    queueId: number;
    participants: ParticipantDto[];
    teams: TeamDto[];
  };
}

export interface TimelineEventDto {
  type: string;
  timestamp: number;
  participantId?: number;
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  killerTeamId?: number;
  teamId?: number;
  monsterType?: string;
  monsterSubType?: string;
  buildingType?: string;
  towerType?: string;
  laneType?: string;
  killType?: string;
  itemId?: number;
  level?: number;
  wardType?: string;
  creatorId?: number;
  bounty?: number;
  shutdownBounty?: number;
  position?: { x: number; y: number };
  victimDamageReceived?: { participantId: number; name: string; magicDamage: number; physicalDamage: number; trueDamage: number }[];
}

export interface ParticipantFrameDto {
  totalGold: number;
  currentGold: number;
  xp: number;
  level: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
  position: { x: number; y: number };
  damageStats?: { totalDamageDoneToChampions: number; totalDamageTaken: number };
}

export interface TimelineDto {
  metadata: { participants: string[] };
  info: {
    frames: {
      timestamp: number;
      participantFrames: Record<string, ParticipantFrameDto>;
      events: TimelineEventDto[];
    }[];
  };
}

/** spectator-v5 active game. */
export interface ActiveGameDto {
  gameId: number;
  gameQueueConfigId: number;
  gameStartTime: number;
  gameLength: number;
  participants: { puuid: string | null; championId: number; teamId: number; riotId?: string }[];
}

/** Everything a profile/match page needs from the outside world. Real Riot API or demo data. */
export interface LolSource {
  demo: boolean;
  account(platformRegion: string, name: string, tag: string): Promise<AccountDto>;
  summoner(platformRegion: string, puuid: string): Promise<SummonerDto>;
  league(platformRegion: string, puuid: string): Promise<LeagueEntryDto[]>;
  matchIds(platformRegion: string, puuid: string, count: number): Promise<string[]>;
  match(platformRegion: string, id: string): Promise<MatchDto>;
  timeline(platformRegion: string, id: string): Promise<TimelineDto>;
  /** Null when the player is not in a game. */
  activeGame(platformRegion: string, puuid: string): Promise<ActiveGameDto | null>;
}
