import { useEffect, useRef, useState } from 'react';
import type { AtRiskMember } from '@nexera/ai-assist';

/** Fetches at-risk members and polls every 60 s. */
export function useAtRiskMembers() {
  const [members, setMembers] = useState<AtRiskMember[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();

    async function fetchAtRisk() {
      try {
        const res = await fetch('/api/owner/at-risk', { signal: controller.signal });
        if (!res.ok || !mountedRef.current) return;
        const data: AtRiskMember[] = await res.json();
        setMembers(data);
      } catch {
        // Ignore abort / network errors
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    fetchAtRisk();
    const interval = setInterval(fetchAtRisk, 60_000);

    return () => {
      mountedRef.current = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  return { members, loading };
}
