import { supabase } from './supabase';

export interface PointsEntry {
    id: string;
    points: number;
    reason: string;
    created_at: string;
}

export interface PointsSummary {
    total: number;
    entries: PointsEntry[];
}

/**
 * Fetches the points ledger for the current user in a given gym.
 * Returns total points and the last 10 entries.
 */
export async function getPointsSummary(
    profileId: string,
    gymId: string,
): Promise<PointsSummary> {
    const { data, error } = await supabase
        .from('points_ledger')
        .select('id, points, reason, created_at')
        .eq('profile_id', profileId)
        .eq('gym_id', gymId)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) throw error;

    const entries = (data ?? []) as PointsEntry[];
    const total = entries.reduce((sum, e) => sum + e.points, 0);

    return { total, entries };
}

/**
 * Awards points to a user for a specific reason.
 * Idempotent via reference_id — safe to call multiple times.
 */
export async function awardPoints(input: {
    profileId: string;
    gymId: string;
    points: number;
    reason: 'workout_completed' | 'pr_achieved' | 'streak_bonus' | 'manual';
    referenceId?: string;
}): Promise<void> {
    const { profileId, gymId, points, reason, referenceId } = input;

    const { error } = await supabase.from('points_ledger').insert({
        profile_id: profileId,
        gym_id: gymId,
        points,
        reason,
        reference_id: referenceId ?? null,
    });

    if (error) throw error;
}

/**
 * Formats a points_reason enum value into a human-readable label.
 */
export function formatPointsReason(reason: string): string {
    switch (reason) {
        case 'workout_completed': return 'Workout completed';
        case 'pr_achieved': return 'Personal record!';
        case 'streak_bonus': return 'Streak bonus';
        case 'manual': return 'Bonus points';
        default: return reason;
    }
}
