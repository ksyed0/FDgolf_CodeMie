'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Could not sign out. Please try again.');
      return;
    }
    router.push('/login');
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#1a472a]"
    >
      <LogOut className="h-5 w-5" />
      <span className="text-[10px]">Sign out</span>
    </button>
  );
}
