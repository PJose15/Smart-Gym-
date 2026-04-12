'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { WeightUnit } from '@/lib/weight';

export type StaffRole = 'trainer' | 'owner' | 'admin' | 'super_admin';

interface StaffGym {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

interface StaffInfo {
  user_id: string;
  gym_id: string;
  role: StaffRole;
  full_name: string;
  email: string;
  avatar_url: string | null;
  gym: StaffGym | null;
}

interface StaffContextValue {
  staff: StaffInfo | null;
  weightUnit: WeightUnit;
  authed: boolean;
  loading: boolean;
}

const StaffCtx = createContext<StaffContextValue>({
  staff: null,
  weightUnit: 'lbs',
  authed: false,
  loading: true,
});

export function useStaff(): StaffContextValue {
  return useContext(StaffCtx);
}

/**
 * Convenience hook — returns the signed-in staff member's gym-configured
 * weight unit (from `gym_settings.weight_unit`). Falls back to 'lbs' before
 * hydration so display code can format synchronously on first render.
 *
 * Use this for trainer/owner surfaces. For member-facing surfaces, use
 * `useWeightUnit()` from `MemberContext`.
 */
export function useStaffWeightUnit(): WeightUnit {
  return useContext(StaffCtx).weightUnit;
}

interface StaffProviderProps {
  children: ReactNode;
  /** If provided, the provider redirects to `/staff/login` when the signed-in
   *  staff's role is not in the list. */
  allowedRoles?: StaffRole[];
  /** Node to render while the auth check is in flight. */
  fallback?: ReactNode;
}

export function StaffProvider({ children, allowedRoles, fallback }: StaffProviderProps) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffInfo | null>(null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

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
        setStaff({
          user_id: data.user_id,
          gym_id: data.gym_id,
          role: data.role,
          full_name: data.full_name ?? '',
          email: data.email ?? '',
          avatar_url: data.avatar_url ?? null,
          gym: data.gym ?? null,
        });
        const unit = data.weight_unit;
        if (unit === 'kg' || unit === 'lbs') setWeightUnit(unit);
        setAuthed(true);
      } catch {
        if (!cancelled) router.replace('/staff/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authed) {
    return <>{fallback ?? null}</>;
  }

  return (
    <StaffCtx.Provider value={{ staff, weightUnit, authed, loading }}>
      {children}
    </StaffCtx.Provider>
  );
}
