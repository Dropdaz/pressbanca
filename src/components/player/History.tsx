'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { duration, halftone, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { Items, Portrait, Score, Seg } from '../ui';

export interface HistoryRow {
  matchId: string;
  endedAt: number;
  durationSec: number;
  win: boolean;
  remake: boolean;
  champion: string;
  image: string;
  role: string;
  k: number;
  d: number;
  a: number;
  cs: number;
  cs10: number;
  kp: number;
  dmgShare: number;
  vision: number;
  score: number;
  /** Best score of the winning team (MVP) / of the losing team (ACE). */
  mvp: boolean;
  ace: boolean;
  /** Rank by score among the 10 players. */
  place: number | null;
  lpDelta: number | null;
  opponent: { champion: string; image: string } | null;
  items: (string | null)[];
}

// Values must match ROLE_NAMES in games/lol/metrics.ts (index 0 = no filter).
const ROLES = ['Todos', 'Top', 'Jungla', 'Mid', 'ADC', 'Support'];
const PAGE = 25;

export function History({ rows, slug }: { rows: HistoryRow[]; slug: string }) {
  const [role, setRole] = useState(0);
  const [result, setResult] = useState(0);
  const [champ, setChamp] = useState('');
  const [shown, setShown] = useState(PAGE);
  const now = useNow();
  const champs = useMemo(() => [...new Set(rows.map((r) => r.champion))].sort(), [rows]);
  const list = rows.filter((r) => (role === 0 || r.role === ROLES[role]) && (result === 0 || (result === 1 ? r.win : !r.win)) && (!champ || r.champion === champ));
  const wins = list.filter((r) => r.win && !r.remake).length;
  const games = list.filter((r) => !r.remake).length;
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: 18 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Seg label="Rol" options={ROLES.map((r) => ({ label: r }))} value={role} onChange={(i) => { setRole(i); setShown(PAGE); }} width={78} />
          <Seg label="Resultado" options={['Todas', 'Victorias', 'Derrotas'].map((r) => ({ label: r }))} value={result} onChange={(i) => { setResult(i); setShown(PAGE); }} width={92} />
          <label className="vh" htmlFor="champ-filter">Campeón</label>
          <select id="champ-filter" className="reg" value={champ} onChange={(e) => { setChamp(e.target.value); setShown(PAGE); }} style={{ height: 40 }}>
            <option value="">Todos los campeones</option>
            {champs.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="m" style={{ fontSize: 13, color: 'var(--tx2)' }}>
          {games} partidas · <span style={{ color: 'var(--win)' }}>{wins}V</span> <span style={{ color: 'var(--loss)' }}>{games - wins}D</span> · {games ? Math.round((100 * wins) / games) : 0}%
        </div>
      </div>

      {list.slice(0, shown).map((r, i) => {
        const color = r.remake ? 'var(--tx3)' : r.win ? 'var(--win)' : 'var(--loss)';
        return (
          <Link key={r.matchId} href={`/p/${slug}/match/${encodeURIComponent(r.matchId)}`} className={`match rise${r.mvp ? ' mvp' : r.ace ? ' ace' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms`, opacity: r.remake ? 0.55 : 1 }}>
            <div className="mh" style={{ gridTemplateColumns: '8px 64px 140px 120px 90px 90px minmax(0,1fr) 84px 76px', cursor: 'pointer' }}>
              <div className="strip" style={{ backgroundImage: halftone(color, 1.4), backgroundColor: r.win ? 'var(--win-tint)' : 'var(--loss-tint)' }} />
              <Portrait size={56} color={color} image={r.image} name={r.champion} dot={1.5} inset={0.18} fontSize={18} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {r.remake ? 'Remake' : r.win ? 'Victoria' : 'Derrota'}
                  {r.mvp && <span className="tagb mvp">MVP</span>}
                  {r.ace && <span className="tagb ace">ACE</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.champion}</div>
                <div className="m" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 3 }}>
                  {r.role} · {duration(r.durationSec)}
                  {now ? ` · ${timeAgo(r.endedAt, now)}` : ''}
                </div>
              </div>
              <div>
                <div className="m" style={{ fontSize: 17, fontWeight: 700 }}>
                  {r.k}<span style={{ color: 'var(--tx3)' }}> / </span><span style={{ color: 'var(--loss)' }}>{r.d}</span><span style={{ color: 'var(--tx3)' }}> / </span>{r.a}
                </div>
                <div className="m" style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 3 }}>KP {Math.round(r.kp * 100)}%</div>
              </div>
              <div className="c-cs">
                <div className="m" style={{ fontWeight: 700 }}>{r.cs} CS</div>
                <div className="m" style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 3 }}>{Math.round(r.cs10)} @10 · {(r.cs / Math.max(1, r.durationSec / 60)).toFixed(1)}/m</div>
              </div>
              <div className="c-lobby" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {r.opponent ? (
                  <>
                    <span className="m" style={{ fontSize: 10, color: 'var(--tx3)' }}>VS</span>
                    <img src={r.opponent.image} alt={r.opponent.champion} title={r.opponent.champion} width={30} height={30} style={{ borderRadius: 8 }} />
                  </>
                ) : null}
              </div>
              <div className="c-items" style={{ display: 'flex', gap: 5 }}>
                <Items items={r.items} size={26} />
              </div>
              <div className="m" style={{ textAlign: 'right', fontWeight: 700, fontSize: 16, color: r.lpDelta == null ? 'var(--tx3)' : r.lpDelta >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                {r.lpDelta == null ? '—' : `${r.lpDelta >= 0 ? '+' : '−'}${Math.abs(r.lpDelta)}`}
                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--tx3)' }}> LP</span>
              </div>
              <div className="c-score" style={{ textAlign: 'center' }}>
                <Score value={r.remake ? null : r.score} size={16} />
                {r.place != null && !r.remake && <div className="m" style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 4 }}>#{r.place} de 10</div>}
              </div>
            </div>
          </Link>
        );
      })}
      {shown < list.length && (
        <button type="button" className="btn2" style={{ alignSelf: 'center', height: 48 }} onClick={() => setShown((s) => s + PAGE)}>
          Ver más · quedan {list.length - shown}
        </button>
      )}
      {!list.length && <p style={{ color: 'var(--tx2)' }}>Aún no hay partidas: la temporada se está importando en segundo plano.</p>}
    </section>
  );
}

export interface ChampionRow {
  champion: string;
  image: string;
  games: number;
  wins: number;
  kda: number;
  csPerMin: number;
  cs10: number;
  kp: number;
  dmgShare: number;
  score: number;
  lastPlayed: number;
  matchups: { champion: string; image: string; games: number; wins: number }[];
}

type SortKey = 'games' | 'wr' | 'kda' | 'csPerMin' | 'score';

export function Champions({ rows }: { rows: ChampionRow[] }) {
  const [sort, setSort] = useState<SortKey>('games');
  const [open, setOpen] = useState<string | null>(null);
  const wr = (r: ChampionRow) => r.wins / Math.max(1, r.games);
  const sorted = [...rows].sort((a, b) => (sort === 'wr' ? wr(b) - wr(a) || b.games - a.games : (b[sort] as number) - (a[sort] as number)));
  const th = (k: SortKey, label: string) => (
    <th>
      <button type="button" onClick={() => setSort(k)} style={{ all: 'unset', cursor: 'pointer', color: sort === k ? 'var(--acc)' : undefined }}>
        {label}
        {sort === k ? ' ↓' : ''}
      </button>
    </th>
  );
  return (
    <section className="card rise">
      <div className="eyebrow">Campeones · esta temporada</div>
      <h2 className="h2" style={{ marginTop: 8 }}>Tu pool</h2>
      <div style={{ overflowX: 'auto', marginTop: 18 }}>
        <table className="tbl" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>Campeón</th>
              {th('games', 'Partidas')}
              {th('wr', '% victorias')}
              {th('kda', 'KDA')}
              {th('csPerMin', 'CS/min')}
              <th>CS @10</th>
              <th>KP</th>
              <th>% daño</th>
              {th('score', 'Nota')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <Fragment key={r.champion}>
                <tr onClick={() => setOpen(open === r.champion ? null : r.champion)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src={r.image} alt="" width={36} height={36} style={{ borderRadius: 10 }} />
                      <span style={{ fontWeight: 600 }}>{r.champion}</span>
                    </div>
                  </td>
                  <td className="m">{r.games}</td>
                  <td className="m" style={{ color: wr(r) >= 0.55 ? 'var(--win)' : wr(r) < 0.45 ? 'var(--loss)' : undefined }}>
                    {Math.round(wr(r) * 100)}% <span style={{ color: 'var(--tx3)', fontSize: 12 }}>{r.wins}V {r.games - r.wins}D</span>
                  </td>
                  <td className="m">{r.kda.toFixed(2)}</td>
                  <td className="m">{r.csPerMin.toFixed(1)}</td>
                  <td className="m">{r.cs10.toFixed(0)}</td>
                  <td className="m">{Math.round(r.kp * 100)}%</td>
                  <td className="m">{Math.round(r.dmgShare * 100)}%</td>
                  <td><Score value={r.score} size={13} /></td>
                </tr>
                {open === r.champion && (
                  <tr>
                    <td colSpan={9} style={{ background: 'var(--s2)' }}>
                      <div className="eyebrow" style={{ marginBottom: 10 }}>Enfrentamientos con {r.champion}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {r.matchups.map((m) => (
                          <span key={m.champion} className="rk" style={{ borderColor: m.wins / m.games >= 0.5 ? 'var(--win)' : 'var(--loss)' }}>
                            <img src={m.image} alt="" width={20} height={20} style={{ borderRadius: 5 }} />
                            vs {m.champion} · {m.wins}V {m.games - m.wins}D
                          </span>
                        ))}
                        {!r.matchups.length && <span style={{ color: 'var(--tx3)' }}>Sin datos de rivales de calle.</span>}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
