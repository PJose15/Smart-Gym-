'use client';

import { CSSProperties, useEffect, useRef, useCallback, useState } from 'react';
import type { FeedEventFull, ReactionType } from '@nexera/types';
import { useFeed } from '@/lib/hooks/useFeed';
import { useRealtimeFeed } from '@/lib/hooks/useRealtimeFeed';
import { FeedEventCard } from './FeedEventCard';

interface FeedListProps {
  memberId: string;
  gymId: string;
}

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  padding: 32,
  color: 'var(--color-text-muted)',
  fontSize: 14,
};

export function FeedList({ memberId, gymId }: FeedListProps) {
  const { events, loading, hasMore, loadMore, loadInitial, toggleReaction, prependEvent } = useFeed({ memberId, gymId });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const [newEventBanner, setNewEventBanner] = useState(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadInitial();
    }
  }, [loadInitial]);

  // Real-time feed subscription
  useRealtimeFeed({
    gymId,
    onNewEvent: (event) => {
      // Check if user is scrolled to top
      const isAtTop = (containerRef.current?.scrollTop ?? 0) < 50;
      if (isAtTop) {
        prependEvent(event);
      } else {
        setNewEventBanner(true);
      }
    },
  });

  // Infinite scroll observer
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore && !loading) {
        loadMore();
      }
    },
    [hasMore, loading, loadMore]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(observerCallback, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [observerCallback]);

  const handleToggleReaction = useCallback(
    (eventId: string, type: ReactionType) => {
      toggleReaction(eventId, type);
    },
    [toggleReaction]
  );

  return (
    <div ref={containerRef} style={{ animation: 'slideUpFade 0.4s ease-out 0.3s both' }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 12,
      }}>
        Community Feed
      </div>

      {newEventBanner && (
        <button
          onClick={() => {
            setNewEventBanner(false);
            loadInitial();
            containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            color: '#60A5FA',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          New activity — tap to refresh
        </button>
      )}

      {events.length === 0 && !loading && (
        <div style={emptyStyle}>
          No activity yet. Complete a workout to get started!
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {events.map((event: FeedEventFull) => (
          <FeedEventCard
            key={event.id}
            event={event}
            memberId={memberId}
            onToggleReaction={handleToggleReaction}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {loading && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>
          Loading...
        </div>
      )}
    </div>
  );
}
