'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ShownRank } from '@/core/types';
import { levels, peaks, topo } from '@/lib/art';
import { timeAgo } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { DotBar, GameAccent, Logo, Portrait, Seg, ThemeToggle } from '../ui';
import { ApiStatus } from '../ApiStatus';
import { LiveWindow, type LiveData } from './LiveWindow';
import { TABS, useTab } from './TabState';

interface HeaderPlayer {
  puuid: string;
  slug: string;
  name: string;
  tag: string;
  region: string;
  level: number | null;
  icon: string | null;
  importing: boolean;
  syncedAt: number | null;
}


export function PlayerHeader({ player, shown, season, recent, stored }: { player: HeaderPlayer; shown: ShownRank | null; season: { wins: number; losses: number } | null; recent: { wins: number; losses: number }; stored: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const now = useNow(15_000);
  const base = `/p/${player.slug}`;
  const inMatch = pathname.includes('/match/');
  const { tab, setTab } = useTab();
  const tabIndex = TABS.findIndex((t) => t.key === tab);
  const openTab = (i: number) => {
    const key = TABS[i].key;
    setTab(key, !inMatch);
    // From a game breakdown: back to the profile (cached by the router, see staleTimes) on that tab.
    if (inMatch) router.push(key === 'stats' ? base : `${base}#${key}`);
  };
  const art = useMemo(() => topo(1280, 300, 64, 20, levels(12, 0.1, 0.075), peaks(1280, 300, [[0.84, 0.4, 0.16, 1.0], [0.45, 1.0, 0.22, 0.7], [0.1, 0.2, 0.14, 0.5]], 2.2), 4), []);
  const color = shown?.color ?? 'var(--tx3)';

  // ── Background sync: on open, then every 90 s (every 15 s while the season is importing).
  const [sync, setSync] = useState<{ importing: boolean; syncing: boolean; at: number | null; limited: boolean }>({ importing: player.importing, syncing: false, at: player.syncedAt, limited: false });
  const syncOnce = useRef<() => Promise<string[]>>(async () => []);
  syncOnce.current = async () => {
    setSync((s) => ({ ...s, syncing: true }));
    try {
      const r = await (await fetch(`/api/track/${player.puuid}/sync`, { method: 'POST' })).json();
      if (r.error) return [];
      setSync({ importing: !r.backfill.done, syncing: false, at: Date.now(), limited: r.limited });
      if (r.newMatches.length || r.backfill.stored) router.refresh();
      return r.newMatches as string[];
    } catch {
      return [];
    } finally {
      setSync((s) => ({ ...s, syncing: false }));
    }
  };
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await syncOnce.current();
      if (alive) timer = setTimeout(loop, sync.importing ? 15_000 : 90_000);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [player.puuid, sync.importing]);

  // ── Live game: poll every 30 s; when a game ends, wait for it to be stored and open its breakdown.
  const [live, setLive] = useState<LiveData | null>(null);
  const [ended, setEnded] = useState<{ gameId: number; since: number } | null>(null);
  const wasLive = useRef<LiveData | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await (await fetch(`/api/track/${player.puuid}/live`)).json();
        if (!alive) return;
        if (r.live) {
          setLive(r.live);
          wasLive.current = r.live;
        } else if (wasLive.current && !r.limited) {
          setEnded({ gameId: wasLive.current.gameId, since: Date.now() });
          wasLive.current = null;
          setLive(null);
        }
      } catch {
        /* offline: try again later */
      }
      if (alive) timer = setTimeout(poll, 30_000);
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [player.puuid]);
  useEffect(() => {
    if (!ended) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const wait = async () => {
      const fresh = await syncOnce.current();
      const id = fresh.find((m) => m.endsWith(`_${ended.gameId}`)) ?? fresh[0];
      if (!alive) return;
      if (id) {
        setEnded(null);
        router.push(`${base}/match/${encodeURIComponent(id)}?fresh=1`);
      } else if (Date.now() - ended.since < 8 * 60_000) timer = setTimeout(wait, 15_000);
      else setEnded(null);
    };
    timer = setTimeout(wait, 10_000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ended, base, router]);

  const total = recent.wins + recent.losses;
  return (
    <>
      <GameAccent game="lol" />
      <header className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 24, paddingBottom: 20 }}>
        <Logo size={34} compact />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <ApiStatus />
          <Link className="btn2" href="/">Cambiar jugador</Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 20 }}>
        <section className="card rise" style={{ padding: 0, background: 'linear-gradient(180deg, var(--s2), var(--s1))' }}>
          <svg className="la" viewBox="0 0 1280 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <path d={art.minor} fill="none" style={{ stroke: 'var(--tx3)' }} strokeOpacity=".22" strokeWidth="1" strokeLinecap="round" />
            <path d={art.major} fill="none" style={{ stroke: 'var(--acc)' }} strokeOpacity=".45" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <div className="profile-head" style={{ position: 'relative', padding: 30, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '22px 36px' }}>
            <div style={{ position: 'relative', flex: 'none' }}>
              <Portrait size={112} color={color} image={player.icon} name={player.name} dot={2.2} grid={8} inset={0.19} fontSize={32} />
              {player.level != null && (
                <div className="m" style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', background: 'var(--s3)', border: '1px solid var(--line2)', borderRadius: 999, padding: '2px 10px', fontSize: 12 }}>Lv {player.level}</div>
              )}
            </div>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div className="eyebrow" style={{ color: 'var(--acc)' }}>{player.region} · Clasificatoria Solo/Dúo</div>
              <h1 className="d" style={{ margin: '8px 0 0', fontSize: 'clamp(30px, 4vw, 50px)', overflowWrap: 'anywhere' }}>
                {player.name}
                <span className="m" style={{ fontWeight: 500, fontSize: '.42em', color: 'var(--tx3)', letterSpacing: 0, marginLeft: 10 }}>#{player.tag}</span>
              </h1>
              <div className="m" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 12, color: 'var(--tx3)', flexWrap: 'wrap' }}>
                {sync.syncing && <span className="blobL" style={{ width: 12, height: 12 }} />}
                <span>{sync.at && now ? `Sincronizado ${timeAgo(sync.at, now)}` : 'Sincronizando…'}</span>
                <span>· {stored} partidas esta temporada</span>
                {sync.importing && <span style={{ color: 'var(--acc)' }}>· importando temporada…</span>}
                {sync.limited && <span style={{ color: 'var(--loss-ink)' }}>· límite de Riot, reanudando</span>}
              </div>
            </div>
            <div className="rank-pod" style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '18px 22px', borderRadius: 24, background: 'var(--ov)', border: '1px solid var(--line2)' }}>
              <div>
                <div className="eyebrow">Rango</div>
                <div className="d" style={{ fontSize: 26, color, marginTop: 4 }}>{shown?.label ?? 'Sin rango'}</div>
                {shown && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <div style={{ width: 120 }}>
                      <DotBar pct={shown.progress} color={color} />
                    </div>
                    <span className="m" style={{ fontSize: 13 }}>{shown.lp} LP</span>
                  </div>
                )}
              </div>
              <div style={{ borderLeft: '1px solid var(--line2)', paddingLeft: 22 }}>
                <div className="eyebrow">Últimas {total}</div>
                <div className="m" style={{ fontSize: 20, marginTop: 4 }}>
                  <span style={{ color: 'var(--win)' }}>{recent.wins}V</span> <span style={{ color: 'var(--loss)' }}>{recent.losses}D</span>
                </div>
                {season && <div className="m" style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 4 }}>Temporada {season.wins}V {season.losses}D</div>}
              </div>
            </div>
          </div>
        </section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <Seg label="Secciones" options={TABS.map((t) => ({ label: t.label }))} value={inMatch ? -1 : tabIndex} onChange={openTab} width={112} />
          </div>
          {inMatch && (
            <button type="button" className="btn2" onClick={() => openTab(1)}>
              ← Volver al historial
            </button>
          )}
        </div>
      </div>
      {live && <LiveWindow live={live} />}
      {ended && !live && (
        <div className="card" role="status" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 50, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderColor: 'var(--acc)' }}>
          <span className="blobL" style={{ width: 22, height: 22 }} />
          <span>Partida terminada: preparando tu análisis…</span>
        </div>
      )}
    </>
  );
}
