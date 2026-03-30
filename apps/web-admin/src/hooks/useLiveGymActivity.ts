import { useEffect, useRef, useState } from 'react';
import type { ActivityFeedItem } from '@nexera/types';

export interface LiveActivityEvent {
  id: string;
  text: string;
  timestamp: Date;
  type: 'session' | 'pr' | 'achievement' | 'return';
}

/** Polls /api/owner/activity every 15 s, tracks new events and live count. */
export function useLiveGymActivity() {
  const [events, setEvents] = useState<LiveActivityEvent[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const seenIdsRef = useRef(new Set<string>());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function fetchActivity() {
      try {
        const res = await fetch('/api/owner/activity', { signal: controller.signal });
        if (!res.ok || !mounted) return;
        const data: ActivityFeedItem[] = await res.json();

        const mapped: LiveActivityEvent[] = data.map((item) => ({
          id: item.id,
          text: item.actor_name
            ? `${item.actor_name} — ${item.description.toLowerCase()}`
            : item.description,
          timestamp: new Date(item.created_at),
          type: mapEventType(item.event_type),
        }));

        setEvents(mapped.slice(0, 20));

        // Count net-new session events (skip first load)
        if (initialLoadRef.current) {
          mapped.forEach((e) => seenIdsRef.current.add(e.id));
          initialLoadRef.current = false;
        } else {
          let newSessionCount = 0;
          mapped.forEach((e) => {
            if (!seenIdsRef.current.has(e.id) && e.type === 'session') {
              newSessionCount++;
            }
            seenIdsRef.current.add(e.id);
          });
          if (newSessionCount > 0) {
            setLiveCount((c) => c + newSessionCount);
          }
        }

        // Cap seenIds to prevent unbounded growth on long-open pages
        if (seenIdsRef.current.size > 200) {
          const keep = new Set(mapped.map((e) => e.id));
          seenIdsRef.current = keep;
        }
      } catch {
        // Ignore abort / network errors
      }
    }

    fetchActivity();
    const interval = setInterval(fetchActivity, 15_000);

    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  return { events, liveCount };
}

function mapEventType(eventType: string): LiveActivityEvent['type'] {
  switch (eventType) {
    case 'achievement_earned':
      return 'achievement';
    case 'new_member':
      return 'return';
    default:
      return 'session';
  }
}
