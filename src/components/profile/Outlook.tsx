'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { saveLpReference } from '@/app/actions';
import type { LiveGameView, QueueOutlook } from '@/core/types';
import { fmt, halftone, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { DotBar, Portrait, Seg } from '../ui';

function LpTile({ kind, lp, lo, hi }: { kind: 'win' | 'loss'; lp: number; lo: number; hi: number }) {
  const c = kind === 'win' ? 'var(--win)' : 'var(--loss)';
  return (
    <div style={{ position: 'relative', overflow: 'hidden', flex: '1 1 160px', padding: '18px 20px', borderRadius: 22, background: 'var(--s2)', border: `1px solid color-mix(in srgb, ${c} 40%, transparent)` }}>
      <div aria-hidden="true" style={{ position: 'absolute', right: -30, bottom: -40, width: 150, height: 150, backgroundImage: halftone(c, 2), backgroundSize: '9px 9px', opacity: 0.35, animation: 'blob 12s ease-in-out infinite' }} />
      <div className="eyebrow" style={{ position: 'relative', color: c }}>{kind === 'win' ? 'Próxima victoria' : 'Próxima derrota'}</div>
      <div className="d m" style={{ position: 'relative', fontFamily: 'var(--fd)', fontSize: 48, color: c, marginTop: 6 }}>
        {kind === 'win' ? '+' : '−'}
        {lp}
        <span style={{ fontSize: 16, color: 'var(--tx3)', marginLeft: 6 }}>LP</span>
      </div>
      <div className="m" style={{ position: 'relative', fontSize: 12, color: 'var(--tx2)', marginTop: 4 }}>
        probable: {kind === 'win' ? '+' : '−'}
        {lo} a {kind === 'win' ? '+' : '−'}
        {hi}
      </div>
    </div>
  );
}

function Fact({ label, value, sub, tone, title }: { label: string; value: string; sub?: string; tone?: 'up' | 'dn'; title?: string }) {
  return (
    <div className="stat-tile" title={title}>
      <div className="eyebrow">{label}</div>
      <div className="d m" style={{ fontFamily: 'var(--fd)', fontSize: 22, marginTop: 6, color: tone === 'up' ? 'var(--win)' : tone === 'dn' ? 'var(--loss)' : 'var(--tx)' }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 4, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );
}

/** Per-queue ranked forecast: LP on the next game, goals, rank-vs-MMR signals, tracked LP. */
export function Outlook({ queues, owner }: { queues: QueueOutlook[]; owner: { game: string; puuid: string } }) {
  const [qi, setQi] = useState(0);
  const now = useNow();
  const q = queues[qi];
  if (!q) return null;
  const gap = q.gapLp;
  const s = q.season;
  const b = q.balance;

  return (
    <section className="card rise" style={{ animationDelay: '120ms', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">Previsión de ranked</div>
          <h2 className="h2" style={{ marginTop: 8 }}>Lo que valen tus próximas partidas</h2>
        </div>
        {queues.length > 1 && <Seg label="Cola" options={queues.map((x) => ({ label: x.label }))} value={qi} onChange={setQi} width={110} />}
      </div>

      <div className="g12" style={{ gap: 20 }}>
        <div className="c5" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {q.nextWin && q.nextLoss ? (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <LpTile kind="win" {...q.nextWin} />
                <LpTile kind="loss" {...q.nextLoss} />
              </div>
              <div className="m" style={{ fontSize: 12, color: 'var(--tx3)', lineHeight: 1.5 }}>
                {q.reference?.source === 'manual'
                  ? `Según los LP que introdujiste (+${q.reference.win} / −${q.reference.loss}).`
                  : q.reference?.source === 'tracked' || q.calibratedFrom
                    ? `Calibrado con ${q.calibratedFrom} partida${q.calibratedFrom === 1 ? '' : 's'} real${q.calibratedFrom === 1 ? '' : 'es'} que registramos.`
                    : 'Estimado a partir de la diferencia entre tu MMR y tu rango. Introduce abajo tus LP reales para que sea exacto; también se calibra solo con cada partida que registramos.'}
              </div>
              <LpReferenceForm key={q.id} queue={q} owner={owner} />
            </>
          ) : (
            <p style={{ margin: 0, color: 'var(--tx2)' }}>Sin rango en {q.label}: juega tus partidas de clasificación para ver previsiones de LP.</p>
          )}

          {q.shown && q.toNext && (
            <div style={{ padding: 18, borderRadius: 20, background: 'var(--s2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: q.shown.color }}>
                  {q.shown.label} · {q.shown.lp} LP
                </span>
                <span className="m" style={{ fontSize: 13, color: 'var(--tx2)' }}>→ {q.toNext.label}</span>
              </div>
              <div style={{ marginTop: 12 }}>
                <DotBar pct={q.shown.progress} color={q.shown.color} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 12, fontSize: 14 }}>
                <span>
                  faltan <b className="m">{q.toNext.lp} LP</b> · <b className="m" style={{ color: 'var(--win)' }}>~{q.toNext.wins}</b> victoria{q.toNext.wins === 1 ? '' : 's'}
                </span>
                {q.toDemote && (
                  <span style={{ color: q.toDemote.losses <= 1 ? 'var(--loss-ink)' : 'var(--tx2)' }}>
                    {q.toDemote.losses} derrota{q.toDemote.losses === 1 ? '' : 's'} para bajar a {q.toDemote.label}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="c7" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignContent: 'start' }}>
          <Fact label={`${q.label} MMR`} value={`${fmt(q.mmr)}`} sub={`${q.mmrRank.label} · ${q.confidence}% conf. · ${q.lobbiesRead} partidas${q.reference ? ' + tus LP' : ''}`} />
          {q.lpImpliedMmr != null && q.reference && (
            <Fact label="MMR según tus LP" value={fmt(q.lpImpliedMmr)} sub={`+${q.reference.win} / −${q.reference.loss} LP → ${q.gapLp != null && q.shown ? (q.lpImpliedMmr - q.shown.rating >= 0 ? '+' : '−') + Math.abs(q.lpImpliedMmr - q.shown.rating) + ' frente a tu rango' : ''}`} />
          )}
          <Fact
            label="MMR frente a rango"
            value={gap == null ? '—' : Math.abs(gap) <= 25 ? 'Alineados' : `${gap > 0 ? '+' : '−'}${Math.abs(gap)} LP`}
            sub={gap == null ? 'Sin rango visible en esta cola' : gap > 25 ? 'Tu MMR va por delante: ganarás más y perderás menos' : gap < -25 ? 'Tu rango va por delante: ganarás menos y perderás más' : 'Lo que ganes y pierdas debería estar parejo'}
            title={q.reference ? 'Según la asimetría de tus LP reales' : 'Según el MMR estimado a partir de tus partidas'}
            tone={gap == null || Math.abs(gap) <= 25 ? undefined : gap > 0 ? 'up' : 'dn'}
          />
          <Fact
            label="Tu rango se ajusta en"
            value={q.convergeGames == null ? '—' : `~${q.convergeGames} partidas`}
            sub={q.convergeGames == null ? 'Rango y MMR ya coinciden' : (gap ?? 0) < 0 ? 'Con un 50% de victorias, tu rango bajará hasta tu MMR' : 'Con un 50% de victorias, tu rango subirá hasta tu MMR'}
          />
          {q.winVsRank != null && q.shown && <Fact label={`Prob. de ganar vs ${q.shown.short}`} value={`${q.winVsRank}%`} sub="Esperada contra jugadores de tu rango visible" tone={q.winVsRank >= 53 ? 'up' : q.winVsRank <= 47 ? 'dn' : undefined} />}
          {s && <Fact label="Temporada" value={`${s.wins}V ${s.losses}D`} sub={`${Math.round((100 * s.wins) / Math.max(1, s.wins + s.losses))}% de victorias · ${s.wins + s.losses} partidas`} />}
          {b && (
            <Fact
              label="Equilibrio de equipos"
              value={`${b.avgDiff >= 0 ? '+' : '−'}${Math.abs(b.avgDiff)}`}
              sub={
                b.avgDiff <= -40
                  ? `Tus compañeros tenían menos rango que los rivales en ${b.weakerTeam}/${b.games} partidas: el emparejamiento te valora por encima de tu rango`
                  : b.avgDiff >= 40
                    ? 'Tus compañeros tienen más rango que los rivales: el emparejamiento te valora por debajo de tu rango'
                    : `Los equipos estuvieron equilibrados en ${b.games} partidas`
              }
              tone={b.avgDiff <= -40 ? 'up' : b.avgDiff >= 40 ? 'dn' : undefined}
            />
          )}
        </div>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>LP registrados · reales</div>
        {q.tracked.length ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {q.tracked.map((t) => (
              <span key={t.matchId} className={`dl ${t.delta >= 0 ? 'up' : 'dn'}`} title={now ? timeAgo(t.at, now) : undefined}>
                {t.delta >= 0 ? '+' : '−'}
                {Math.abs(t.delta)} LP
              </span>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 }}>
            Riot no publica los LP de cada partida, así que los registramos nosotros: cada sincronización guarda tu rango y, si entre dos se jugó exactamente una partida, sabemos sus LP. Se rellena solo a medida que juegas.
          </p>
        )}
      </div>
    </section>
  );
}

/** Lets the player type the LP of their last win and loss: the most direct MMR signal there is. */
function LpReferenceForm({ queue, owner }: { queue: QueueOutlook; owner: { game: string; puuid: string } }) {
  const router = useRouter();
  const [win, setWin] = useState(queue.reference?.source === 'manual' ? String(queue.reference.win) : '');
  const [loss, setLoss] = useState(queue.reference?.source === 'manual' ? String(queue.reference.loss) : '');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const w = Math.abs(parseInt(win, 10)), l = Math.abs(parseInt(loss, 10));
    if (!(w >= 1 && w <= 60 && l >= 1 && l <= 60)) return setMsg('Usa valores entre 1 y 60.');
    start(async () => {
      const r = await saveLpReference(owner.game, owner.puuid, queue.id, w, l);
      setMsg(r.ok ? null : 'No se pudo guardar.');
      if (r.ok) router.refresh();
    });
  };
  const input = { width: 64, height: 40, borderRadius: 12, border: '1px solid var(--line2)', background: 'var(--s1)', textAlign: 'center' as const, fontFamily: 'var(--fm)', fontSize: 15 };
  return (
    <form onSubmit={submit} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 16, background: 'var(--s2)' }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>Tus últimos LP</span>
      <label className="vh" htmlFor={`lpw-${queue.id.replace("/", "")}`}>LP ganados en tu última victoria</label>
      <span className="m" style={{ color: 'var(--win)' }}>+</span>
      <input id={`lpw-${queue.id.replace("/", "")}`} inputMode="numeric" value={win} onChange={(e) => setWin(e.target.value)} placeholder="18" style={input} />
      <label className="vh" htmlFor={`lpl-${queue.id.replace("/", "")}`}>LP perdidos en tu última derrota</label>
      <span className="m" style={{ color: 'var(--loss)' }}>−</span>
      <input id={`lpl-${queue.id.replace("/", "")}`} inputMode="numeric" value={loss} onChange={(e) => setLoss(e.target.value)} placeholder="22" style={input} />
      <button className="btn" type="submit" disabled={pending} style={{ height: 40, padding: '0 18px', fontSize: 14 }}>{pending ? 'Guardando' : 'Guardar'}</button>
      {msg && <span style={{ fontSize: 13, color: 'var(--loss-ink)' }}>{msg}</span>}
    </form>
  );
}

export function LiveGame({ live }: { live: LiveGameView }) {
  const now = useNow(1000);
  const mins = now && live.startedAt ? Math.max(0, Math.floor((now - live.startedAt) / 60000)) : null;
  const wc = live.winChance;
  return (
    <section className="card rise" style={{ borderColor: 'var(--acc)', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ position: 'relative', width: 14, height: 14 }}>
            <span className="pulse" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--loss)' }} />
            <span style={{ position: 'absolute', inset: 3, borderRadius: '50%', background: 'var(--loss)' }} />
          </span>
          <div>
            <div className="eyebrow" style={{ color: 'var(--loss)' }}>En directo</div>
            <h2 className="h2" style={{ marginTop: 6 }}>
              {live.queue}
              {mins != null && <span className="m" style={{ fontSize: 14, color: 'var(--tx3)', marginLeft: 10 }}>{mins} min</span>}
            </h2>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {wc != null && (
            <div className="stat-tile" style={{ minWidth: 150 }}>
              <div className="eyebrow">Prob. de ganar</div>
              <div className="d m" style={{ fontFamily: 'var(--fd)', fontSize: 26, marginTop: 4, color: wc >= 52 ? 'var(--win)' : wc <= 48 ? 'var(--loss)' : 'var(--tx)' }}>{wc}%</div>
            </div>
          )}
          {live.lp && (
            <div className="stat-tile" style={{ minWidth: 150 }}>
              <div className="eyebrow">En juego</div>
              <div className="d m" style={{ fontFamily: 'var(--fd)', fontSize: 26, marginTop: 4 }}>
                <span style={{ color: 'var(--win)' }}>+{live.lp.win}</span> <span style={{ color: 'var(--tx3)', fontSize: 18 }}>/</span> <span style={{ color: 'var(--loss)' }}>−{live.lp.loss}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {wc != null && (
        <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 3 }} aria-hidden="true">
          <div className="grow" style={{ width: `${wc}%`, backgroundImage: halftone('var(--win)', 1.5), backgroundSize: '5px 5px', boxShadow: 'inset 0 0 0 1px var(--win)' }} />
          <div style={{ flex: 1, backgroundImage: halftone('var(--loss)', 1.5), backgroundSize: '5px 5px', boxShadow: 'inset 0 0 0 1px var(--loss)' }} />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 22 }}>
        {live.teams.map((t) => {
          const tc = t.mine ? 'var(--win)' : 'var(--loss)';
          return (
            <div key={String(t.mine)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: tc }}>{t.mine ? 'Tu equipo' : 'Equipo rival'}</span>
                {t.avg && <span className="rk" style={{ color: t.avg.color, borderColor: t.avg.color }}>media {t.avg.short}</span>}
              </div>
              {t.players.map((p, i) => (
                <div key={i} className={`tr5${p.me ? ' me' : ''}`} style={{ gridTemplateColumns: '30px minmax(0,1fr) auto' }}>
                  <Portrait size={28} color={tc} image={p.image} name={p.champion} dot={1.1} border={1} inset={0.15} fontSize={11} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{p.champion}</div>
                  </div>
                  <span className="m" style={{ fontSize: 12, color: p.rank?.color ?? 'var(--tx3)' }}>{p.me ? 'Tú' : (p.rank?.short ?? 'Sin rango')}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
