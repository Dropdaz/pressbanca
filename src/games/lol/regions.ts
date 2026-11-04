import type { RegionOption } from '../types';

interface LolRegion extends RegionOption {
  /** Platform host for summoner-v4 / league-v4. */
  platform: string;
  /** Regional host for match-v5. */
  regional: 'americas' | 'europe' | 'asia' | 'sea';
  /** Regional host for account-v1 (no "sea" cluster). */
  account: 'americas' | 'europe' | 'asia';
}

export const LOL_REGIONS: LolRegion[] = [
  { id: 'EUW', label: 'EUW', platform: 'euw1', regional: 'europe', account: 'europe' },
  { id: 'EUNE', label: 'EUNE', platform: 'eun1', regional: 'europe', account: 'europe' },
  { id: 'NA', label: 'NA', platform: 'na1', regional: 'americas', account: 'americas' },
  { id: 'KR', label: 'KR', platform: 'kr', regional: 'asia', account: 'asia' },
  { id: 'BR', label: 'BR', platform: 'br1', regional: 'americas', account: 'americas' },
  { id: 'LAN', label: 'LAN', platform: 'la1', regional: 'americas', account: 'americas' },
  { id: 'LAS', label: 'LAS', platform: 'la2', regional: 'americas', account: 'americas' },
  { id: 'OCE', label: 'OCE', platform: 'oc1', regional: 'sea', account: 'asia' },
  { id: 'JP', label: 'JP', platform: 'jp1', regional: 'asia', account: 'asia' },
  { id: 'TR', label: 'TR', platform: 'tr1', regional: 'europe', account: 'europe' },
  { id: 'ME', label: 'ME', platform: 'me1', regional: 'europe', account: 'europe' },
  { id: 'SEA', label: 'SEA', platform: 'sg2', regional: 'sea', account: 'asia' },
  { id: 'TW', label: 'TW', platform: 'tw2', regional: 'sea', account: 'asia' },
  { id: 'VN', label: 'VN', platform: 'vn2', regional: 'sea', account: 'asia' },
];

export function lolRegion(id: string): LolRegion | undefined {
  return LOL_REGIONS.find((r) => r.id.toLowerCase() === id.toLowerCase());
}
