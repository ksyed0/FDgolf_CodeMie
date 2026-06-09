'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import type { Tournament } from '@/lib/types';

interface TournamentControlsProps {
  tournament: Tournament;
}

export function TournamentControls({ tournament }: TournamentControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: 'active' | 'completed') {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('tournaments')
      .update({ status: newStatus })
      .eq('id', tournament.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Tournament ${newStatus === 'active' ? 'activated' : 'completed'}!`);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-wrap gap-3">
      {tournament.status === 'setup' && (
        <Button
          className="bg-[#1a472a] hover:bg-[#143820]"
          onClick={() => updateStatus('active')}
          disabled={loading}
        >
          Activate Tournament
        </Button>
      )}
      {tournament.status === 'active' && (
        <Button
          variant="destructive"
          onClick={() => updateStatus('completed')}
          disabled={loading}
        >
          Complete Tournament
        </Button>
      )}
      {tournament.status === 'completed' && (
        <p className="text-sm text-gray-500">Tournament is complete.</p>
      )}
    </div>
  );
}
