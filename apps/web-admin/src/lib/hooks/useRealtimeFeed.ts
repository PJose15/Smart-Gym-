import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { FeedEventFull } from '@nexera/types';

interface UseRealtimeFeedOptions {
  gymId: string;
  /** Viewer's member id — used to fetch the enriched event (author name/avatar). */
  memberId: string;
  onNewEvent: (event: FeedEventFull) => void;
}

export function useRealtimeFeed({ gymId, memberId, onNewEvent }: UseRealtimeFeedOptions) {
  const callbackRef = useRef(onNewEvent);
  callbackRef.current = onNewEvent;

  useEffect(() => {
    const supabase = createClient();
    const channelName = `gym-feed:${gymId}`;
    let disposed = false;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gym_feed_events',
          filter: `gym_id=eq.${gymId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          // Fallback event built straight from the realtime row (the row has no
          // author name — only member_id).
          const fallbackEvent: FeedEventFull = {
            id: row.id as string,
            event_type: row.event_type as string,
            member_name: 'Member',
            description: row.display_text as string,
            created_at: row.created_at as string,
            reaction_count: 0,
            member_id: (row.member_id as string) || null,
            avatar_url: null,
            context_data: (row.context_data as Record<string, unknown>) || {},
            priority: (row.priority as string) || 'medium',
            is_pinned: (row.is_pinned as boolean) || false,
            comment_count: 0,
            reactions: { strength: 0, fire: 0, champion: 0, letsgo: 0 },
            my_reactions: [],
          };

          // Enrich via the feed API so the card shows the author's real name
          // instead of the literal "Member". Falls back gracefully.
          void (async () => {
            let event = fallbackEvent;
            try {
              const res = await fetch(
                `/api/member/feed?member_id=${memberId}&gym_id=${gymId}&limit=10`
              );
              if (res.ok) {
                const data = await res.json();
                const match = (data.events as FeedEventFull[] | undefined)?.find(
                  (e) => e.id === fallbackEvent.id
                );
                if (match) event = match;
              }
            } catch {
              // keep fallback
            }
            if (!disposed) callbackRef.current(event);
          })();
        }
      )
      .subscribe();

    return () => {
      disposed = true;
      supabase.removeChannel(channel);
    };
  }, [gymId, memberId]);
}
