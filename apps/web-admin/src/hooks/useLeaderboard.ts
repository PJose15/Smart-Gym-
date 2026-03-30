import { useCallback, useEffect, useRef, useState } from 'react';
import type { LeaderboardPeriod, LeaderboardResponse } from '@nexera/types';

export interface RankChange {
  previousRank: number;
  currentRank: number;
  delta: number;          // positive = improved (5->3 = +2)
  isNewNumber1: boolean;  // reached rank 1
}

export interface UseLeaderboardReturn {
  data: LeaderboardResponse | null;
  loading: boolean;
  error: string | null;
  period: LeaderboardPeriod;
  setPeriod: (p: LeaderboardPeriod) => void;
  rankChange: RankChange | null;
  clearRankChange: () => void;
}

export function useLeaderboard(memberId: string, gymId: string): UseLeaderboardReturn {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriodRaw] = useState<LeaderboardPeriod>('weekly');
  const [rankChange, setRankChange] = useState<RankChange | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track previous rank per period (survives re-renders, resets on remount)
  const prevRankRef = useRef<Record<LeaderboardPeriod, number | null>>({
    weekly: null,
    all_time: null,
  });

  const setPeriod = useCallback((p: LeaderboardPeriod) => {
    setRankChange(null);
    setPeriodRaw(p);
  }, []);

  const clearRankChange = useCallback(() => {
    setRankChange(null);
  }, []);

  useEffect(() => {
    if (!memberId || !gymId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/member/leaderboard?member_id=${memberId}&gym_id=${gymId}&period=${period}&limit=50`
        );
        if (!res.ok || cancelled) return;
        const json: LeaderboardResponse = await res.json();
        if (cancelled) return;

        setData(json);
        setError(null);

        // Detect rank improvement
        const prevRank = prevRankRef.current[period];
        const currentRank = json.my_rank;

        if (prevRank !== null && currentRank !== null && currentRank < prevRank) {
          setRankChange({
            previousRank: prevRank,
            currentRank,
            delta: prevRank - currentRank,
            isNewNumber1: currentRank === 1,
          });
        }

        // Store current rank for next comparison
        if (currentRank !== null) {
          prevRankRef.current[period] = currentRank;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [memberId, gymId, period]);

  return { data, loading, error, period, setPeriod, rankChange, clearRankChange };
}
