'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Score } from '@/lib/types';

export function useRealtimeScores(tournamentId: string) {
  const [scores, setScores] = useState<Score[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Initial load
    supabase
      .from('scores')
      .select('*')
      .eq('tournament_id', tournamentId)
      .then(({ data }) => {
        if (data) setScores(data);
      });

    // Realtime subscription with 5s debounce to reduce 125-client storm
    const channel = supabase
      .channel(`scores:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(async () => {
            const { data } = await supabase
              .from('scores')
              .select('*')
              .eq('tournament_id', tournamentId);
            if (data) setScores(data);
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return scores;
}
