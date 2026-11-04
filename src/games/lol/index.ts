import 'server-only';
import type { GameModule } from '../types';
import { buildMatch } from './match';
import { lolMeta } from './meta';
import { buildProfile } from './profile';
import { playerTag } from './riot';

export const lol: GameModule = {
  ...lolMeta,
  getProfile: buildProfile,
  getMatch: buildMatch,
  refreshTags: (puuid) => [playerTag(puuid)],
};
