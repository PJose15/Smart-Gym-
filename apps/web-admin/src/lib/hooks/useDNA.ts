import { useState, useCallback, useEffect } from 'react';
import type { DNAResult } from '@nexera/types';

interface UseDNAResult {
  data: DNAResult | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  recompute: () => Promise<void>;
}

export function useDNA(memberId: string): UseDNAResult {
  const [data, setData] = useState<DNAResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/member/${memberId}/dna`);
      if (res.ok) {
        const json = await res.json();
        setData(json.dna);
      } else {
        setError('Failed to load DNA');
      }
    } catch {
      setError('Failed to load DNA');
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  const recompute = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/member/${memberId}/dna/recompute`, { method: 'POST' });
      if (!res.ok) throw new Error(`Recompute failed: ${res.status}`);
      await load();
    } catch {
      setError('Failed to recompute DNA');
      setIsLoading(false);
    }
  }, [memberId, load]);

  return { data, isLoading, error, load, recompute };
}
