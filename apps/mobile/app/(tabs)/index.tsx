import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../src/lib/supabase';
import { getTodaysProgramDay } from '@nexera/utils';
import { getTodayExplanation, computeGuardrails, getCoachingInsight, buildMemberContext, computeLevelProgress } from '@nexera/ai-assist';
import type { CoachingInsight, LevelProgress } from '@nexera/ai-assist';
import { fetchCoachingInsight } from '../../src/lib/aiService';
import { isFeatureEnabled, needsRefresh, refreshFeatureFlags } from '../../src/lib/featureFlags';
import { trackEvent } from '../../src/lib/events';
import { getStreak } from '../../src/lib/streakService';
import type { StreakResult } from '../../src/lib/streakService';
import { getBadges } from '../../src/lib/badgeService';
import type { BadgeWithStatus } from '../../src/lib/badgeService';
import { getBadgeEmoji } from '../../src/lib/achievementDisplay';
import { getUserRank } from '../../src/lib/leaderboardService';
import { localSessionDate } from '../../src/lib/sessionApi';
import { getWeightUnit } from '../../src/lib/weightUnit';
import { toWorkoutRecords, computeMuscleGaps } from '../../src/lib/sessionAdapters';
import type { SessionRow, SessionMachineRow } from '../../src/lib/sessionAdapters';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PRDetection } from '@nexera/types';
import { deduper } from '../../src/lib/requestDeduper';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Text } from '../../src/components';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { SkeletonGate, HomeScreenSkeleton } from '../../src/components/skeleton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { TodayExplanation, UserGoal, GuardrailInsight, ExperienceLevel, SessionIntent, WeightUnit } from '@nexera/types';
import { extractAiProgramDays } from '../../src/lib/workoutMode';
import { computeHeroState } from '../../src/lib/heroState';
import type { HeroInput } from '../../src/lib/heroState';
import { HeroZone } from '../../src/components/home/HeroZone';
import { TodayZone } from '../../src/components/home/TodayZone';
import { MomentumZone } from '../../src/components/home/MomentumZone';
import { CommunityPulse } from '../../src/components/home/CommunityPulse';

interface TodayWorkout {
  dayName: string;
  exercises: Array<{
    id: string;
    exercise_name: string;
    default_sets: number;
    default_reps: number;
    machine_id: string | null;
  }>;
}

interface ActiveWorkout {
  id: string;
}

const RECOVERY_TIPS = [
  'Hydrate well — aim for at least 2L of water today.',
  'Light stretching or a short walk helps with recovery.',
  'Sleep 7–9 hours for optimal muscle repair.',
  'A protein-rich meal within 2 hours post-workout boosts recovery.',
  'Foam rolling can reduce soreness and improve mobility.',
  'Take a moment to breathe — mental recovery matters too.',
  'Try to keep moving lightly; total rest can increase stiffness.',
];

function getTodayTip(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
  );
  return RECOVERY_TIPS[dayOfYear % RECOVERY_TIPS.length];
}

const TRAINING_TIPS = [
  'Warm up with 5 minutes of light cardio before lifting — it primes your muscles and reduces injury risk.',
  'Focus on controlled negatives: lowering the weight slowly builds more strength than rushing.',
  'Breathe out on the effort, in on the release. Proper breathing stabilises your core.',
  'Track your weights — even small weekly increases add up to big gains over months.',
  'Compound lifts (squat, deadlift, bench) give you the most bang for your time.',
  'Rest 60–90s between sets for hypertrophy, 2–3 min for strength work.',
  'Keep your phone in your bag during sets — distraction kills intensity.',
  'Good form at a lighter weight always beats bad form at a heavier weight.',
  'Eat protein within a couple of hours post-workout to support recovery.',
  'Consistency beats perfection — showing up 3× a week is better than one perfect session.',
  'Superset opposing muscles (e.g. biceps + triceps) to save time without losing quality.',
  'If a movement feels off, try a slight grip or stance adjustment before adding more weight.',
  'Progressive overload doesn\'t just mean more weight — more reps or slower tempo counts too.',
  'Deload weeks every 4–6 weeks let your joints and tendons catch up to your muscles.',
];

function getTodayTrainingTip(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
  );
  return TRAINING_TIPS[dayOfYear % TRAINING_TIPS.length];
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkout | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [explanation, setExplanation] = useState<TodayExplanation | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardrails, setGuardrails] = useState<GuardrailInsight[]>([]);
  const [unreadNotes, setUnreadNotes] = useState(0);
  const [sessionIntent, setSessionIntent] = useState<SessionIntent>('push');
  const [gymId, setGymId] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakResult | null>(null);
  const [userRank, setUserRank] = useState<{ rank: number; total: number } | null>(null);
  const [coachingInsight, setCoachingInsight] = useState<CoachingInsight | null>(null);
  const [recentBadges, setRecentBadges] = useState<BadgeWithStatus[]>([]);

  // Always-visible elements
  const [programDayContext, setProgramDayContext] = useState<{ dayNumber: number; totalDays: number } | null>(null);
  const [totalWorkoutCount, setTotalWorkoutCount] = useState(0);
  const [userGoal, setUserGoal] = useState<UserGoal | null>(null);

  // Level/score data
  const [memberScore, setMemberScore] = useState(0);
  const [levelData, setLevelData] = useState<LevelProgress | null>(null);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);

  // PR Celebration Banner
  const [unseenPRs, setUnseenPRs] = useState<PRDetection[]>([]);

  // Smart Rest Day
  const [todayDone, setTodayDone] = useState(false);
  const [nextDayPreview, setNextDayPreview] = useState<{ name: string; exerciseCount: number } | null>(null);

  // Weekly Progress Summary
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(0);
  const [weeklyVolume, setWeeklyVolume] = useState(0); // canonical lbs
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs');

  const mountedRef = useRef(true);

  const abortRef = useRef<AbortController | null>(null);

  const loadHome = useCallback(async () => {
    // Cancel any in-flight load
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || controller.signal.aborted) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      // Refresh feature flags if stale
      if (needsRefresh()) {
        await refreshFeatureFlags();
      }

      // Load profile name + avatar
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (mountedRef.current) {
        setUserName(profileData?.full_name || null);
        setAvatarUrl(profileData?.avatar_url || null);
      }

      // Load unseen PRs from local storage
      try {
        const prData = await AsyncStorage.getItem('@nexera/unseen_prs');
        if (prData && mountedRef.current) {
          const parsed = JSON.parse(prData) as PRDetection[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUnseenPRs(parsed);
          }
        }
      } catch {
        await AsyncStorage.removeItem('@nexera/unseen_prs');
      }

      // Load gym membership
      const { data: memberData } = await supabase
        .from('gym_members')
        .select('gym_id')
        .eq('profile_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!memberData?.gym_id) {
        if (mountedRef.current) {
          setError('You are not a member of any gym yet. Please ask your gym to add you.');
          setLoading(false);
        }
        return;
      }

      const gymId = memberData.gym_id;
      if (controller.signal.aborted) return;
      if (mountedRef.current) setGymId(gymId);

      // Resolve the canonical members.id EARLY — every workout_sessions
      // query keys on member_id (members.id), NOT profile_id.
      const { data: memberRecord } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .eq('gym_id', gymId)
        .maybeSingle();

      if (!memberRecord) {
        if (mountedRef.current) {
          setError('You are not a member of any gym yet. Please ask your gym to add you.');
          setLoading(false);
        }
        return;
      }
      const memberId: string = memberRecord.id;

      // Member's preferred display unit (weights are stored in lbs)
      try {
        const unit = await getWeightUnit();
        if (mountedRef.current) setWeightUnit(unit);
      } catch {
        // keep default 'lbs'
      }

      const todayDate = localSessionDate();

      // Check for an active (started, not yet completed) session today
      const { data: activeData } = await supabase
        .from('workout_sessions')
        .select('id, created_at')
        .eq('member_id', memberId)
        .eq('session_date', todayDate)
        .is('completed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mountedRef.current) setActiveWorkout(activeData ? { id: activeData.id } : null);

      // Load member score and level
      try {
        const { data: scoreData } = await supabase
          .from('gym_members')
          .select('smartgym_score')
          .eq('profile_id', user.id)
          .eq('gym_id', gymId)
          .maybeSingle();
        if (scoreData?.smartgym_score != null && mountedRef.current) {
          setMemberScore(scoreData.smartgym_score);
          setLevelData(computeLevelProgress(scoreData.smartgym_score));
        }
      } catch (err) {
        console.warn('[home] score load failed:', err instanceof Error ? err.message : err);
      }

      // Load last completed session date
      try {
        const { data: lastSession } = await supabase
          .from('workout_sessions')
          .select('completed_at')
          .eq('member_id', memberId)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastSession?.completed_at && mountedRef.current) {
          setLastSessionDate(lastSession.completed_at);
        }
      } catch (err) {
        console.warn('[home] last session load failed:', err instanceof Error ? err.message : err);
      }

      // Load total completed session count (always-visible quick stat)
      try {
        const { count: totalCount } = await supabase
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('member_id', memberId)
          .not('completed_at', 'is', null);
        if (mountedRef.current) setTotalWorkoutCount(totalCount ?? 0);
      } catch (err) {
        console.warn('[home] total workout count failed:', err instanceof Error ? err.message : err);
      }

      // Load training goal (always-visible)
      try {
        const { data: trainingGoalData } = await supabase
          .from('user_training_profiles')
          .select('goal')
          .eq('profile_id', user.id)
          .eq('gym_id', gymId)
          .maybeSingle();
        if (mountedRef.current) setUserGoal((trainingGoalData?.goal as UserGoal | undefined) ?? null);
      } catch (err) {
        console.warn('[home] training goal load failed:', err instanceof Error ? err.message : err);
      }

      // Load streak
      if (isFeatureEnabled('streaks_enabled')) {
        try {
          const streakData = await getStreak(user.id, gymId);
          if (mountedRef.current) setStreak(streakData);
        } catch (err) {
          console.warn('[home] streak load failed:', err instanceof Error ? err.message : err);
        }
      }

      // Load leaderboard rank
      if (isFeatureEnabled('leaderboard_enabled')) {
        try {
          const rank = await getUserRank(gymId, user.id, 'weekly');
          if (mountedRef.current) setUserRank(rank);
        } catch (err) {
          console.warn('[home] rank load failed:', err instanceof Error ? err.message : err);
        }
      }

      // Load recent badge unlocks (earned within the last 24h, newest first)
      if (isFeatureEnabled('badges_enabled')) {
        try {
          const allBadges = await getBadges(memberId, gymId);
          const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
          const recent = allBadges
            .filter((b) => b.unlocked && b.earned_at && new Date(b.earned_at).getTime() >= dayAgo)
            .sort((a, b) =>
              new Date(b.earned_at as string).getTime() - new Date(a.earned_at as string).getTime(),
            );
          if (mountedRef.current) setRecentBadges(recent);
        } catch (err) {
          console.warn('[home] badges load failed:', err instanceof Error ? err.message : err);
        }
      }

      // Load active program via member record. The active
      // member_program_assignments row is the source of truth — it points at
      // EITHER a trainer-built program (program_id → programs/program_days/
      // program_exercises) OR an AI program (ai_program_id → ai_programs
      // with program_data JSON). Fall back to the latest active ai_programs
      // row for members without an assignment row.
      const { data: assignmentRow } = await supabase
        .from('member_program_assignments')
        .select('program_id, ai_program_id, assigned_at')
        .eq('member_id', memberId)
        .eq('status', 'active')
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      interface ProgramDayExercise { exercise_name?: string; default_sets?: number; default_reps?: number; machine_id?: string | null }
      interface HomeDay { id: string; program_id: string; day_number: number; name: string; exercises: ProgramDayExercise[] }

      let days: HomeDay[] = [];
      let assignedAt: string | null = null;

      // Path A: trainer-built program (assignment has program_id)
      if (assignmentRow?.program_id) {
        const { data: programDays } = await supabase
          .from('program_days')
          .select('id, day_number, name')
          .eq('program_id', assignmentRow.program_id)
          .order('day_number');

        if (programDays && programDays.length > 0) {
          const dayIds = programDays.map((d: { id: string }) => d.id);
          const { data: dayExercises } = await supabase
            .from('program_exercises')
            .select('id, program_day_id, exercise_name, default_sets, default_reps, machine_id, order_index')
            .in('program_day_id', dayIds)
            .order('order_index');

          days = programDays.map((d: { id: string; day_number: number; name: string }) => ({
            id: d.id,
            program_id: assignmentRow.program_id as string,
            day_number: d.day_number,
            name: d.name,
            exercises: (dayExercises ?? []).filter(
              (e: { program_day_id: string }) => e.program_day_id === d.id,
            ),
          }));
          assignedAt = assignmentRow.assigned_at;
        }
      }

      // Path B: AI program (assignment has ai_program_id, or legacy fallback
      // to the latest active ai_programs row when no assignment exists)
      if (days.length === 0) {
        let aiProgram: { id: string; program_data: unknown; created_at: string } | null = null;

        if (assignmentRow?.ai_program_id) {
          const { data } = await supabase
            .from('ai_programs')
            .select('id, program_data, created_at')
            .eq('id', assignmentRow.ai_program_id)
            .maybeSingle();
          aiProgram = data;
        }

        if (!aiProgram && !assignmentRow) {
          const { data } = await supabase
            .from('ai_programs')
            .select('id, program_data, created_at')
            .eq('member_id', memberId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          aiProgram = data;
        }

        if (aiProgram?.program_data) {
          // Parse days from program_data JSON ({ days } or { weeks } shape)
          const aiProgramId = aiProgram.id;
          days = extractAiProgramDays(aiProgram.program_data).map((d, idx) => ({
            id: `day-${idx}`,
            program_id: aiProgramId,
            day_number: d.day_number ?? idx + 1,
            name: d.name ?? `Day ${idx + 1}`,
            exercises: d.exercises ?? [],
          }));
          // Use assignment date (or program creation) for day cycling
          assignedAt = assignmentRow?.assigned_at ?? aiProgram.created_at;
        }
      }

      const assignment = { assigned_at: assignedAt ?? new Date().toISOString() };

      if (!days || days.length === 0) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      // ─── Weekly Progress Summary ─────────────────────
      if (mountedRef.current) setWeeklyGoal(days.length);

      try {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMonday);
        const mondayDate = localSessionDate(monday); // local Monday, YYYY-MM-DD

        const { data: weekSessions } = await supabase
          .from('workout_sessions')
          .select('id, session_date, total_volume_lbs')
          .eq('member_id', memberId)
          .not('completed_at', 'is', null)
          .gte('session_date', mondayDate)
          .limit(100);

        const wkList = weekSessions ?? [];
        // Sessions are per-machine rows — a "workout" for the weekly goal is
        // one distinct training day (weeklyGoal counts program days).
        const distinctDays = new Set(
          wkList.map((s: { session_date: string }) => s.session_date),
        ).size;
        if (mountedRef.current) setWeeklyWorkouts(distinctDays);

        const totalVolLbs = wkList.reduce(
          (sum: number, s: { total_volume_lbs: number | null }) =>
            sum + (Number(s.total_volume_lbs) || 0),
          0,
        );
        if (mountedRef.current) setWeeklyVolume(Math.round(totalVolLbs));
      } catch (err) {
        console.warn('[home] weekly progress load failed:', err instanceof Error ? err.message : err);
      }

      const todayDayNumber = getTodaysProgramDay(assignment.assigned_at, days.length);
      const todayDay = days.find((d: any) => d.day_number === todayDayNumber) || days[0];

      // Set program day context (always-visible)
      if (mountedRef.current) setProgramDayContext({ dayNumber: todayDayNumber, totalDays: days.length });

      // Exercises come from parsed program_data JSON
      const todayExercises = (todayDay.exercises ?? []).map((ex: any, i: number) => ({
        id: `ex-${i}`,
        exercise_name: ex.exercise_name ?? 'Unknown',
        default_sets: ex.default_sets ?? 3,
        default_reps: ex.default_reps ?? 10,
        machine_id: ex.machine_id ?? null,
      }));

      if (mountedRef.current) {
        setTodayWorkout({
          dayName: todayDay.name,
          exercises: todayExercises,
        });
      }

      // ─── Smart Rest Day: check if today's workout is done ──
      try {
        const { count: completedToday } = await supabase
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('member_id', memberId)
          .eq('session_date', todayDate)
          .not('completed_at', 'is', null);

        const done = (completedToday ?? 0) > 0;
        if (mountedRef.current) setTodayDone(done);

        if (done) {
          // Load tomorrow's program day preview
          const tomorrowDayNumber = (todayDayNumber % days.length) + 1;
          const tomorrowDay = days.find((d: any) => d.day_number === tomorrowDayNumber) || days[0];

          if (mountedRef.current) {
            setNextDayPreview({
              name: tomorrowDay.name,
              exerciseCount: tomorrowDay.exercises?.length ?? 0,
            });
          }
        }
      } catch (err) {
        console.warn('[home] rest day check failed:', err instanceof Error ? err.message : err);
      }

      // Bail out early if this load was superseded
      if (controller.signal.aborted) return;

      // Load "Why This Today" explanation if feature enabled
      if (isFeatureEnabled('why_this_today_enabled') && todayExercises.length > 0) {
        // Load training profile for goal
        const { data: trainingProfile } = await supabase
          .from('user_training_profiles')
          .select('goal')
          .eq('profile_id', user.id)
          .eq('gym_id', gymId)
          .maybeSingle();

        // Build muscle gap map: for each exercise's target muscles, find how
        // many days since a completed session trained that muscle. One query
        // over recent sessions (+ joined machine muscles), computed locally.
        let muscleGaps: Record<string, number> = {};
        const machineIds = todayExercises
          .map((e: any) => e.machine_id)
          .filter((id: any): id is string => id !== null);

        if (machineIds.length > 0) {
          const { data: machines } = await supabase
            .from('machines')
            .select('id, muscle_groups')
            .in('id', machineIds);

          if (machines) {
            const allMuscles = new Set<string>();
            for (const m of machines) {
              for (const muscle of m.muscle_groups) {
                allMuscles.add(muscle);
              }
            }

            if (allMuscles.size > 0) {
              const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
              const { data: muscleSessions } = await supabase
                .from('workout_sessions')
                .select('session_date, completed_at, machines(muscle_groups)')
                .eq('member_id', memberId)
                .not('completed_at', 'is', null)
                .gte('session_date', localSessionDate(ninetyDaysAgo))
                .order('session_date', { ascending: false })
                .limit(200);

              muscleGaps = computeMuscleGaps(
                (muscleSessions ?? []) as SessionMachineRow[],
                allMuscles,
              );
            }
          }
        }

        try {
          const exp = await getTodayExplanation({
            programDay: todayDay,
            exercises: todayExercises.map((e: any) => ({
              id: e.id,
              program_day_id: todayDay.id,
              machine_id: e.machine_id,
              exercise_name: e.exercise_name,
              order_index: 0,
              default_sets: e.default_sets,
              default_reps: e.default_reps,
            })),
            goal: (trainingProfile?.goal as UserGoal | undefined) || 'general',
            lastMuscleWorkouts: Object.keys(muscleGaps).length > 0 ? muscleGaps : undefined,
          });
          if (mountedRef.current) setExplanation(exp);
        } catch (err) {
          console.warn('[home] explanation load failed:', err instanceof Error ? err.message : err);
        }
      }

      // ─── Phase 2.5.2: Guardrails ─────────────────────
      if (isFeatureEnabled('ai_guardrails')) {
        try {
          // Fetch recent 14 days of completed sessions (+ machine metadata),
          // grouped into one WorkoutRecord per training day by the adapter.
          const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentSessions } = await supabase
            .from('workout_sessions')
            .select('id, machine_id, session_date, created_at, completed_at, sets, machines(name, muscle_groups)')
            .eq('member_id', memberId)
            .not('completed_at', 'is', null)
            .gte('completed_at', twoWeeksAgo)
            .order('completed_at', { ascending: false });

          if (recentSessions && recentSessions.length > 0) {
            const workoutRecords = toWorkoutRecords(recentSessions as SessionRow[]);

            // Get training profile for experience
            const { data: tp } = await supabase
              .from('user_training_profiles')
              .select('experience')
              .eq('profile_id', user.id)
              .eq('gym_id', gymId)
              .maybeSingle();

            const experience = (tp?.experience as ExperienceLevel) ?? 'intermediate';

            const insights = computeGuardrails({
              experience,
              recentWorkouts: workoutRecords,
            });

            if (mountedRef.current) setGuardrails(insights);
          }
        } catch (err) {
          console.warn('[home] guardrails load failed:', err instanceof Error ? err.message : err);
        }
      }
      // ─── Phase 3: AI Coaching Insight ─────────────
      if (isFeatureEnabled('ai_coaching')) {
        try {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentSessions30 } = await supabase
            .from('workout_sessions')
            .select('id, machine_id, session_date, created_at, completed_at, sets, machines(name, muscle_groups)')
            .eq('member_id', memberId)
            .not('completed_at', 'is', null)
            .gte('completed_at', thirtyDaysAgo)
            .order('completed_at', { ascending: false });

          // One WorkoutRecord per training day, kg-shaped for ai-assist
          const coachingWorkouts = toWorkoutRecords((recentSessions30 ?? []) as SessionRow[]);

          // Get all completed training dates for streak calc (one per
          // distinct session_date — sessions are per-machine rows)
          const { data: allDates } = await supabase
            .from('workout_sessions')
            .select('session_date')
            .eq('member_id', memberId)
            .not('completed_at', 'is', null)
            .limit(1000);

          const completedWorkoutDates = [
            ...new Set((allDates ?? []).map((d: { session_date: string }) => d.session_date)),
          ];

          // Get feedback trends. The column is `feedback` (values include
          // 'discomfort'/'pain'/'unstable'/'ok') — NOT `rating`.
          const { data: feedbackData, error: feedbackErr } = await supabase
            .from('set_feedback')
            .select('feedback')
            .eq('profile_id', user.id)
            .gte('created_at', thirtyDaysAgo)
            .limit(1000);

          if (feedbackErr) {
            console.warn('[home] feedback trends load failed:', feedbackErr.message);
          }

          const feedbackTrends = {
            discomfort_count: 0,
            unstable_count: 0,
            ok_count: 0,
          };
          for (const f of feedbackData ?? []) {
            if (f.feedback === 'discomfort' || f.feedback === 'pain') feedbackTrends.discomfort_count++;
            else if (f.feedback === 'unstable') feedbackTrends.unstable_count++;
            else feedbackTrends.ok_count++;
          }

          const coachingInput = {
            memberName: profileData?.full_name || 'there',
            workouts: coachingWorkouts,
            prs: [],
            feedbackTrends,
            completedWorkoutDates,
          };

          // Try AI via edge function, fall back to deterministic rules
          const ctx = buildMemberContext(coachingInput);
          const aiResult = await fetchCoachingInsight({
            memberName: coachingInput.memberName,
            contextSummary: ctx.summaryText,
            gaps: ctx.gaps,
            risks: ctx.risks,
            recentPRs: ctx.recentPRs,
          });

          if (mountedRef.current) {
            if (aiResult.ok && aiResult.data.message && aiResult.data.message.length > 10) {
              setCoachingInsight({
                message: aiResult.data.message,
                action_items: aiResult.data.action_items,
                source: 'ai',
              });
            } else {
              const coaching = await getCoachingInsight(coachingInput);
              setCoachingInsight(coaching);
            }
          }
        } catch (err) {
          console.warn('[home] coaching insight failed:', err instanceof Error ? err.message : err);
        }
      }

      // ─── Phase 2.5.3: Coach Notes count ─────────────
      if (isFeatureEnabled('ai_trainer_copilot')) {
        try {
          const { count } = await supabase
            .from('coach_notes')
            .select('id', { count: 'exact', head: true })
            .eq('member_profile_id', user.id)
            .eq('status', 'sent');
          if (mountedRef.current) setUnreadNotes(count ?? 0);
        } catch (err) {
          console.warn('[home] coach notes count failed:', err instanceof Error ? err.message : err);
        }
      }
    } catch (err: unknown) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load home');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      deduper.dedupe('home:load', loadHome).catch(() => {});
      return () => {
        mountedRef.current = false;
        abortRef.current?.abort();
      };
    }, [loadHome]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    deduper.clear('home:load');
    await deduper.dedupe('home:load', loadHome).catch(() => {});
    setRefreshing(false);
  }, [loadHome]);

  // ─── Phase 2.5.4: Guardrail acknowledgement ─────────
  const handleGuardrailAck = useCallback(async () => {
    if (guardrails.length === 0 || !gymId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Acknowledge the highest-severity guardrail shown
      const topGuardrail = guardrails[0];
      const { error: ackErr } = await supabase.from('guardrail_acknowledgements').insert({
        gym_id: gymId,
        profile_id: user.id,
        insight_type: topGuardrail.insight_type,
        severity: topGuardrail.severity,
      });

      if (ackErr) {
        console.warn('[guardrail] ack persist failed:', ackErr.message);
        return;
      }

      trackEvent('guardrail_acknowledged', {
        insight_type: topGuardrail.insight_type,
        severity: topGuardrail.severity,
      });

      setGuardrails([]);
    } catch (err) {
      console.warn('[guardrail] ack failed:', err instanceof Error ? err.message : err);
    }
  }, [guardrails, gymId]);

  const handleMakeLighter = useCallback(() => {
    setSessionIntent('light');
    trackEvent('session_intent_set', { intent: 'light' });
    handleGuardrailAck();
  }, [handleGuardrailAck]);

  const dismissPRs = useCallback(async () => {
    setUnseenPRs([]);
    try {
      await AsyncStorage.removeItem('@nexera/unseen_prs');
    } catch (err) {
      console.warn('[home] PR dismiss failed:', err);
    }
  }, []);

  // Compute hero state from loaded data (memoized to prevent unnecessary re-renders)
  const heroInput = useMemo<HeroInput>(() => ({
    firstName: userName?.split(' ')[0] || 'there',
    streak: streak?.currentStreak ?? 0,
    todaySessionCount: todayDone ? 1 : 0,
    hasProgram: !!todayWorkout,
    programTitle: todayWorkout?.dayName,
    programDayNumber: programDayContext?.dayNumber,
    programTotalDays: programDayContext?.totalDays,
    programMachineCount: todayWorkout?.exercises.length ?? 0,
    programEstDuration: todayWorkout
      ? Math.round(todayWorkout.exercises.reduce((sum, e) => sum + e.default_sets, 0) * 2.5)
      : undefined,
    programTodaysFocus: todayWorkout?.dayName,
    lastSessionDate: lastSessionDate,
    lastSessionIsPR: unseenPRs.length > 0,
    lastSessionPRMachine: unseenPRs[0]?.exercise_name,
    lastSessionPRWeight: unseenPRs[0]?.value,
    weeklyVolume,
    weightUnit,
    weeklyWorkouts,
    score: memberScore,
    level: levelData?.current.level ?? 1,
    levelName: levelData?.current.name,
  }), [userName, streak, todayDone, todayWorkout, programDayContext, lastSessionDate, unseenPRs, weeklyVolume, weightUnit, weeklyWorkouts, memberScore, levelData]);

  const heroState = computeHeroState(heroInput);

  return (
    <SkeletonGate loading={loading} skeleton={<HomeScreenSkeleton />}>
    <AnimatedScreen>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text variant="caption" style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* HERO ZONE — Personal greeting card */}
        <HeroZone
          hero={heroState}
          firstName={userName?.split(' ')[0] || 'there'}
          avatarUrl={avatarUrl}
          level={levelData?.current.level ?? 1}
          streak={streak?.currentStreak ?? 0}
        />

        {/* PR CELEBRATION — if unseen PRs */}
        {unseenPRs.length > 0 && (
          <AnimatedCard index={0} style={styles.prBanner}>
            {/* Energy-ribbon top accent (gold → crimson) for the featured PR moment */}
            <LinearGradient
              colors={[colors.gold, colors.primaryLight, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.prBannerRibbon}
            />
            <View style={styles.prBannerHeader}>
              <Text style={styles.prBannerTrophy}>{'\uD83C\uDFC6'}</Text>
              <Text style={styles.prBannerTitle}>
                New PR{unseenPRs.length > 1 ? 's' : ''}!
              </Text>
              <TouchableOpacity
                onPress={dismissPRs}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss PR celebration"
              >
                <Text style={styles.prBannerDismiss}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>
            {unseenPRs.slice(0, 3).map((pr, i) => (
              <View key={i} style={styles.prBannerRow}>
                <View style={styles.prBannerTypeBadge}>
                  <Text style={styles.prBannerTypeText}>
                    {pr.type === 'PR_WEIGHT' ? 'Weight' : pr.type === 'PR_REPS' ? 'Reps' : '1RM'}
                  </Text>
                </View>
                <Text style={styles.prBannerExercise} numberOfLines={1}>
                  {pr.exercise_name}
                </Text>
                <Text style={styles.prBannerValue}>
                  {pr.type === 'PR_REPS' ? `${pr.value} reps` : `${pr.value}kg`}
                </Text>
              </View>
            ))}
          </AnimatedCard>
        )}

        {/* TODAY ZONE — What to do today */}
        <TodayZone
          todayWorkout={todayWorkout}
          todayDone={todayDone}
          // TodayZone pushes `/workout/${activeWorkoutId}` — '/workout/today'
          // renders today's active sessions (core-flow contract), so the
          // continue CTA routes there rather than to a single session id.
          activeWorkoutId={activeWorkout ? 'today' : undefined}
          nextDayPreview={nextDayPreview}
          sessionIntent={sessionIntent}
          restDayTip={getTodayTip()}
          coachingMessage={coachingInsight?.message}
          coachingSource={coachingInsight?.source}
        />

        {/* MOMENTUM ZONE — Streak, weekly stats, level */}
        <MomentumZone
          streak={streak?.currentStreak ?? 0}
          weeklyWorkouts={weeklyWorkouts}
          weeklyGoal={weeklyGoal || 3}
          weeklyVolume={weeklyVolume}
          weightUnit={weightUnit}
          level={levelData?.current.level ?? 1}
          score={memberScore}
        />

        {/* GUARDRAILS — Training nudge */}
        {guardrails.length > 0 && (
          <AnimatedCard index={3} style={styles.guardrailBanner}>
            <Text variant="label" style={styles.guardrailTitle}>Training Nudge</Text>
            {guardrails.slice(0, 2).map((g, i) => (
              <View key={i} style={styles.guardrailItem}>
                <View style={[
                  styles.guardrailSeverityDot,
                  g.severity === 'high' ? styles.guardrailDotHigh
                    : g.severity === 'medium' ? styles.guardrailDotMedium
                    : styles.guardrailDotLow,
                ]} />
                <Text variant="body" style={styles.guardrailMessage}>{g.message}</Text>
              </View>
            ))}
            <View style={styles.guardrailActions}>
              <Button
                title="Make today lighter"
                onPress={handleMakeLighter}
                variant="outline"
                style={styles.guardrailActionBtn}
              />
              <Button
                title="Got it"
                onPress={handleGuardrailAck}
                variant="outline"
                style={styles.guardrailActionBtn}
              />
            </View>
          </AnimatedCard>
        )}

        {/* COMMUNITY PULSE — Activity & achievements */}
        <CommunityPulse
          rank={userRank}
          recentBadgeIcon={recentBadges.length > 0 ? getBadgeEmoji(recentBadges[0]) : undefined}
          recentBadgeName={recentBadges[0]?.title}
          coachNotesCount={unreadNotes}
          leaderboardEnabled={isFeatureEnabled('leaderboard_enabled')}
        />

        {/* TRAINING TIP */}
        <View style={styles.trainingTipCard}>
          <Text style={styles.trainingTipIcon}>{'\uD83D\uDCA1'}</Text>
          <Text variant="caption" style={styles.trainingTipText}>
            {getTodayTrainingTip()}
          </Text>
        </View>

      </ScrollView>
    </AnimatedScreen>
    </SkeletonGate>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  // Error banner
  errorBanner: {
    backgroundColor: colors.errorSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 106, 0.25)',
    padding: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  // PR Celebration Banner — featured L2 card with a gold→crimson energy ribbon
  prBanner: {
    padding: spacing.md,
    paddingTop: spacing.md + 2,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
    overflow: 'hidden' as const,
  },
  prBannerRibbon: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  prBannerHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.sm,
  },
  prBannerTrophy: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  prBannerTitle: {
    flex: 1,
    fontSize: typography.labelSize,
    fontFamily: typography.fontSemiBold,
    color: colors.gold,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },
  prBannerDismiss: {
    fontSize: 16,
    color: colors.textMuted,
    padding: 4,
  },
  prBannerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
    gap: spacing.sm,
  },
  prBannerTypeBadge: {
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: 'rgba(232, 179, 57, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  prBannerTypeText: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    color: colors.gold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  prBannerExercise: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  prBannerValue: {
    fontSize: 14,
    fontFamily: typography.fontMonoBold,
    color: colors.gold,
  },
  // Guardrail styles — L2 card, hairline border, amber status accents
  guardrailBanner: {
    padding: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  guardrailTitle: {
    fontFamily: typography.fontSemiBold,
    color: colors.amber,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: typography.labelSize,
    marginBottom: spacing.sm,
  },
  guardrailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  guardrailSeverityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  guardrailDotHigh: {
    backgroundColor: colors.error,
  },
  guardrailDotMedium: {
    backgroundColor: colors.amber,
  },
  guardrailDotLow: {
    backgroundColor: colors.success,
  },
  guardrailMessage: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  guardrailActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  guardrailActionBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  // Training tip — quiet L2 card with hairline border
  trainingTipCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trainingTipIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  trainingTipText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
