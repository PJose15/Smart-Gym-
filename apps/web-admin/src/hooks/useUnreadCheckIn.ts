import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseUnreadCheckInReturn {
  hasUnread: boolean;
  checkInId: string | null;
  markRead: () => Promise<void>;
}

/** Base poll interval with ±10% jitter to avoid thundering herd */
function jitteredInterval(): number {
  const base = 60_000;
  const jitter = base * 0.1 * (Math.random() * 2 - 1); // ±6s
  return base + jitter;
}

/**
 * Polls for unread weekly check-ins every ~60 seconds.
 * Provides markRead() for optimistic mark-as-read.
 */
export function useUnreadCheckIn(memberId: string): UseUnreadCheckInReturn {
  const [hasUnread, setHasUnread] = useState(false);
  const [checkInId, setCheckInId] = useState<string | null>(null);
  const markingRef = useRef(false);

  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    const controller = new AbortController();

    async function fetchUnread() {
      try {
        const res = await fetch(
          `/api/member/check-ins/unread?member_id=${memberId}`,
          { signal: controller.signal }
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setHasUnread(data.hasUnread);
        setCheckInId(data.checkInId);
      } catch {
        /* abort or network error — silent */
      }
    }

    fetchUnread();
    const interval = setInterval(fetchUnread, jitteredInterval());

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [memberId]);

  const markRead = useCallback(async () => {
    if (!checkInId || !memberId || markingRef.current) return;
    markingRef.current = true;
    // Optimistic update
    setHasUnread(false);
    const prevId = checkInId;
    setCheckInId(null);
    try {
      await fetch('/api/member/check-ins/unread', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkInId: prevId, memberId }),
      });
    } catch {
      // Revert on failure
      setHasUnread(true);
      setCheckInId(prevId);
    } finally {
      markingRef.current = false;
    }
  }, [checkInId, memberId]);

  return { hasUnread, checkInId, markRead };
}
