import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemberGoal } from '@nexera/types';

interface CreateGoalParams {
  memberId: string;
  gymId: string;
  goalType: MemberGoal['goal_type'];
  machineId?: string | null;
  machineName?: string | null;
  targetWeightLbs?: number | null;
  targetReps?: number | null;
  targetSessions?: number | null;
  customDescription?: string | null;
  inspiredByMemberId?: string | null;
  inspiredByEventId?: string | null;
}

/**
 * Create a member goal (e.g. inspired by another member's PR).
 */
export async function createMemberGoal(
  params: CreateGoalParams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<string | null> {
  const { data } = await admin
    .from('member_goals')
    .insert({
      member_id: params.memberId,
      gym_id: params.gymId,
      goal_type: params.goalType,
      machine_id: params.machineId ?? null,
      machine_name: params.machineName ?? null,
      target_weight_lbs: params.targetWeightLbs ?? null,
      target_reps: params.targetReps ?? null,
      target_sessions: params.targetSessions ?? null,
      custom_description: params.customDescription ?? null,
      inspired_by_member_id: params.inspiredByMemberId ?? null,
      inspired_by_event_id: params.inspiredByEventId ?? null,
    })
    .select('id')
    .single();

  return data?.id ?? null;
}

/**
 * Check if any active goals were achieved after a session.
 * Runs after PR detection. Returns achieved goals.
 */
export async function checkGoalAchievement(
  memberId: string,
  gymId: string,
  machineId: string,
  bestWeightLbs: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<MemberGoal[]> {
  // Get active goals for this machine (scoped to gym)
  const { data: goals } = await admin
    .from('member_goals')
    .select('id, member_id, gym_id, goal_type, machine_id, machine_name, target_weight_lbs, target_reps, target_sessions, custom_description, inspired_by_member_id, inspired_by_event_id, is_achieved, achieved_at, created_at')
    .eq('member_id', memberId)
    .eq('gym_id', gymId)
    .eq('machine_id', machineId)
    .eq('is_achieved', false);

  if (!goals || goals.length === 0) return [];

  const achieved: MemberGoal[] = [];

  for (const goal of goals) {
    let isAchieved = false;

    if (goal.goal_type === 'beat_pr' || goal.goal_type === 'reach_weight') {
      if (goal.target_weight_lbs && bestWeightLbs >= goal.target_weight_lbs) {
        isAchieved = true;
      }
    }

    if (isAchieved) {
      const now = new Date().toISOString();
      await admin
        .from('member_goals')
        .update({ is_achieved: true, achieved_at: now })
        .eq('id', goal.id);

      achieved.push({ ...goal, is_achieved: true, achieved_at: now });

      // Create feed event for goal achievement
      // UI renders member name bold span separately, so no name prefix here.
      await admin.from('gym_feed_events').insert({
        gym_id: gymId,
        member_id: memberId,
        event_type: 'goal_reached',
        display_text: `hit their goal${goal.machine_name ? ` on ${goal.machine_name}` : ''}${goal.target_weight_lbs ? ` — ${goal.target_weight_lbs} lbs` : ''}!`,
        context_data: {
          goal_id: goal.id,
          machine_name: goal.machine_name,
          target_weight: goal.target_weight_lbs,
          achieved_weight: bestWeightLbs,
          inspired_by_member_id: goal.inspired_by_member_id,
        },
        priority: 'high',
      });

      // Notify the member who inspired the goal
      if (goal.inspired_by_member_id) {
        await admin.from('notifications').insert({
          member_id: goal.inspired_by_member_id,
          gym_id: gymId,
          notification_type: 'goal_inspired',
          title: 'Someone hit a goal inspired by your PR',
          body: `${name} just hit ${bestWeightLbs} lbs${goal.machine_name ? ` on ${goal.machine_name}` : ''}!`,
          data: { goal_id: goal.id, member_id: memberId },
          channel: 'in-app',
          status: 'sent',
        });
      }
    }
  }

  return achieved;
}

/**
 * Get active goals for a member, optionally filtered by machine.
 */
export async function getActiveGoals(
  memberId: string,
  machineId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<MemberGoal[]> {
  let query = admin
    .from('member_goals')
    .select('id, member_id, gym_id, goal_type, machine_id, machine_name, target_weight_lbs, target_reps, target_sessions, custom_description, inspired_by_member_id, inspired_by_event_id, is_achieved, achieved_at, created_at')
    .eq('member_id', memberId)
    .eq('is_achieved', false)
    .order('created_at', { ascending: false });

  if (machineId) {
    query = query.eq('machine_id', machineId);
  }

  const { data } = await query;
  return (data ?? []) as MemberGoal[];
}
