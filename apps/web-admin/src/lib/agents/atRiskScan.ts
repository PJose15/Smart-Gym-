/**
 * Shared at-risk scan helper.
 * Used by both the owner at-risk dashboard route and the weekly cron
 * to avoid logic duplication and ensure a single source of truth.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { computeAtRiskMembers } from '@nexera/ai-assist';
import type { AtRiskMember, MemberData } from '@nexera/ai-assist';

/**
 * Fetches active members for a gym, determines their last workout within the
 * past 30 days, and returns those flagged as at-risk by computeAtRiskMembers.
 *
 * The 30-day window bounds the sessions query to recent activity — any member
 * with no session in that window is already flagged (lastWorkoutAt = null).
 *
 * @param admin  Service-role Supabase client (bypasses RLS)
 * @param gymId  Gym to scan
 */
export async function fetchGymAtRiskMembers(
  admin: SupabaseClient,
  gymId: string
): Promise<AtRiskMember[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [membersRes, sessionsRes] = await Promise.all([
    admin
      .from('members')
      .select('id, display_name')
      .eq('gym_id', gymId)
      .eq('status', 'active'),
    admin
      .from('workout_sessions')
      .select('member_id, created_at')
      .eq('gym_id', gymId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false }),
  ]);

  const members = (membersRes as { data: Array<{ id: string; display_name: string }> | null }).data ?? [];
  const sessions = (sessionsRes as { data: Array<{ member_id: string; created_at: string }> | null }).data ?? [];

  // Build last-workout map — first occurrence = most recent (desc order)
  const lastWorkoutMap = new Map<string, string>();
  sessions.forEach((s) => {
    if (!lastWorkoutMap.has(s.member_id)) {
      lastWorkoutMap.set(s.member_id, s.created_at);
    }
  });

  // Map to MemberData — discomfort/plateau data not in schema; detection is
  // workout-recency only
  const memberData: MemberData[] = members.map((m) => ({
    profileId: m.id,
    memberName: m.display_name,
    lastWorkoutAt: lastWorkoutMap.get(m.id) ?? null,
    discomfortCount7d: 0,
    discomfortBodyAreas: [],
    plateauExercises: [],
  }));

  return computeAtRiskMembers(memberData);
}
