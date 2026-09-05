'use client';

/**
 * Feed tab — dedicated gym feed page, mirroring the mobile feed screen
 * (apps/mobile/app/(tabs)/feed.tsx):
 *   - serif "Feed" page context
 *   - "<Gym Name> Feed" bold header row with two circular 36px buttons
 *     (podium → leaderboard, trophy → challenges)
 *   - filter chip row (All / PRs / Achievements / Streaks / Challenges)
 *   - event cards with reactions (reuses the gym hub's FeedEventCard)
 */

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeedEventFull, ReactionType } from '@nexera/types';
import { useMember } from '@/lib/contexts/MemberContext';
import { useFeed } from '@/lib/hooks/useFeed';
import { useRealtimeFeed } from '@/lib/hooks/useRealtimeFeed';
import { Skeleton, FeedSkeleton } from '@/components/skeletons';
import { FeedEventCard } from '../gym/components/FeedEventCard';

// ─── Filters (mirrors apps/mobile/src/lib/feedLogic.ts FEED_FILTERS) ────────

type FeedFilter = 'all' | 'prs' | 'achievements' | 'streaks' | 'challenges';

const FEED_FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'prs', label: 'PRs' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'streaks', label: 'Streaks' },
  { key: 'challenges', label: 'Challenges' },
];

const FILTER_TYPE_MAP: Record<Exclude<FeedFilter, 'all'>, string[]> = {
  prs: ['pr_weight', 'pr_volume', 'goal_reached'],
  achievements: ['achievement_earned', 'level_up', 'archetype_change'],
  streaks: ['streak_milestone', 'session_milestone'],
  challenges: [
    'challenge_launched',
    'challenge_joined',
    'challenge_rank_1',
    'challenge_podium',
    'challenge_complete',
  ],
};

function filterFeedEvents(events: FeedEventFull[], filter: FeedFilter): FeedEventFull[] {
  if (filter === 'all') return events;
  const types = FILTER_TYPE_MAP[filter];
  return events.filter((e) => types.includes(e.event_type));
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  padding: 'var(--page-padding-x, 16px)',
  paddingTop: 'var(--space-6, 24px)',
  paddingBottom: 100,
};

const pageContextStyle: CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontSize: 13,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  margin: 0,
  marginBottom: 8,
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  paddingBottom: 14,
  marginBottom: 4,
  borderBottom: '1px solid var(--color-border-subtle)',
};

const headerTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.3px',
  color: 'var(--color-text-primary)',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// Circular 36px header buttons — mirror mobile's leaderboardButton /
// challengesButton (crimson-subtle + primaryLight icon; gold-subtle + gold icon).
const circleButtonBase: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--color-border-subtle)',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
};

const leaderboardButtonStyle: CSSProperties = {
  ...circleButtonBase,
  backgroundColor: 'var(--accent-subtle, rgba(224, 20, 47, 0.10))',
};

const challengesButtonStyle: CSSProperties = {
  ...circleButtonBase,
  backgroundColor: 'var(--color-gold-subtle, rgba(232, 179, 57, 0.10))',
};

const chipRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  padding: '12px 0',
  marginBottom: 4,
};

const chipStyle: CSSProperties = {
  padding: '6px 14px',
  borderRadius: 'var(--radius-full, 9999px)',
  backgroundColor: 'var(--color-bg-raised)',
  border: '1px solid var(--color-border-subtle)',
  color: 'var(--color-text-secondary)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const chipActiveStyle: CSSProperties = {
  ...chipStyle,
  backgroundColor: 'var(--accent-subtle, rgba(224, 20, 47, 0.10))',
  border: '1px solid var(--border-accent, rgba(224, 20, 47, 0.28))',
  color: 'var(--accent, #E0142F)',
  fontWeight: 600,
};

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  padding: 32,
  color: 'var(--color-text-muted)',
  fontSize: 14,
};

// Podium icon (leaderboard) — mirrors Ionicons podium-outline.
const PodiumIcon = (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--accent-hover, #FF2740)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="8" width="6" height="13" />
    <path d="M3 13h6v8H3z" />
    <path d="M15 16h6v5h-6z" />
    <path d="M12 8V3" />
  </svg>
);

// Trophy icon (challenges).
const TrophyIcon = (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--gold, #E8B339)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21 1.18.54 2.03 2.03 2.03 3.79" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

// ─── Page ───────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const router = useRouter();
  const { member, gym, loading: memberLoading } = useMember();

  if (memberLoading) {
    return (
      <div style={pageStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton height={60} radius={12} />
          <Skeleton height={36} radius={18} />
          <FeedSkeleton cards={3} />
        </div>
      </div>
    );
  }

  if (!member || !gym) {
    return (
      <div style={{ padding: 16, textAlign: 'center', paddingTop: 60 }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Unable to load the feed.</p>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <p style={pageContextStyle}>Feed</p>

      <div style={headerRowStyle}>
        <h1 style={headerTitleStyle}>{gym.name ? `${gym.name} Feed` : 'Gym Feed'}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            style={leaderboardButtonStyle}
            aria-label="Open leaderboard"
            onClick={() => router.push('/gym/leaderboard')}
          >
            {PodiumIcon}
          </button>
          <button
            style={challengesButtonStyle}
            aria-label="Open challenges"
            onClick={() => router.push('/gym/challenges')}
          >
            {TrophyIcon}
          </button>
        </div>
      </div>

      <FeedBody memberId={member.id} gymId={gym.id} />
    </div>
  );
}

// ─── Feed body (filter chips + event list) ──────────────────────────────────

function FeedBody({ memberId, gymId }: { memberId: string; gymId: string }) {
  const { events, loading, hasMore, loadMore, loadInitial, toggleReaction, prependEvent } =
    useFeed({ memberId, gymId });
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [newEventBanner, setNewEventBanner] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadInitial();
    }
  }, [loadInitial]);

  // Realtime: prepend when at top, banner otherwise (same as gym hub FeedList,
  // mirroring mobile's realtime prepend behavior).
  useRealtimeFeed({
    gymId,
    memberId,
    onNewEvent: (event) => {
      const isAtTop = window.scrollY < 80;
      if (isAtTop) {
        prependEvent(event);
      } else {
        setNewEventBanner(true);
      }
    },
  });

  // Infinite scroll sentinel
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

  const filteredEvents = useMemo(
    () => filterFeedEvents(events, activeFilter),
    [events, activeFilter]
  );

  const isFilterEmpty = filteredEvents.length === 0 && events.length > 0 && activeFilter !== 'all';

  return (
    <>
      <div style={chipRowStyle} role="tablist" aria-label="Feed filters">
        {FEED_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              role="tab"
              aria-selected={isActive}
              aria-label={`Filter: ${filter.label}`}
              style={isActive ? chipActiveStyle : chipStyle}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {newEventBanner && (
        <button
          onClick={() => {
            setNewEventBanner(false);
            loadInitial();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'var(--accent-subtle, rgba(224, 20, 47, 0.10))',
            color: 'var(--accent-hover, #FF2740)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          New activity — tap to refresh
        </button>
      )}

      {/* Initial load — shimmer skeleton cards */}
      {events.length === 0 && loading && <FeedSkeleton />}

      {/* Empty / failed-load state — useFeed leaves events empty on network
          failure, so a refresh affordance covers both cases */}
      {events.length === 0 && !loading && (
        <div style={emptyStyle}>
          <p style={{ margin: 0, marginBottom: 12 }}>
            No activity yet. Complete a workout to get started!
          </p>
          <button
            onClick={loadInitial}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-md, 12px)',
              border: 'none',
              backgroundColor: 'var(--accent, #E0142F)',
              color: 'var(--text-on-accent, #FFFFFF)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      )}

      {/* Filter produced zero results */}
      {isFilterEmpty && (
        <div style={emptyStyle}>
          <p style={{ margin: 0, marginBottom: 12 }}>Nothing here for this filter yet.</p>
          <button
            onClick={() => setActiveFilter('all')}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-full, 9999px)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-raised)',
              color: 'var(--color-text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Show All
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredEvents.map((event: FeedEventFull) => (
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

      {/* Pagination load — compact skeleton rows below existing cards */}
      {loading && events.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <FeedSkeleton cards={2} />
        </div>
      )}
    </>
  );
}
