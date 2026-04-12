'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type StaffRole = 'trainer' | 'owner' | 'admin' | 'super_admin';

/**
 * Client-side staff auth gate. Calls `/api/auth/staff/me` and redirects to
 * `/staff/login` on 401 or role mismatch. Use in `'use client'` pages that
 * are not protected by a parent auth layout.
 *
 * Returns `authed: false` until verified; do not render sensitive UI or
 * call data-fetching effects until `authed === true`.
 */
export function useStaffAuth(allowedRoles?: StaffRole[]): { authed: boolean; checking: boolean } {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/staff/me');
        if (!res.ok) {
          if (!cancelled) router.replace('/staff/login');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (allowedRoles && !allowedRoles.includes(data?.role)) {
          router.replace('/staff/login');
          return;
        }
        setAuthed(true);
      } catch {
        if (!cancelled) router.replace('/staff/login');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { authed, checking };
}
