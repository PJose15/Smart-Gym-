import { useState, useCallback, useEffect } from 'react';
import type { DNAScores } from '@nexera/types';

interface GymDNAStats {
  avg_scores: DNAScores;
  archetype_distribution: Record<string, number>;
  top_archetype: string | null;
  member_count: number;
}

interface UseGymDNAStatsResult {
  data: GymDNAStats | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export function useGymDNAStats(gymId: string): UseGymDNAStatsResult {
  const [data, setData] = useState<GymDNAStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gym/${gymId}/dna/stats`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setError('Failed to load gym DNA stats');
      }
    } catch {
      setError('Failed to load gym DNA stats');
    } finally {
      setIsLoading(false);
    }
  }, [gymId]);

  useEffect(() => { load(); }, [load]);

  return { data, isLoading, error, load };
}
