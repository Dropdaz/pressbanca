'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CATEGORY_LABEL, type DeathView, type InsightCategory } from '@/core/types';
import { polyline } from '@/lib/art';
import { scoreColor, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { CATEGORY_COLOR } from '@/lib/insights';
import { Score } from '../ui';

export interface GameRef {
  matchId: string;
  champion: string;
  image: string;
  win: boolean;
  endedAt: number;
  score: number;
  grade: string;
  kda: string;
  mvp: boolean;
}
export interface Example {
  game: GameRef;
  title: string;
  detail: string;
  minute?: number;
}
export interface Pattern {
  id: string;
  category: InsightCategory;
  name: string;
  count: number;
  severity: number;
  /** matchIds where it happened */
  games: string[];
  examples: Example[];
}
export interface PlanItem {
  id: string;
  category: InsightCategory;
  title: string;
  how: string[];
  count: number;
  games: string[];
  examples: Example[];
}
export interface CategoryRow {
  key: string;
  label: string;
  recent: number;
  before: number | null;
}
export interface DeathKind {
  kind: DeathView['kind'];
  count: number;
  example: Example | null;
}
export interface Killer {
  champion: string;
  image: string | null;
  count: number;
}
export interface DeathSummary {
  total: number;
  perGame: number;
  early: number;
  objectives: number;
  kinds: DeathKind[];
  killers: Killer[];
}
export interface Kpi {
  label: string;
  now: string;
  season: string;
  /** null = about the same */
  better: boolean | null;
  color?: string;
}
export interface ChampLine {
  champion: string;
  image: string;
  games: number;
  wins: number;
  score: number;
}
export interface Trend {
  label: string;
  values: number[];
  seasonAvg: number;
  season: string;
  last10: string;
  better: boolean;
}

const KIND: Record<DeathView['kind'], { label: string; color: string; hint: string }> = {
  gank: { label: 'Ganks', color: 'var(--t-gm)', hint: 'El jungla rival te encontró en tu calle' },
  solo: { label: '1v1 perdidos', color: 'var(--loss)', hint: 'Duelos que no tenías que coger' },
  caught: { label: 'Pillado solo', color: 'var(--t-gold)', hint: 'Solo y sin visión por el mapa' },
  teamfight: { label: 'Teamfights', color: 'var(--t-diamond)', hint: 'Peleas de equipo: a veces es normal' },
  dive: { label: 'Dives', color: 'var(--t-master)', hint: 'Te tiraron bajo torre' },
  skirmish: { label: 'Escaramuzas', color: 'var(--t-plat)', hint: 'Peleas pequeñas de 2–3' },
};

type Props =
  | { empty: true }
  | {
      empty?: false;
      slug: string;
      games: GameRef[];
      kpis: Kpi[];
      plan: PlanItem[];
      mistakes: Pattern[];
      strengths: Pattern[];
      categories: CategoryRow[];
      deaths: DeathSummary;
      champs: ChampLine[];
      trends: Trend[];
    };

export function Improve(props: Props) {
  if (props.empty) return <p style={{ color: 'var(--tx2)' }}>Juega algunas ranked: para seguir tu progreso hace falta al menos una partida guardada.</p>;
  const { slug, games, kpis, plan, mistakes, strengths, categories, deaths, champs, trends } = props;
  return (
    <>
      <Form slug={slug} games={games} kpis={kpis} />

      <section className="card rise">
        <div className="eyebrow" style={{ color: 'var(--acc)' }}>Plan de mejora</div>
        <h2 className="h2" style={{ marginTop: 8 }}>Tus 3 prioridades ahora mismo</h2>
        <p style={{ margin: '8px 0 0', color: 'var(--tx2)', fontSize: 14 }}>Lo que más se repite en tus últimas {games.length} partidas, con momentos reales de cada una.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
          {plan.map((p, i) => (
            <PlanCard key={p.id} p={p} rank={i + 1} slug={slug} games={games} />
          ))}
          {!plan.length && <Good text={`Ningún problema se repite en tus últimas ${games.length} partidas. Sigue así.`} />}
        </div>
      </section>

      <section className="grid2">
        <Categories rows={categories} />
        <Deaths d={deaths} games={games.length} slug={slug} />
      </section>

      <section className="grid2">
        <PatternList title="Errores que se repiten" eyebrow="A corregir" items={mistakes} games={games} slug={slug} bad />
        <PatternList title="Lo que haces bien" eyebrow="A mantener" items={strengths} games={games} slug={slug} />
      </section>

      {champs.length > 0 && <Champs champs={champs} />}

      <section className="card rise">
        <div className="eyebrow">Tendencias</div>
        <h2 className="h2" style={{ marginTop: 8 }}>Últimas 10 partidas frente a tu temporada</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: 14, marginTop: 18 }}>
          {trends.map((t) => (
            <TrendTile key={t.label} t={t} />
          ))}
        </div>
      </section>
    </>
  );
}

/* ───────── Form: last games strip + headline numbers ───────── */

function Form({ slug, games, kpis }: { slug: string; games: GameRef[]; kpis: Kpi[] }) {
  const now = useNow();
  return (
    <section className="card rise">
      <div className="eyebrow">Tu forma</div>
      <h2 className="h2" style={{ marginTop: 8 }}>Tus últimas {games.length} partidas</h2>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '16px 2px 6px' }}>
        {[...games].reverse().map((g) => (
          <Link key={g.matchId} href={`/p/${slug}/match/${encodeURIComponent(g.matchId)}`} title={`${g.champion} · ${g.win ? 'Victoria' : 'Derrota'} · ${g.kda}${now ? ` · ${timeAgo(g.endedAt, now)}` : ''}`} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ position: 'relative', width: 58, height: 58, borderRadius: 16, overflow: 'hidden', border: `2.5px solid ${g.win ? 'var(--win)' : 'var(--loss)'}`, boxShadow: g.mvp ? '0 0 0 3px color-mix(in srgb, var(--sc5) 45%, transparent)' : undefined }}>
              <img src={g.image} alt={g.champion} width={58} height={58} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
              <span className="m" style={{ position: 'absolute', right: 2, bottom: 2, fontSize: 11, fontWeight: 800, padding: '0 5px', borderRadius: 6, background: 'var(--ov)', color: scoreColor(g.score) }}>{g.grade}</span>
            </span>
            <Score value={g.score} size={12} style={{ minWidth: 40, padding: '2px 6px' }} />
          </Link>
        ))}
      </div>
      <div className="m" style={{ fontSize: 11, color: 'var(--tx3)' }}>← más antigua · más reciente →</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 18 }}>
        {kpis.map((k) => (
          <div key={k.label} className="stat-tile">
            <div className="eyebrow">{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span className="d m" style={{ fontFamily: 'var(--fd)', fontSize: 28, color: k.color }}>{k.now}</span>
              <Arrow better={k.better} />
            </div>
            <div className="m" style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4 }}>temporada {k.season}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Arrow({ better }: { better: boolean | null }) {
  if (better == null) return <span className="m" style={{ fontSize: 13, color: 'var(--tx3)' }}>=</span>;
  const c = better ? 'var(--sc4)' : 'var(--sc1)';
  return (
    <span className="m" style={{ fontSize: 12, fontWeight: 700, color: c, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {better ? '▲' : '▼'} {better ? 'mejor' : 'peor'}
    </span>
  );
}

/* ───────── Plan ───────── */

function PlanCard({ p, rank, slug, games }: { p: PlanItem; rank: number; slug: string; games: GameRef[] }) {
  const c = CATEGORY_COLOR[p.category];
  return (
    <article style={{ display: 'grid', gridTemplateColumns: '6px minmax(0, 1fr)', borderRadius: 24, overflow: 'hidden', background: 'var(--s2)', border: `1px solid ${rank === 1 ? c : 'var(--line)'}` }}>
      <div style={{ background: c }} />
      <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '18px 28px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="d" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 20, background: c, color: '#0b0d12', flex: 'none' }}>{rank}</span>
            <div style={{ minWidth: 0 }}>
              <CategoryChip category={p.category} />
              <div style={{ fontWeight: 800, fontSize: 20, marginTop: 4, lineHeight: 1.2 }}>{p.title}</div>
            </div>
          </div>
          <Frequency games={games} hit={p.games} color={c} />
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {p.how.map((h, i) => (
              <li key={h} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr)', gap: 10, fontSize: 14, lineHeight: 1.45 }}>
                <span className="m" style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, border: `1.5px solid ${c}`, color: c }}>{i + 1}</span>
                <span>{h}</span>
              </li>
            ))}
          </ol>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="eyebrow">Ejemplos de tus partidas</div>
          {p.examples.map((e, i) => (
            <ExampleCard key={i} e={e} slug={slug} color={c} />
          ))}
          {!p.examples.length && <p style={{ margin: 0, fontSize: 13, color: 'var(--tx3)' }}>Aparece en {p.count} partidas; ábrelas desde la barra de arriba.</p>}
        </div>
      </div>
    </article>
  );
}

function ExampleCard({ e, slug, color }: { e: Example; slug: string; color: string }) {
  const now = useNow();
  return (
    <Link href={`/p/${slug}/match/${encodeURIComponent(e.game.matchId)}`} className="ex" style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', gap: 12, padding: 12, borderRadius: 18, background: 'var(--s1)', border: '1px solid var(--line)' }}>
      <span style={{ position: 'relative', width: 44, height: 44 }}>
        <img src={e.game.image} alt="" width={44} height={44} style={{ borderRadius: 12, border: `2px solid ${e.game.win ? 'var(--win)' : 'var(--loss)'}` }} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="m" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, color: 'var(--tx3)' }}>
          <span style={{ fontWeight: 700, color: e.game.win ? 'var(--win)' : 'var(--loss)' }}>{e.game.win ? 'Victoria' : 'Derrota'}</span>
          <span>{e.game.champion}</span>
          <span>{e.game.kda}</span>
          {e.minute != null && <span style={{ padding: '1px 6px', borderRadius: 6, background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>min {Math.floor(e.minute)}</span>}
          {now && <span>{timeAgo(e.game.endedAt, now)}</span>}
        </span>
        <span style={{ display: 'block', fontWeight: 700, marginTop: 4 }}>{e.title}</span>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--tx2)', marginTop: 3, lineHeight: 1.4 }}>{e.detail}</span>
        <span className="m" style={{ display: 'block', fontSize: 11, color, marginTop: 6 }}>Ver partida →</span>
      </span>
    </Link>
  );
}

/** One square per analysed game (oldest → newest), filled where the pattern happened. */
function Frequency({ games, hit, color }: { games: GameRef[]; hit: string[]; color: string }) {
  const order = [...games].reverse();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 4 }} aria-label={`En ${hit.length} de ${games.length} partidas`}>
        {order.map((g) => {
          const on = hit.includes(g.matchId);
          return <span key={g.matchId} title={`${g.champion} · ${g.win ? 'V' : 'D'}`} style={{ width: 16, height: 16, borderRadius: 4, background: on ? color : 'var(--s3)', border: on ? 'none' : '1px solid var(--line2)' }} />;
        })}
      </div>
      <span style={{ fontSize: 13, color: 'var(--tx2)' }}>
        en <b style={{ color }}>{hit.length}</b> de {games.length} partidas
      </span>
    </div>
  );
}

function CategoryChip({ category }: { category: InsightCategory }) {
  const c = CATEGORY_COLOR[category];
  return (
    <span className="m" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: c }}>
      <CategoryIcon category={category} color={c} />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

const ICONS: Record<InsightCategory, string> = {
  Laning: 'M4 20V4h16M4 20L20 4',
  Deaths: 'M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3zM9.5 11h.01M14.5 11h.01M10 19v2M14 19v2',
  Objectives: 'M5 21V4h11l-2 4 2 4H5',
  Vision: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  Farming: 'M6 20l6-15 6 15M8.5 14h7',
  Fighting: 'M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4',
  Economy: 'M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',
  Build: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
};
function CategoryIcon({ category, color, size = 14 }: { category: InsightCategory; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ stroke: color, flex: 'none' }} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[category]} />
    </svg>
  );
}

/* ───────── Category scores ───────── */

function Categories({ rows }: { rows: CategoryRow[] }) {
  return (
    <article className="card rise">
      <div className="eyebrow">Por áreas</div>
      <h2 className="h2" style={{ marginTop: 8 }}>Tu nota en cada parte del juego</h2>
      <p style={{ margin: '8px 0 0', color: 'var(--tx2)', fontSize: 14 }}>Últimas 10 partidas. La marca blanca es tu nivel en las 20 anteriores; 5 es la media de la partida.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
        {[...rows].sort((a, b) => a.recent - b.recent).map((r) => {
          const c = scoreColor(r.recent);
          const d = r.before != null ? r.recent - r.before : null;
          return (
            <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr) 44px 58px', gap: 12, alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</span>
              <div style={{ position: 'relative', height: 14, borderRadius: 7, background: 'var(--s3)' }}>
                <div className="grow" style={{ position: 'absolute', inset: 0, width: `${r.recent * 10}%`, borderRadius: 7, background: c }} />
                <div style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, background: 'var(--line2)' }} />
                {r.before != null && <div title={`Antes: ${r.before.toFixed(1)}`} style={{ position: 'absolute', left: `${r.before * 10}%`, top: -4, bottom: -4, width: 3, marginLeft: -1.5, borderRadius: 2, background: 'var(--tx)' }} />}
              </div>
              <span className="m" style={{ fontWeight: 800, color: c }}>{r.recent.toFixed(1)}</span>
              <span className={`dl ${d == null || Math.abs(d) < 0.3 ? 'eq' : d > 0 ? 'up' : 'dn'}`} style={{ textAlign: 'center' }}>{d == null ? '—' : `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

/* ───────── Deaths ───────── */

function Deaths({ d, games, slug }: { d: DeathSummary; games: number; slug: string }) {
  const [open, setOpen] = useState<DeathView['kind'] | null>(d.kinds[0]?.kind ?? null);
  const sel = d.kinds.find((k) => k.kind === open) ?? null;
  return (
    <article className="card rise" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="eyebrow" style={{ color: 'var(--loss)' }}>Cómo mueres</div>
        <h2 className="h2" style={{ marginTop: 8 }}>{d.total} muertes en {games} partidas</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <Mini label="Por partida" value={d.perGame.toFixed(1)} bad={d.perGame >= 6} />
        <Mini label="Antes del 14" value={d.early.toFixed(1)} bad={d.early >= 2} />
        <Mini label="Regalaron objetivo" value={String(d.objectives)} bad={d.objectives >= 3} />
      </div>
      {d.total > 0 && (
        <>
          <div style={{ display: 'flex', height: 22, borderRadius: 11, overflow: 'hidden', gap: 2 }} aria-hidden="true">
            {d.kinds.map((k) => (
              <button key={k.kind} type="button" onClick={() => setOpen(k.kind)} title={`${KIND[k.kind].label}: ${k.count}`} style={{ all: 'unset', cursor: 'pointer', width: `${(100 * k.count) / d.total}%`, background: KIND[k.kind].color, opacity: open && open !== k.kind ? 0.45 : 1, transition: 'opacity .2s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.kinds.map((k) => (
              <button key={k.kind} type="button" onClick={() => setOpen(k.kind)} className="rk" style={{ cursor: 'pointer', borderColor: open === k.kind ? KIND[k.kind].color : undefined, background: open === k.kind ? `color-mix(in srgb, ${KIND[k.kind].color} 14%, transparent)` : undefined }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: KIND[k.kind].color }} />
                {KIND[k.kind].label} <b className="m">{k.count}</b>
              </button>
            ))}
          </div>
          {sel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--tx2)' }}>{KIND[sel.kind].hint}. Ejemplo:</div>
              {sel.example && <ExampleCard e={sel.example} slug={slug} color={KIND[sel.kind].color} />}
            </div>
          )}
        </>
      )}
      {d.killers.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Quién te mata más</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {d.killers.map((k) => (
              <span key={k.champion} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 4px', borderRadius: 999, background: 'var(--s2)' }}>
                {k.image && <img src={k.image} alt="" width={30} height={30} style={{ borderRadius: '50%' }} />}
                <span style={{ fontWeight: 600, fontSize: 14 }}>{k.champion}</span>
                <span className="m" style={{ color: 'var(--loss)', fontWeight: 700 }}>×{k.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function Mini({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 16, background: bad ? 'var(--loss-tint)' : 'var(--s2)', border: `1px solid ${bad ? 'color-mix(in srgb, var(--loss) 40%, transparent)' : 'var(--line)'}` }}>
      <div className="eyebrow" style={{ fontSize: 10 }}>{label}</div>
      <div className="d m" style={{ fontFamily: 'var(--fd)', fontSize: 24, marginTop: 4, color: bad ? 'var(--loss-ink)' : undefined }}>{value}</div>
    </div>
  );
}

/* ───────── Patterns ───────── */

function PatternList({ title, eyebrow, items, games, slug, bad }: { title: string; eyebrow: string; items: Pattern[]; games: GameRef[]; slug: string; bad?: boolean }) {
  const c = bad ? 'var(--loss)' : 'var(--sc4)';
  return (
    <article className="card rise">
      <div className="eyebrow" style={{ color: c }}>{eyebrow}</div>
      <h2 className="h2" style={{ marginTop: 8 }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {items.slice(0, 6).map((p, i) => (
          <PatternRow key={p.id} p={p} games={games} slug={slug} startOpen={i === 0} />
        ))}
        {!items.length && <p style={{ margin: 0, color: 'var(--tx3)' }}>Todavía no se repite nada.</p>}
      </div>
    </article>
  );
}

function PatternRow({ p, games, slug, startOpen }: { p: Pattern; games: GameRef[]; slug: string; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const c = CATEGORY_COLOR[p.category];
  return (
    <div style={{ borderRadius: 18, background: 'var(--s2)', borderLeft: `4px solid ${c}`, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', width: 'calc(100% - 32px)' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <CategoryIcon category={p.category} color={c} size={18} />
            <span style={{ fontWeight: 700 }}>{p.name}</span>
          </span>
          <span className="m" style={{ fontSize: 12, color: 'var(--tx3)', flex: 'none' }}>{open ? '▲' : '▼'}</span>
        </span>
        <Frequency games={games} hit={p.games} color={c} />
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 12px' }}>
          {p.examples.map((e, i) => (
            <ExampleCard key={i} e={e} slug={slug} color={c} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── Champions ───────── */

function Champs({ champs }: { champs: ChampLine[] }) {
  const best = champs.slice(0, 3);
  const worst = champs.length > 3 ? [...champs].reverse().slice(0, 3) : [];
  const line = (c: ChampLine) => (
    <div key={c.champion} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto auto', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--line)' }}>
      <img src={c.image} alt="" width={40} height={40} style={{ borderRadius: 12 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700 }}>{c.champion}</span>
        <span className="m" style={{ fontSize: 12, color: 'var(--tx3)' }}>
          {c.games} partidas · <span style={{ color: c.wins / c.games >= 0.5 ? 'var(--win)' : 'var(--loss)' }}>{Math.round((100 * c.wins) / c.games)}% victorias</span>
        </span>
      </span>
      <span />
      <Score value={c.score} size={14} />
    </div>
  );
  return (
    <section className="grid2">
      <article className="card rise">
        <div className="eyebrow" style={{ color: 'var(--sc4)' }}>Tus mejores picks</div>
        <h2 className="h2" style={{ marginTop: 8 }}>Con quién juegas mejor</h2>
        <div style={{ marginTop: 12 }}>{best.map(line)}</div>
      </article>
      {worst.length > 0 && (
        <article className="card rise">
          <div className="eyebrow" style={{ color: 'var(--loss)' }}>Dónde más sufres</div>
          <h2 className="h2" style={{ marginTop: 8 }}>Campeones con peor nota</h2>
          <div style={{ marginTop: 12 }}>{worst.map(line)}</div>
        </article>
      )}
    </section>
  );
}

/* ───────── Trends ───────── */

function TrendTile({ t }: { t: Trend }) {
  const c = t.better ? 'var(--sc4)' : 'var(--sc1)';
  return (
    <div className="stat-tile">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="eyebrow">{t.label}</span>
        <span className="m" style={{ fontSize: 12, fontWeight: 700, color: c }}>{t.better ? '▲ mejorando' : '▼ empeorando'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
        <span className="d m" style={{ fontFamily: 'var(--fd)', fontSize: 26, color: c }}>{t.last10}</span>
        <span className="m" style={{ fontSize: 12, color: 'var(--tx3)' }}>temporada {t.season}</span>
      </div>
      <Spark values={t.values} avg={t.seasonAvg} color={c} />
    </div>
  );
}

function Spark({ values, avg, color }: { values: number[]; avg: number; color: string }) {
  if (values.length < 2) return null;
  const W = 240, H = 56;
  const lo = Math.min(...values, avg), hi = Math.max(...values, avg);
  const y = (v: number) => H - 5 - ((v - lo) / Math.max(1e-6, hi - lo)) * (H - 10);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, y(v)] as [number, number]);
  const last10 = Math.max(0, values.length - 10);
  const x10 = (last10 / (values.length - 1)) * W;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true" style={{ display: 'block', marginTop: 10 }}>
      <rect x={x10} y="0" width={W - x10} height={H} rx="6" style={{ fill: color }} fillOpacity=".08" />
      <path d={`M0 ${y(avg)}H${W}`} style={{ stroke: 'var(--tx3)' }} strokeDasharray="3 4" strokeWidth="1" />
      <path d={polyline(pts)} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" style={{ fill: color }} />
    </svg>
  );
}

function Good({ text }: { text: string }) {
  return <p style={{ margin: 0, padding: 16, borderRadius: 16, background: 'var(--s2)', color: 'var(--tx2)' }}>{text}</p>;
}
