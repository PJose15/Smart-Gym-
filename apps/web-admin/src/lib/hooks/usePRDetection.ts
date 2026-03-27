import { useState, useCallback } from 'react';

export type PRType = 'first_session' | 'weight' | 'volume';

export interface PRResult {
  type: PRType;
  value: number;
  previousValue: number | null;
  improvementPct: number | null;
}

export function usePRDetection() {
  const [activePR, setActivePR] = useState<PRResult | null>(null);
  const [allPRs, setAllPRs] = useState<PRResult[]>([]);

  const checkPR = useCallback(
    async (params: {
      session_id: string;
      member_id: string;
      machine_id: string;
      weight_lbs: number;
      reps: number;
    }) => {
      try {
        const res = await fetch('/api/sessions/pr-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        if (!res.ok) return null;

        const data = await res.json();

        if (data.pr) {
          const pr: PRResult = data.pr;
          setActivePR(pr);
          setAllPRs((prev) => [...prev, pr]);

          // Haptic feedback
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([15, 50, 15]);
          }

          return pr;
        }

        return null;
      } catch {
        return null;
      }
    },
    []
  );

  const dismissPR = useCallback(() => {
    setActivePR(null);
  }, []);

  return {
    activePR,
    allPRs,
    hasPRs: allPRs.length > 0,
    checkPR,
    dismissPR,
  };
}
