import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import Link from 'next/link';
import { Home, Flag, Trophy, ClipboardList } from 'lucide-react';

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: player } = await supabase
    .from('players')
    .select('name')
    .eq('auth_user_id', user.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AppHeader variant="full" showAvatar userName={player?.name ?? user.email ?? 'Player'} />
      <main className="mx-auto w-full max-w-md flex-1 pb-20">{children}</main>
      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white">
        <div className="mx-auto flex max-w-md items-center justify-around py-2">
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#1a472a]"
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px]">Home</span>
          </Link>
          <Link
            href="/round"
            className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#1a472a]"
          >
            <Flag className="h-5 w-5" />
            <span className="text-[10px]">Round</span>
          </Link>
          <Link
            href="/leaderboard"
            className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#1a472a]"
          >
            <Trophy className="h-5 w-5" />
            <span className="text-[10px]">Leaders</span>
          </Link>
          <Link
            href="/scorecard"
            className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#1a472a]"
          >
            <ClipboardList className="h-5 w-5" />
            <span className="text-[10px]">Scorecard</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
