import type { Metadata } from 'next';
import { PlayerHeader } from '@/components/player/PlayerHeader';
import { TabProvider } from '@/components/player/TabState';
import { loadPlayer } from '@/server/player';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { player } = await loadPlayer((await params).slug);
  return { title: `${player.gameName}#${player.tagLine}` };
}

export default async function PlayerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { player, dd, shown, solo, rows } = await loadPlayer(slug);
  const recent = rows.filter((r) => !r.remake).slice(0, 20);
  const wins = recent.filter((r) => r.win).length;
  return (
    <TabProvider>
      <PlayerHeader
        player={{ puuid: player.puuid, slug: player.slug, name: player.gameName, tag: player.tagLine, region: player.region, level: player.level, icon: player.profileIcon != null ? dd.iconImg(player.profileIcon) : null, importing: !player.backfillDone, syncedAt: player.syncedAt }}
        shown={shown}
        season={solo ? { wins: solo.wins, losses: solo.losses } : null}
        recent={{ wins, losses: recent.length - wins }}
        stored={rows.length}
      />
      <main className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>
        {children}
      </main>
    </TabProvider>
  );
}
