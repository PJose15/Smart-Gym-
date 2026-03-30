import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ReactionType } from '@nexera/types';

interface ReactionChange {
  eventId: string;
  reactionType: ReactionType;
  action: 'INSERT' | 'DELETE';
}

interface UseRealtimeReactionsOptions {
  gymId: string;
  eventIds: string[];
  onReactionChange: (change: ReactionChange) => void;
}

export function useRealtimeReactions({ gymId, eventIds, onReactionChange }: UseRealtimeReactionsOptions) {
  const callbackRef = useRef(onReactionChange);
  callbackRef.current = onReactionChange;

  useEffect(() => {
    if (eventIds.length === 0) return;

    const supabase = createClient();
    const channelName = `gym-reactions:${gymId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feed_reactions',
        },
        (payload) => {
          const eventType = payload.eventType;
          const row = (eventType === 'DELETE' ? payload.old : payload.new) as Record<string, unknown>;

          if (!row.event_id || !eventIds.includes(row.event_id as string)) return;

          callbackRef.current({
            eventId: row.event_id as string,
            reactionType: row.reaction_type as ReactionType,
            action: eventType === 'DELETE' ? 'DELETE' : 'INSERT',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gymId, eventIds]);
}
