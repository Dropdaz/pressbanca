# Handoff — personal tracker rebuild (in progress)

Pivot: PressBanca is now a private tool for the owner and friends (not a public search site).
Decisions: Supabase + Vercel, import the whole current season on add, Ranked Solo/Duo only, UI in English.

## Done (compiles: `npx tsc --noEmit` and `npx eslint src` clean)
- `/` player selector + "Track player" form (`src/components/home/Selector.tsx`, action `trackPlayer`).
- `/p/[slug]` layout with header, tabs (Stats, History, Champions, MMR, Improve), background sync every 90 s
  (15 s while importing), live-game polling every 30 s with floating window, auto-redirect to the
  breakdown when the game ends (`src/components/player/PlayerHeader.tsx`, `LiveWindow.tsx`).
- `/p/[slug]/match/[matchId]`: coach report (`src/components/match/CoachReport.tsx`) on top of the match detail.
- Post-game engine `src/games/lol/analysis.ts` (tested on real games): deaths with context, laning @10/@15,
  plates, objectives, build timings, vision, fighting, strengths/mistakes/advice, personal "usual" baseline.
- Storage `src/server/repo.ts` (Supabase or local `.data/` files), read-through Riot cache `persistent.ts`,
  tracker `tracker.ts` (rank snapshots, real LP when exactly 1 game between snapshots, season backfill
  30 games/sync, season = gameVersion major), live `live.ts`, API `/api/track/[puuid]/{sync,live}`, `/api/cron`.
- Riot client: app + per-method rate limits (from `api-acces.md`), header sync.

## Done 2026-11-04
- Migration 0001 applied to Supabase project `rrlijeduxnnffreuikcl` (6 tables, RLS on, no policies by design).
- ErnieDj#EUW tracked; season import running (30 games/sync). Tested over HTTP: all tabs, match breakdown,
  sync, live (not in game), cron auth (401 without secret, 200 with it).
- Fix: CS@10 stored/shown as float (jungleCsBefore10Minutes is fractional), now rounded.
- `vercel.json` daily cron, `.env.example` documents Supabase + CRON_SECRET, README rewritten.

## Done 2026-11-04 (2)
- Personal Riot key in .env.local (same PUUIDs as before, limits 20/1 s + 100/120 s).
- Fixed roster (src/server/roster.ts), search/track form and track/untrack actions removed.
- API status pill + /api/status (cooldown countdown). Tabs merged into /p/[slug] (panels.tsx), switched
  client-side (TabState.tsx, hash #history...), loading.tsx screen; old tab URLs redirect.

## Next steps
1. Check visually in a browser (not done: Chrome extension wasn't connected): animations, live window
   during a real game, auto-redirect after the game.
2. Vercel: set env RIOT_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, CRON_SECRET; external cron every 5–10 min
   on /api/cron?secret=... for faster tracking.
3. Riot dev key expires every 24 h: apply for a Personal key before deploying.
