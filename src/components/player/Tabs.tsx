'use client';

import { useMemo } from 'react';
import type { ProfileView } from '@/core/types';
import { fmt, halftone, scoreColor } from '@/lib/format';
import { useIntro } from '@/lib/hooks';
import { LiveGame, Outlook } from '../profile/Outlook';
import { Entities, Highlights, Performance } from '../profile/Sections';
import { ClimbCard, LadderCard, MmrCard } from '../profile/Summit';

export interface SeasonSummary {
  games: number;
  wins: number;
  kda: string;
  csPerMin: string;
  kp: string;
  visionPerMin: string;
  score: string;
  dmgShare: string;
}

export function StatsTab({ data, season }: { data: ProfileView; season: SeasonSummary }) {
  const tiles: [string, string][] = [
    ['Partidas', `${season.games}`],
    ['% victorias', season.games ? `${Math.round((100 * season.wins) / season.games)}%` : '—'],
    ['KDA', season.kda],
    ['CS / min', season.csPerMin],
    ['Participación en kills', season.kp],
    ['Daño del equipo', season.dmgShare],
    ['Visión / min', season.visionPerMin],
    ['Nota media', season.score],
  ];
  return (
    <>
      {data.live && <LiveGame live={data.live} />}
      <section className="card rise">
        <div className="eyebrow">Esta temporada</div>
        <h2 className="h2" style={{ marginTop: 8 }}>Solo/Dúo de un vistazo</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 18 }}>
          {tiles.map(([k, v]) => (
            <div key={k} className="stat-tile">
              <div className="eyebrow">{k}</div>
              <div className="d m" style={{ fontFamily: 'var(--fd)', fontSize: 26, marginTop: 6, color: k === 'Nota media' && v !== '—' ? scoreColor(Number(v)) : undefined }}>{v}</div>
            </div>
          ))}
        </div>
      </section>
      <Performance perf={data.performance} playerName={data.header.name} />
      <Highlights feats={data.feats} games={data.header.recent.wins + data.header.recent.losses} />
      <Entities table={data.entities} dist={data.distribution} />
    </>
  );
}

export interface RankPoint {
  at: number;
  rating: number;
  label: string;
  color: string;
}

export function MmrTab({ data, history, owner }: { data: ProfileView; history: RankPoint[]; owner: { game: string; puuid: string } }) {
  const e = useIntro(1700);
  return (
    <>
      <section className="g12">
        <MmrCard mmr={data.mmr} shown={data.header.shown} ladder={data.ladder} e={e} />
        <LadderCard ladder={data.ladder} shown={data.header.shown} mmr={data.mmr} reach={data.reach} />
      </section>
      <Outlook queues={data.outlook} owner={owner} />
      <RankHistory points={history} mmr={data.mmr.value} />
      <section className="g12">
        <ClimbCard mmr={data.mmr} reach={data.reach} scale={data.scale} />
      </section>
    </>
  );
}

/** Real rank over time from the tracker's snapshots, with the current MMR estimate as a reference line. */
function RankHistory({ points, mmr }: { points: RankPoint[]; mmr: number }) {
  const W = 1000, H = 260, P = 30;
  const g = useMemo(() => {
    if (points.length < 2) return null;
    const vals = [...points.map((p) => p.rating), mmr];
    const lo = Math.floor((Math.min(...vals) - 40) / 100) * 100;
    const hi = Math.ceil((Math.max(...vals) + 40) / 100) * 100;
    const t0 = points[0].at, t1 = points[points.length - 1].at;
    const x = (t: number) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
    const y = (v: number) => H - P - ((v - lo) / Math.max(1, hi - lo)) * (H - 2 * P);
    // Step line: rank only changes at snapshots.
    let d = `M${x(points[0].at)} ${y(points[0].rating)}`;
    for (let i = 1; i < points.length; i++) d += `H${x(points[i].at)}V${y(points[i].rating)}`;
    const grid = [];
    for (let v = lo; v <= hi; v += 100) grid.push({ y: y(v), v });
    return { d, grid, mmrY: y(mmr), last: points[points.length - 1], lastX: x(points[points.length - 1].at), lastY: y(points[points.length - 1].rating) };
  }, [points, mmr]);
  return (
    <section className="card rise">
      <div className="eyebrow">Historial de rango · real</div>
      <h2 className="h2" style={{ marginTop: 8 }}>Tus LP a lo largo del tiempo</h2>
      {g ? (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Evolución de tu rango" style={{ display: 'block', marginTop: 16 }}>
          {g.grid.map((l) => (
            <g key={l.v}>
              <path d={`M${P} ${l.y}H${W - P}`} style={{ stroke: 'var(--line)' }} strokeDasharray="2 6" />
            </g>
          ))}
          <path d={`M${P} ${g.mmrY}H${W - P}`} style={{ stroke: 'var(--acc)' }} strokeDasharray="6 6" strokeOpacity=".7" />
          <text x={W - P} y={g.mmrY - 6} textAnchor="end" style={{ fill: 'var(--acc)', fontFamily: 'var(--fm)', fontSize: 11 }}>MMR EST. {fmt(mmr)}</text>
          <path d={g.d} fill="none" style={{ stroke: g.last.color }} strokeWidth="2.6" strokeLinejoin="round" />
          <circle cx={g.lastX} cy={g.lastY} r="6" style={{ fill: g.last.color }} />
        </svg>
      ) : (
        <p style={{ margin: '14px 0 0', color: 'var(--tx2)', lineHeight: 1.55 }}>
          Riot no guarda el historial de rango, así que PressBanca lo construye: cada sincronización guarda tu rango cuando cambia. La gráfica aparecerá tras tus próximas partidas.
          <span style={{ display: 'inline-block', width: 10, height: 10, marginLeft: 8, borderRadius: '50%', backgroundImage: halftone('var(--acc)', 1.2), backgroundSize: '4px 4px' }} />
        </p>
      )}
    </section>
  );
}
