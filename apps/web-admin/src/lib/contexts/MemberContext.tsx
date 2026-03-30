'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

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
  loading: boolean;
}

const MemberCtx = createContext<MemberContextValue>({
  member: null,
  gym: null,
  loading: true,
});

export function useMember() {
  return useContext(MemberCtx);
}

interface MemberProviderProps {
  children: ReactNode;
}

export function MemberProvider({ children }: MemberProviderProps) {
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [gym, setGym] = useState<GymInfo | null>(null);
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

      const { data: gymRow } = await supabase
        .from('gyms')
        .select('id, name, slug, logo_url')
        .eq('id', memberRow.gym_id)
        .single();

      if (stale) return;
      if (gymRow) setGym(gymRow);
      setLoading(false);
    })();

    return () => { stale = true; };
  }, []);

  return (
    <MemberCtx.Provider value={{ member, gym, loading }}>
      {children}
    </MemberCtx.Provider>
  );
}
