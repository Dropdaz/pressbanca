'use client';

import { useEffect, useState } from 'react';

interface Status {
  hasKey: boolean;
  keyRejected: boolean;
  cooldownUntil: number | null;
  windows: { host: string; used: number; limit: number; seconds: number }[];
  now: number;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Riot API pill: ready / usage, or a live countdown while the key is cooling down. Polls /api/status. */
export function ApiStatus({ compact = false }: { compact?: boolean }) {
  const [st, setSt] = useState<(Status & { skew: number }) | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const s: Status = await (await fetch('/api/status', { cache: 'no-store' })).json();
        if (alive) setSt({ ...s, skew: Date.now() - s.now });
      } catch {
        /* offline */
      }
      if (alive) timer = setTimeout(poll, 4000);
    };
    poll();
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, []);

  let tone = 'var(--tx3)';
  let text = 'API …';
  let title = 'Comprobando la API de Riot';
  if (st) {
    const left = st.cooldownUntil ? st.cooldownUntil + st.skew - now : 0;
    const busiest = st.windows[0];
    const usage = st.windows.map((w) => `${w.host}: ${w.used}/${w.limit} cada ${w.seconds >= 60 ? `${w.seconds / 60} min` : `${w.seconds} s`}`).join('\n');
    if (!st.hasKey) [tone, text, title] = ['var(--loss)', 'API: sin clave', 'RIOT_API_KEY no está configurada'];
    else if (st.keyRejected) [tone, text, title] = ['var(--loss)', 'Clave rechazada', 'Riot respondió 401/403: revisa RIOT_API_KEY'];
    else if (left > 0) [tone, text, title] = ['var(--loss)', `API en espera ${mmss(left)}`, `Límite alcanzado, las peticiones se reanudan en ${mmss(left)}\n${usage}`];
    else if (busiest && busiest.used / busiest.limit >= 0.75) [tone, text, title] = ['#e0a526', `API ocupada · ${busiest.used}/${busiest.limit}`, usage];
    else [tone, text, title] = ['var(--win)', compact ? 'API lista' : `API lista${busiest ? ` · ${busiest.used}/${busiest.limit}` : ''}`, usage || 'Sin peticiones todavía'];
  }
  return (
    <span className="m" role="status" aria-live="polite" title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', borderRadius: 999, border: '1px solid var(--line2)', fontSize: 12, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: tone, boxShadow: `0 0 0 3px color-mix(in srgb, ${tone} 25%, transparent)` }} />
      {text}
    </span>
  );
}
