import { useEffect, useRef, useState } from 'react';

/** Fetches hourly session counts for today, polls every 30 s. */
export function useHourlySessionData() {
  const [data, setData] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();

    async function fetchHourly() {
      try {
        const res = await fetch('/api/owner/hourly-sessions', { signal: controller.signal });
        if (!res.ok || !mountedRef.current) return;
        const hourly: Record<number, number> = await res.json();
        setData(hourly);
      } catch {
        // Ignore abort / network errors
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    fetchHourly();
    const interval = setInterval(fetchHourly, 30_000);

    return () => {
      mountedRef.current = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  return { data, loading };
}
