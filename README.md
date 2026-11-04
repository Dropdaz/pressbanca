# PressBanca

A private League of Legends tracker for me and my friends. The profiles are a fixed list in
`src/server/roster.ts` (no search); for each one PressBanca imports the whole current season of **Ranked Solo/Duo**, keeps it in sync, and turns every game into a coach
report: deaths with context, laning at 10/15, objectives, build timings, vision and fights, compared with
your own usual numbers.

## Pages

| Route | What it shows |
| --- | --- |
| `/` | The roster (players are registered automatically on first load) |
| `/p/[slug]` | Profile with five tabs, all rendered in one pass behind a loading screen: Stats, History (`#history`), Champions, MMR, Improve |
| `/p/[slug]/match/[matchId]` | Coach report + full match breakdown |

Profiles sync in the background while open (every 90 s, 15 s while the season is still importing); the
home page syncs the whole roster in turn. The **API status** pill (`/api/status`) shows rate-limit usage and
a countdown while the key is cooling down. It reflects the server instance that answers, so on Vercel it is
approximate.

## Run it

```bash
npm install
cp .env.example .env.local   # RIOT_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, CRON_SECRET
npm run dev
```

Storage is Supabase when `SUPABASE_URL` + `SUPABASE_SECRET_KEY` are set, otherwise JSON files in `.data/`.
Apply `supabase/migrations/0001_pressbanca.sql` to a new project first. RLS is on with no policies on purpose:
only the server (secret key) reads or writes.

Riot **development keys expire every 24 hours**. Regenerate yours at developer.riotgames.com, or apply for a
Personal API key that doesn't expire.

### Deploy on Vercel

Add `RIOT_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `CRON_SECRET` as environment variables and deploy.
`vercel.json` runs `/api/cron` once a day (the Hobby plan limit) to sync every tracked player. For faster
tracking, point an external cron (e.g. cron-job.org, every 5–10 min) at
`https://<your-app>/api/cron?secret=<CRON_SECRET>`.

## How it works

| Piece | Where |
| --- | --- |
| Storage (Supabase or `.data/` files) | `src/server/repo.ts`, `supabase/migrations/` |
| Tracker: add player, sync, season backfill, rank snapshots | `src/server/tracker.ts` |
| Read-through cache of Riot data | `src/server/persistent.ts` |
| Live game | `src/server/live.ts`, `src/components/player/LiveWindow.tsx` |
| API: sync / live / cron | `src/app/api/track/[puuid]/{sync,live}`, `src/app/api/cron` |
| Post-game analysis (coach report) | `src/games/lol/analysis.ts` |
| Riot client with rate limiting | `src/games/lol/riot.ts` |
| Hidden-MMR estimator, LP model | `src/core/estimator.ts`, `src/core/lp.ts` |
| Metrics, per-game score, benchmarks | `src/games/lol/metrics.ts`, `benchmarks.ts` |

**Season import.** Adding a player stores them and starts importing; each sync pulls new games plus
30 older ones until it reaches the season start (season = game-version major). Matches are stored once and
shared between players, so a game played with a friend is not fetched twice.

**Hidden MMR.** Rating scale of 100 points per division (Gold IV = 1,600, Master = 3,200). For the last
ranked games in the same queue as the visible rank, we read the ranks of up to 5 players per lobby (lane
opponent first). Each lobby's mean is a noisy observation of the player's MMR; a normal Bayesian update with
the visible rank as prior (newer lobbies weigh more), plus an Elo shift for the win rate against those
lobbies, gives the estimate and its 80% range.

**Reachable rank.** Estimate + half its uncertainty + positive trend + the rating the player's weakest stats
are costing them versus the average of their estimated tier.

**Ranked outlook (per queue).** Solo/Duo and Flex are estimated separately. LP of the next win/loss
comes from the MMR − rank gap (≈ ±6 LP per division of gap around a 20 LP base, `src/core/lp.ts`). Players
can type their last win/loss LP: that pair sets the forecast, and its asymmetry is inverted into an MMR reading
((win − loss) / 0.12, e.g. +18/−22 → 33 below the rank) that is combined with the lobby estimate. Tracked
real games do the same automatically. Also: LP and wins to the next division, losses to
demote, games until rank catches MMR, Elo win chance vs the visible rank, season record, and team
balance (teammates vs enemies) across sampled lobbies.

**Real LP tracking.** Riot doesn't publish LP per game. Every sync stores a rank snapshot when something
changed (`rank_snapshots`); when exactly one game was played between two snapshots, that game's LP is
recorded against it (`player_matches.lp_delta`) and shown in the history and MMR tabs.

**Live game.** spectator-v5, polled every 30 s while a profile is open: a floating window shows both teams
with ranks, the Elo win chance and the LP at stake, and jumps to the breakdown when the game ends.

**Per-game MMR swing.** Elo estimate (K = 48) of each sampled game against its lobby average.

**Per-game score (0–10).** Percentiles against the other nine players in the same game across laning,
teamfighting, objectives, economy, vision and survival. 5.0 is the lobby median.

**Benchmarks.** The per-tier table in `benchmarks.ts` is **provisional** (hand-made approximations,
role-adjusted) and is labelled as such in the UI. "Your lobbies" is real data: the player's lane opponents.

### Rate limits

Every Riot call passes two sliding-window limiters per routing host: the key's **app limits**
(`RIOT_RATE_LIMITS`, default `20:1,100:120` — what this key reports) and each endpoint's **method limits**
(table in `riot.ts`, from `api-acces.md`). Both are kept at 90% for headroom and synced with Riot's
`X-App-/X-Method-Rate-Limit-Count`, `Retry-After` and `X-Rate-Limit-Type` headers, so several server
instances sharing one key back off together. Cache hits never spend budget.
If a wait would exceed ~8 s, lobby sampling stops early (lower confidence) or the page shows the
rate-limited state, which counts down and retries by itself.
