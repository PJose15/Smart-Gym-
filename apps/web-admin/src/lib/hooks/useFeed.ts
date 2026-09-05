import { useState, useCallback, useRef } from 'react';
import type { FeedEventFull, ReactionType } from '@nexera/types';

interface UseFeedOptions {
  memberId: string;
  gymId: string;
}

interface UseFeedResult {
  events: FeedEventFull[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  loadInitial: () => Promise<void>;
  toggleReaction: (eventId: string, type: ReactionType) => void;
  prependEvent: (event: FeedEventFull) => void;
}

export function useFeed({ memberId, gymId }: UseFeedOptions): UseFeedResult {
  const [events, setEvents] = useState<FeedEventFull[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/member/feed?member_id=${memberId}&gym_id=${gymId}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setCursor(data.next_cursor);
        setHasMore(!!data.next_cursor);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [memberId, gymId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !cursor) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/member/feed?member_id=${memberId}&gym_id=${gymId}&cursor=${encodeURIComponent(cursor)}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setEvents(prev => [...prev, ...(data.events || [])]);
        setCursor(data.next_cursor);
        setHasMore(!!data.next_cursor);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [memberId, gymId, cursor, hasMore, loading]);

  const rollbackRef = useRef<FeedEventFull[]>([]);

  const toggleReaction = useCallback((eventId: string, type: ReactionType) => {
    // Capture previous state inside the updater to avoid stale closure
    setEvents(prev => {
      rollbackRef.current = prev;
      return prev.map(e => {
        if (e.id !== eventId) return e;

        const alreadyReacted = e.my_reactions.includes(type);
        const newMyReactions = alreadyReacted
          ? e.my_reactions.filter(r => r !== type)
          : [...e.my_reactions, type];
        const newReactions = { ...e.reactions };
        newReactions[type] = Math.max(0, newReactions[type] + (alreadyReacted ? -1 : 1));
        const totalReactions = newReactions.strength + newReactions.fire + newReactions.champion + newReactions.letsgo;

        return { ...e, my_reactions: newMyReactions, reactions: newReactions, reaction_count: totalReactions };
      });
    });

    // Fire API call
    fetch('/api/member/feed/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, event_id: eventId, reaction_type: type }),
    })
      .then((res) => {
        // 4xx/5xx resolves (no throw) — roll the optimistic update back too
        if (!res.ok) setEvents(rollbackRef.current);
      })
      .catch(() => {
        // Revert to captured state on failure — ref always has the correct pre-optimistic snapshot
        setEvents(rollbackRef.current);
      });
  }, [memberId]);

  const prependEvent = useCallback((event: FeedEventFull) => {
    setEvents(prev => [event, ...prev]);
  }, []);

  return { events, loading, hasMore, loadMore, loadInitial, toggleReaction, prependEvent };
}
