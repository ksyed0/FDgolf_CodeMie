import { redirect } from 'next/navigation';

interface LiveLeaderboardPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LiveLeaderboardPage({ params }: LiveLeaderboardPageProps) {
  const { slug } = await params;
  redirect(`/live/${slug}/tv`);
}
