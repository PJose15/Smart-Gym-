'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { WeightUnit } from '@/lib/weight';

interface MemberInfo {
  id: string;
  user_id: string | null;
  display_name: string;
  first_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  smartgym_score: number;
  current_streak: number;
  primary_goal: string | null;
  experience_level: string | null;
  gym_id: string;
}

interface GymInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

interface MemberContextValue {
  member: MemberInfo | null;
  gym: GymInfo | null;
  weightUnit: WeightUnit;
  loading: boolean;
}

const MemberCtx = createContext<MemberContextValue>({
  member: null,
  gym: null,
  weightUnit: 'lbs',
  loading: true,
});

export function useMember() {
  return useContext(MemberCtx);
}

/**
 * Convenience hook — returns the signed-in member's preferred weight unit.
 * Falls back to 'lbs' before the context hydrates, so display code never
 * sees `undefined` and can format synchronously on first render.
 */
export function useWeightUnit(): WeightUnit {
  return useContext(MemberCtx).weightUnit;
}

interface MemberProviderProps {
  children: ReactNode;
}

export function MemberProvider({ children }: MemberProviderProps) {
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [gym, setGym] = useState<GymInfo | null>(null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stale = false;
    const supabase = createClient();

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (stale) return;
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data: memberRow } = await supabase
        .from('members')
        .select('id, user_id, display_name, first_name, avatar_url, phone, smartgym_score, current_streak, primary_goal, experience_level, gym_id')
        .eq('user_id', session.user.id)
        .single();

      if (stale) return;
      if (!memberRow) {
        setLoading(false);
        return;
      }

      setMember(memberRow);

      // Fetch gym + member settings in parallel. Both are independent of
      // each other, and neither blocks rendering (we already setMember
      // which flips MemberAuthGate open).
      const [gymResult, settingsResult] = await Promise.all([
        supabase
          .from('gyms')
          .select('id, name, slug, logo_url')
          .eq('id', memberRow.gym_id)
          .single(),
        supabase
          .from('member_settings')
          .select('weight_unit')
          .eq('member_id', memberRow.id)
          .maybeSingle(),
      ]);

      if (stale) return;
      if (gymResult.data) setGym(gymResult.data);
      const unit = settingsResult.data?.weight_unit;
      if (unit === 'kg' || unit === 'lbs') setWeightUnit(unit);
      setLoading(false);
    })();

    return () => { stale = true; };
  }, []);

  return (
    <MemberCtx.Provider value={{ member, gym, weightUnit, loading }}>
      {children}
    </MemberCtx.Provider>
  );
}
