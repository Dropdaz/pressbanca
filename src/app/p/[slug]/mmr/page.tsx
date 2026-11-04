import { redirect } from 'next/navigation';

/** Old per-tab URL: tabs now live on the profile page. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  redirect(`/p/${(await params).slug}#mmr`);
}
