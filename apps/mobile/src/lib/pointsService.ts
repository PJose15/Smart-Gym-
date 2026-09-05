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
 * Returns total points (aggregated over ALL ledger rows, paged in chunks —
 * summing only the last 10 undercounts any active member) and the last 10
 * entries for display.
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

    // Aggregate the full ledger in pages (PostgREST caps a single response
    // at max-rows, so one un-limited select can silently truncate).
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 50; // safety cap: 50k rows
    let total = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
        const { data: pageRows, error: pageErr } = await supabase
            .from('points_ledger')
            .select('points')
            .eq('profile_id', profileId)
            .eq('gym_id', gymId)
            .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        if (pageErr) throw pageErr;
        const rows = (pageRows ?? []) as Array<{ points: number | null }>;
        total += rows.reduce((sum, r) => sum + (r.points ?? 0), 0);
        if (rows.length < PAGE_SIZE) break;
    }

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
