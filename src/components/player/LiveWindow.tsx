'use client';

import { useState } from 'react';
import type { LiveGameView } from '@/core/types';
import { useNow } from '@/lib/hooks';
import { LiveGame } from '../profile/Outlook';

export type LiveData = LiveGameView & { gameId: number; champion: string };

/** Floating window shown while the player is in a game; collapses to a pill. */
export function LiveWindow({ live }: { live: LiveData }) {
  const [open, setOpen] = useState(true);
  const now = useNow(1000);
  const mins = now && live.startedAt ? Math.max(0, Math.floor((now - live.startedAt) / 60000)) : null;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 50, boxShadow: '0 12px 40px -12px #000' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--loss)' }} />
        En directo · {live.queue}
        {mins != null && ` · ${mins} min`}
      </button>
    );
  return (
    <div role="dialog" aria-label="Partida en directo" style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 50, width: 'min(920px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', borderRadius: 28, boxShadow: '0 30px 80px -20px #000' }}>
      <div style={{ position: 'absolute', top: 18, right: 18, zIndex: 2 }}>
        <button type="button" className="btn2" onClick={() => setOpen(false)} aria-label="Minimizar ventana en directo">
          Minimizar
        </button>
      </div>
      <LiveGame live={live} />
    </div>
  );
}
