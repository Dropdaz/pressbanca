'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { levels, peaks, topo } from '@/lib/art';
import { halftone, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { ApiStatus } from '../ApiStatus';
import { GameAccent, Logo, Portrait, ThemeToggle } from '../ui';

export interface PlayerCard {
  puuid: string;
  slug: string;
  name: string;
  tag: string;
  region: string;
  icon: string | null;
  level: number | null;
  rank: { label: string; color: string; lp: number } | null;
  season: { wins: number; losses: number } | null;
  stored: number;
  importing: boolean;
  last: { champion: string; image: string; win: boolean; endedAt: number; k: number; d: number; a: number } | null;
  form: boolean[];
}

function buildArt() {
  const lv = levels(14, 0.08, 0.07);
  const A = topo(1440, 760, 64, 34, lv, peaks(1440, 760, [[0.72, 0.3, 0.2, 1.0], [0.18, 0.62, 0.26, 0.7], [0.5, 0.95, 0.3, 0.6], [0.95, 0.8, 0.18, 0.5], [0.05, 0.1, 0.16, 0.5]], 1.3), 4);
  const B = topo(1440, 760, 48, 26, lv, peaks(1440, 760, [[0.3, 0.2, 0.22, 0.9], [0.85, 0.6, 0.25, 0.8], [0.6, 0.9, 0.2, 0.6]], 4.1), 5);
  return { aMinor: A.minor, aMajor: A.major, bMinor: B.minor };
}

export function Selector({ players, storage, hasKey }: { players: PlayerCard[]; storage: 'supabase' | 'local'; hasKey: boolean }) {
  const art = useMemo(buildArt, []);
  const now = useNow();
  useRosterSync(players);
  const live = useLiveRoster();
  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
      <GameAccent game="lol" />
      <svg className="topo lb" viewBox="0 0 1440 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ height: 880 }}>
        <path d={art.bMinor} fill="none" style={{ stroke: 'var(--tx3)' }} strokeOpacity=".16" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <svg className="topo la" viewBox="0 0 1440 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ height: 880 }}>
        <path d={art.aMinor} fill="none" style={{ stroke: 'var(--acc)' }} strokeOpacity=".22" strokeWidth="1" strokeLinecap="round" />
        <path d={art.aMajor} fill="none" style={{ stroke: 'var(--acc)' }} strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <div aria-hidden="true" style={{ position: 'absolute', inset: '0 0 auto 0', height: 880, background: 'radial-gradient(70% 70% at 72% 30%, transparent, var(--bg) 92%)' }} />

      <nav style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '28px clamp(20px, 5vw, 64px)' }}>
        <Logo />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ApiStatus />
          <ThemeToggle />
        </div>
      </nav>

      <main style={{ position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto', padding: '24px clamp(20px, 5vw, 64px) 80px', display: 'flex', flexDirection: 'column', gap: 36 }}>
        <div>
          <div className="eyebrow rise" style={{ color: 'var(--acc)' }}>Partida a partida</div>
          <h1 className="d rise" style={{ margin: '14px 0 0', fontSize: 'clamp(40px, 6vw, 84px)', animationDelay: '80ms' }}>
            ¿Quién <span style={{ color: 'var(--acc)' }}>juega?</span>
          </h1>
          <p className="rise" style={{ margin: '18px 0 0', fontSize: 'clamp(16px, 1.5vw, 20px)', lineHeight: 1.5, color: 'var(--tx2)', maxWidth: 640, animationDelay: '160ms' }}>
            Elige un perfil: historial completo de ranked, el análisis del coach de cada partida y estadísticas en directo mientras juegas.
          </p>
          {(!hasKey || storage === 'local') && (
            <p className="m rise" style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--tx3)' }}>
              {!hasKey ? 'Falta configurar RIOT_API_KEY. ' : ''}
              {storage === 'local' ? 'Almacenamiento: archivos locales (.data/). Configura SUPABASE_URL y SUPABASE_SECRET_KEY para usar Supabase.' : ''}
            </p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 20 }}>
          {players.map((p, i) => (
            <Link key={p.slug} href={`/p/${p.slug}`} className={`tile rise${live[p.puuid] ? ' live' : ''}`} style={{ position: 'relative', minHeight: 0, gap: 16, animationDelay: `${200 + i * 70}ms` }}>
              {live[p.puuid] && <LiveBadge g={live[p.puuid]!} now={now} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ position: 'relative', flex: 'none' }}>
                  <Portrait size={84} color={p.rank?.color ?? 'var(--tx3)'} image={p.icon} name={p.name} dot={1.8} grid={7} inset={0.18} />
                  {p.level != null && (
                    <span className="m" style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', fontSize: 11, background: 'var(--s3)', border: '1px solid var(--line2)', borderRadius: 999, padding: '1px 8px' }}>{p.level}</span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="d" style={{ fontSize: 24, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div className="m" style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 4 }}>#{p.tag} · {p.region}</div>
                  <div style={{ fontWeight: 700, marginTop: 8, color: p.rank?.color ?? 'var(--tx2)' }}>{p.rank ? `${p.rank.label} · ${p.rank.lp} LP` : 'Sin rango'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', gap: 4 }} aria-label="Últimas 10 partidas">
                  {p.form.map((w, k) => (
                    <span key={k} style={{ width: 12, height: 12, borderRadius: '50%', backgroundImage: halftone(w ? 'var(--win)' : 'var(--loss)', 1.2), backgroundSize: '4px 4px', border: `1.5px solid ${w ? 'var(--win)' : 'var(--loss)'}` }} />
                  ))}
                </div>
                {p.season && (
                  <span className="m" style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--win)' }}>{p.season.wins}V</span> <span style={{ color: 'var(--loss)' }}>{p.season.losses}D</span>
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: '1px solid var(--line)', fontSize: 13, color: 'var(--tx2)' }}>
                {p.last ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <img src={p.last.image} alt="" width={22} height={22} style={{ borderRadius: 6 }} />
                    <span style={{ color: p.last.win ? 'var(--win)' : 'var(--loss)', fontWeight: 600 }}>{p.last.win ? 'Victoria' : 'Derrota'}</span>
                    <span className="m">{p.last.k}/{p.last.d}/{p.last.a}</span>
                    <span style={{ color: 'var(--tx3)' }}>{now ? timeAgo(p.last.endedAt, now) : ''}</span>
                  </span>
                ) : (
                  <span>Aún no hay partidas guardadas</span>
                )}
                <span className="m" style={{ fontSize: 11, color: p.importing ? 'var(--acc)' : 'var(--tx3)', whiteSpace: 'nowrap' }}>{p.importing ? `importando · ${p.stored}` : `${p.stored} partidas`}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

interface LiveInfo {
  startedAt: number;
  queue: string;
  champion: string;
  image: string | null;
}

/** Who is in a game right now: polls /api/live-roster every 45 s. */
function useLiveRoster() {
  const [live, setLive] = useState<Record<string, LiveInfo | null>>({});
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await (await fetch('/api/live-roster', { cache: 'no-store' })).json();
        if (alive && !r.limited) setLive(r.live);
      } catch {
        /* offline */
      }
      if (alive) timer = setTimeout(poll, 45_000);
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  return live;
}

function LiveBadge({ g, now }: { g: LiveInfo; now: number | null }) {
  const mins = now && g.startedAt ? Math.max(0, Math.floor((now - g.startedAt) / 60000)) : null;
  return (
    <span className="livebadge" title={g.queue}>
      <span className="livedot" aria-hidden="true" />
      {g.image && <img src={g.image} alt="" width={22} height={22} style={{ borderRadius: '50%' }} />}
      <span>EN PARTIDA{mins != null && g.startedAt ? ` · ${mins} min` : ''}</span>
    </span>
  );
}

/**
 * Keeps the roster fresh while the home page is open: players still importing their season go first
 * (one sync every few seconds), otherwise everyone is synced in turn. Respects the API cooldown.
 */
function useRosterSync(players: PlayerCard[]) {
  const router = useRouter();
  const latest = useRef(players);
  latest.current = players;
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let turn = 0;
    const loop = async () => {
      const list = latest.current;
      const importing = list.some((p) => p.importing);
      const target = list.find((p) => p.importing) ?? list[turn++ % Math.max(1, list.length)];
      let delay = importing ? 4000 : 60_000 / Math.max(1, list.length);
      if (target) {
        try {
          const r = await (await fetch(`/api/track/${target.puuid}/sync`, { method: 'POST' })).json();
          if (r.limited) delay = 20_000;
          else if (r.newMatches?.length || r.backfill?.stored || r.backfill?.done !== !target.importing) router.refresh();
        } catch {
          delay = 20_000;
        }
      }
      if (alive) timer = setTimeout(loop, delay);
    };
    timer = setTimeout(loop, 1500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [router]);
}
