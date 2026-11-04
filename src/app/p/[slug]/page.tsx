import { TabView } from '@/components/player/TabState';
import { ChampionsPanel, HistoryPanel, ImprovePanel, MmrPanel, StatsPanel } from './panels';

/** Every tab is rendered here in one pass (behind loading.tsx), so switching tabs is instant. */
export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <TabView
      panels={{
        stats: <StatsPanel slug={slug} />,
        history: <HistoryPanel slug={slug} />,
        champions: <ChampionsPanel slug={slug} />,
        mmr: <MmrPanel slug={slug} />,
        improve: <ImprovePanel slug={slug} />,
      }}
    />
  );
}
