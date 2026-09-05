/**
 * Badge service — read-only view over the real achievement schema
 * (`achievement_definitions` + `member_achievements`).
 *
 * Awarding is server-side (the workout complete API inserts
 * member_achievements rows); mobile only reads and displays.
 */
import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────

export type AchievementCategory =
  | 'milestone'
  | 'performance'
  | 'consistency'
  | 'explorer'
  | 'community';

export interface BadgeWithStatus {
  id: string;
  code: string;
  title: string;
  description: string;
  category: AchievementCategory;
  points: number;
  required_value: number | null;
  required_unit: string | null;
  icon_name: string | null;
  sort_order: number;
  unlocked: boolean;
  earned_at: string | null;
}

interface DefinitionRow {
  id: string;
  code: string;
  title: string;
  description: string;
  category: AchievementCategory;
  points: number;
  required_value: number | null;
  required_unit: string | null;
  icon_name: string | null;
  sort_order: number;
}

const DEFINITION_COLUMNS =
  'id, code, title, description, category, points, required_value, required_unit, icon_name, sort_order';

// ─── Service Functions ──────────────────────────────────────

/**
 * Fetches all active achievement definitions merged with the member's
 * unlock status.
 *
 * `memberId` is `members.id` (NOT the auth user id — resolve via
 * `getMemberId` from memberData first). `gymId` is part of the agreed
 * cross-agent contract but unused in the query: achievements are
 * member-global per `UNIQUE(member_id, achievement_code)`.
 */
export async function getBadges(
  memberId: string,
  gymId: string,
): Promise<BadgeWithStatus[]> {
  void gymId; // member-global — see doc comment

  const [
    { data: definitions, error: defsErr },
    { data: unlocks, error: unlocksErr },
  ] = await Promise.all([
    supabase
      .from('achievement_definitions')
      .select(DEFINITION_COLUMNS)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('member_achievements')
      .select('achievement_code, earned_at')
      .eq('member_id', memberId)
      .limit(500),
  ]);

  if (defsErr) throw defsErr;
  if (unlocksErr) throw unlocksErr;

  const unlockMap = new Map<string, string>();
  for (const u of (unlocks ?? []) as { achievement_code: string; earned_at: string }[]) {
    unlockMap.set(u.achievement_code, u.earned_at);
  }

  return ((definitions ?? []) as unknown as DefinitionRow[]).map((def) => ({
    ...def,
    unlocked: unlockMap.has(def.code),
    earned_at: unlockMap.get(def.code) ?? null,
  }));
}

/**
 * Returns achievements earned within the last `sinceDays` days (default 1,
 * i.e. the old 24-hour home-card behavior), newest first.
 *
 * `memberId` is `members.id`; `gymId` is contract-only (see getBadges).
 */
export async function getRecentUnlocks(
  memberId: string,
  gymId: string,
  sinceDays = 1,
): Promise<BadgeWithStatus[]> {
  void gymId; // member-global — see getBadges doc comment

  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('member_achievements')
    .select(`earned_at, achievement_definitions(${DEFINITION_COLUMNS})`)
    .eq('member_id', memberId)
    .gte('earned_at', since)
    .order('earned_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    earned_at: string;
    achievement_definitions: DefinitionRow | null;
  }[];

  return rows
    .filter((row) => row.achievement_definitions != null)
    .map((row) => ({
      ...(row.achievement_definitions as DefinitionRow),
      unlocked: true,
      earned_at: row.earned_at,
    }));
}
