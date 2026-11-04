import 'server-only';
import { persistentSource } from '@/server/persistent';
import { demoSource } from './demo';
import { hasRiotKey } from './riot';

/** Riot API through the persistent store when a key is configured, deterministic demo data otherwise. */
export const source = () => (hasRiotKey() ? persistentSource() : demoSource);
