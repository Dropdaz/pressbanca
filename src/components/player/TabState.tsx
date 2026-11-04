'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export const TABS = [
  { key: 'stats', label: 'Resumen' },
  { key: 'history', label: 'Historial' },
  { key: 'champions', label: 'Campeones' },
  { key: 'mmr', label: 'MMR' },
  { key: 'improve', label: 'Mejorar' },
] as const;
export type TabKey = (typeof TABS)[number]['key'];

const isTab = (s: string): s is TabKey => TABS.some((t) => t.key === s);
const Ctx = createContext<{ tab: TabKey; setTab: (t: TabKey, updateUrl?: boolean) => void }>({ tab: 'stats', setTab: () => {} });

/**
 * Active profile tab, kept client-side in the player layout so switching tabs never hits the server.
 * Mirrored in the URL hash (#history) so reloads and shared links open the same tab.
 */
export function TabProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<TabKey>('stats');
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (isTab(h)) setTabState(h);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const setTab = useCallback((t: TabKey, updateUrl = true) => {
    setTabState(t);
    if (!updateUrl) return;
    const url = window.location.pathname + window.location.search + (t === 'stats' ? '' : `#${t}`);
    window.history.replaceState(window.history.state, '', url);
  }, []);
  return <Ctx.Provider value={{ tab, setTab }}>{children}</Ctx.Provider>;
}

export const useTab = () => useContext(Ctx);

/** All tabs are rendered up front (one server pass); only the active one is shown. */
export function TabView({ panels }: { panels: Record<TabKey, ReactNode> }) {
  const { tab } = useTab();
  return (
    <>
      {TABS.map((t) => (
        <div key={t.key} hidden={t.key !== tab} style={{ display: t.key === tab ? 'flex' : 'none', flexDirection: 'column', gap: 20 }}>
          {panels[t.key]}
        </div>
      ))}
    </>
  );
}
