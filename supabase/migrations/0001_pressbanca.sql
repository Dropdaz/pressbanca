-- PressBanca: tracked players, their full match history, rank snapshots and a cache of Riot data.
-- Only the server (secret key) touches these tables: RLS is on with no policies, so the public
-- anon/publishable key can read or write nothing.

create table if not exists players (
  puuid text primary key,
  game_name text not null,
  tag_line text not null,
  region text not null,
  slug text not null unique,
  profile_icon int,
  level int,
  added_at timestamptz not null default now(),
  -- backfill of the current season: next index into match ids, and whether it reached the season start
  backfill_start int not null default 0,
  backfill_done boolean not null default false,
  synced_at timestamptz
);

-- Full Riot payloads, shared between players (a friend's game with you is stored once).
create table if not exists matches (
  match_id text primary key,
  region text not null,
  queue_id int not null,
  season int not null,
  ended_at timestamptz not null,
  data jsonb not null,
  timeline jsonb
);
create index if not exists matches_ended_idx on matches (ended_at desc);

-- One row per tracked player per game: everything the history, champion and improvement tabs need
-- without loading the full payloads.
create table if not exists player_matches (
  puuid text not null references players (puuid) on delete cascade,
  match_id text not null references matches (match_id) on delete cascade,
  season int not null,
  queue_id int not null,
  ended_at timestamptz not null,
  summary jsonb not null,
  lp_delta int,
  primary key (puuid, match_id)
);
create index if not exists player_matches_recent_idx on player_matches (puuid, ended_at desc);

-- Rank history (taken on every sync when something changed).
create table if not exists rank_snapshots (
  id bigint generated always as identity primary key,
  puuid text not null references players (puuid) on delete cascade,
  queue_type text not null,
  rating int not null,
  tier text not null,
  division text not null,
  lp int not null,
  wins int not null,
  losses int not null,
  taken_at timestamptz not null default now()
);
create index if not exists rank_snapshots_idx on rank_snapshots (puuid, queue_type, taken_at desc);

-- Cache of league entries for any player (lobby ranks), with the time they were read.
create table if not exists league_cache (
  puuid text primary key,
  entries jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Free-form per-player settings (e.g. LP the player typed in).
create table if not exists player_notes (
  puuid text primary key references players (puuid) on delete cascade,
  data jsonb not null default '{}'::jsonb
);

alter table players enable row level security;
alter table matches enable row level security;
alter table player_matches enable row level security;
alter table rank_snapshots enable row level security;
alter table league_cache enable row level security;
alter table player_notes enable row level security;
