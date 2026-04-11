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
import type { WorkoutRecord, CoachingInsight, LevelProgress } from '@nexera/ai-assist';
import { fetchCoachingInsight } from '../../src/lib/aiService';
import { isFeatureEnabled, needsRefresh, refreshFeatureFlags } from '../../src/lib/featureFlags';
import { trackEvent } from '../../src/lib/events';
import { getStreak } from '../../src/lib/streakService';
import type { StreakResult } from '../../src/lib/streakService';
import { getRecentUnlocks } from '../../src/lib/badgeService';
import { getUserRank } from '../../src/lib/leaderboardService';
import type { BadgeWithStatus } from '@nexera/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PRDetection } from '@nexera/types';
import { deduper } from '../../src/lib/requestDeduper';
import { Button, Text } from '../../src/components';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { SkeletonGate, HomeScreenSkeleton } from '../../src/components/skeleton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import type { TodayExplanation, UserGoal, GuardrailInsight, ExperienceLevel, WorkoutSet, SessionIntent } from '@nexera/types';
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
  started_at: string;
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
  const [weeklyVolume, setWeeklyVolume] = useState(0);

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

      // Check for active workout
      const { data: activeData } = await supabase
        .from('workouts')
        .select('id, started_at')
        .eq('profile_id', user.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mountedRef.current) setActiveWorkout(activeData || null);

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
          .from('workouts')
          .select('started_at')
          .eq('profile_id', user.id)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastSession?.started_at && mountedRef.current) {
          setLastSessionDate(lastSession.started_at);
        }
      } catch (err) {
        console.warn('[home] last session load failed:', err instanceof Error ? err.message : err);
      }

      // Load total workout count (always-visible quick stat)
      try {
        const { count: totalCount } = await supabase
          .from('workouts')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', user.id)
          .eq('status', 'completed');
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

      // Load recent badge unlocks
      if (isFeatureEnabled('badges_enabled')) {
        try {
          const recent = await getRecentUnlocks(user.id, gymId);
          if (mountedRef.current) setRecentBadges(recent);
        } catch (err) {
          console.warn('[home] badges load failed:', err instanceof Error ? err.message : err);
        }
      }

      // Load active program from ai_programs via member record
      const { data: memberRecord } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .eq('gym_id', gymId)
        .maybeSingle();

      if (!memberRecord) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      const { data: activeProgram } = await supabase
        .from('ai_programs')
        .select('id, program_data, sessions_per_week, day_number, created_at')
        .eq('member_id', memberRecord.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeProgram?.program_data) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      // Parse days from program_data JSON
      interface ProgramDay { day_number?: number; name?: string; exercises?: Array<{ exercise_name?: string; default_sets?: number; default_reps?: number; machine_id?: string | null }> }
      const programData = activeProgram.program_data as { days?: ProgramDay[] } | null;
      const days = (programData?.days ?? []).map((d, idx) => ({
          id: `day-${idx}`,
          program_id: activeProgram.id,
          day_number: d.day_number ?? idx + 1,
          name: d.name ?? `Day ${idx + 1}`,
          exercises: d.exercises ?? [],
        }));

      // Use created_at as assignment date for day cycling
      const assignment = { assigned_at: activeProgram.created_at };

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
        monday.setHours(0, 0, 0, 0);
        const mondayISO = monday.toISOString();

        const { data: weekWorkouts } = await supabase
          .from('workouts')
          .select('id, started_at')
          .eq('profile_id', user.id)
          .eq('status', 'completed')
          .gte('started_at', mondayISO)
          .limit(50);

        const wkList = weekWorkouts ?? [];
        if (mountedRef.current) setWeeklyWorkouts(wkList.length);

        if (wkList.length > 0) {
          const wkIds = wkList.map((w) => w.id);
          const { data: wkExercises } = await supabase
            .from('workout_exercises')
            .select('workout_id, sets(*)')
            .in('workout_id', wkIds);

          let totalVol = 0;
          for (const ex of wkExercises ?? []) {
            for (const s of (ex.sets ?? []) as Array<{ weight_kg: number; reps: number }>) {
              totalVol += (Number(s.weight_kg) || 0) * (Number(s.reps) || 0);
            }
          }
          if (mountedRef.current) setWeeklyVolume(Math.round(totalVol));
        } else {
          if (mountedRef.current) setWeeklyVolume(0);
        }
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
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: completedToday } = await supabase
          .from('workouts')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', user.id)
          .eq('status', 'completed')
          .gte('started_at', todayStart.toISOString());

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

        // Build muscle gap map: for each exercise's target muscles,
        // find when that muscle was last worked
        const muscleGaps: Record<string, number> = {};
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

            // For each muscle, find the most recent workout that used it
            for (const muscle of allMuscles) {
              const { data: lastWorkout } = await supabase
                .from('workout_exercises')
                .select('workout_id, workouts!inner(started_at)')
                .eq('workouts.profile_id', user.id)
                .eq('workouts.status', 'completed')
                .order('workouts(started_at)', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (lastWorkout) {
                const workoutRow = lastWorkout.workouts as unknown as { started_at: string };
                const daysAgo = Math.floor(
                  (Date.now() - new Date(workoutRow.started_at).getTime()) / (1000 * 60 * 60 * 24),
                );
                if (daysAgo > 0) {
                  muscleGaps[muscle] = daysAgo;
                }
              }
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
          // Fetch recent 14 days of workouts
          const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentWorkouts } = await supabase
            .from('workouts')
            .select('id, started_at, finished_at, status')
            .eq('profile_id', user.id)
            .eq('status', 'completed')
            .gte('started_at', twoWeeksAgo)
            .order('started_at', { ascending: false });

          if (recentWorkouts && recentWorkouts.length > 0) {
            // Fetch exercises + sets for each workout
            const workoutIds = recentWorkouts.map((w: { id: string }) => w.id);
            const { data: recentExercises } = await supabase
              .from('workout_exercises')
              .select('id, workout_id, exercise_name, machine_id, sets(*)')
              .in('workout_id', workoutIds);

            // Get machine muscle data
            const machineIds = [...new Set((recentExercises ?? [])
              .map((e: { machine_id: string | null }) => e.machine_id)
              .filter(Boolean))];

            const machineMap = new Map<string, string[]>();
            if (machineIds.length > 0) {
              const { data: machineData } = await supabase
                .from('machines')
                .select('id, muscle_groups')
                .in('id', machineIds);
              if (machineData) {
                for (const m of machineData) {
                  machineMap.set(m.id, m.muscle_groups ?? []);
                }
              }
            }

            const workoutRecords: WorkoutRecord[] = recentWorkouts.map((w: { id: string; started_at: string; finished_at: string | null }) => ({
              id: w.id,
              started_at: w.started_at,
              finished_at: w.finished_at,
              exercises: (recentExercises ?? [])
                .filter((e: { workout_id: string }) => e.workout_id === w.id)
                .map((e: { exercise_name: string; machine_id: string | null; sets: WorkoutSet[] }) => ({
                  exercise_name: e.exercise_name,
                  machine_id: e.machine_id,
                  muscle_groups: e.machine_id ? machineMap.get(e.machine_id) : undefined,
                  sets: (e.sets ?? []) as WorkoutSet[],
                })),
            }));

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
          const { data: recentWk } = await supabase
            .from('workouts')
            .select('id, started_at, finished_at')
            .eq('profile_id', user.id)
            .eq('status', 'completed')
            .gte('started_at', thirtyDaysAgo)
            .order('started_at', { ascending: false });

          const workoutIds30d = (recentWk ?? []).map((w: { id: string }) => w.id);
          let coachingWorkouts: Array<{
            id: string; started_at: string; finished_at: string | null;
            exercises: Array<{ exercise_name: string; sets: Array<{ weight_kg: number; reps: number }> }>;
          }> = [];

          if (workoutIds30d.length > 0) {
            const { data: wxData } = await supabase
              .from('workout_exercises')
              .select('workout_id, exercise_name, sets(*)')
              .in('workout_id', workoutIds30d);

            coachingWorkouts = (recentWk ?? []).map((w: { id: string; started_at: string; finished_at: string | null }) => ({
              id: w.id,
              started_at: w.started_at,
              finished_at: w.finished_at,
              exercises: (wxData ?? [])
                .filter((e: { workout_id: string }) => e.workout_id === w.id)
                .map((e: { exercise_name: string; sets: Array<{ weight_kg: number; reps: number }> }) => ({
                  exercise_name: e.exercise_name,
                  sets: (e.sets ?? []) as Array<{ weight_kg: number; reps: number }>,
                })),
            }));
          }

          // Get all completed workout dates for streak calc
          const { data: allDates } = await supabase
            .from('workouts')
            .select('started_at')
            .eq('profile_id', user.id)
            .eq('status', 'completed')
            .limit(1000);

          // Get feedback trends
          const { data: feedbackData } = await supabase
            .from('set_feedback')
            .select('rating')
            .eq('profile_id', user.id)
            .gte('created_at', thirtyDaysAgo)
            .limit(1000);

          const feedbackTrends = {
            discomfort_count: 0,
            unstable_count: 0,
            ok_count: 0,
          };
          for (const f of feedbackData ?? []) {
            if (f.rating === 'discomfort') feedbackTrends.discomfort_count++;
            else if (f.rating === 'unstable') feedbackTrends.unstable_count++;
            else feedbackTrends.ok_count++;
          }

          const coachingInput = {
            memberName: profileData?.full_name || 'there',
            workouts: coachingWorkouts,
            prs: [],
            feedbackTrends,
            completedWorkoutDates: (allDates ?? []).map((d: { started_at: string }) => d.started_at),
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
    weeklyWorkouts,
    score: memberScore,
    level: levelData?.current.level ?? 1,
    levelName: levelData?.current.name,
  }), [userName, streak, todayDone, todayWorkout, programDayContext, lastSessionDate, unseenPRs, weeklyVolume, weeklyWorkouts, memberScore, levelData]);

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
          activeWorkoutId={activeWorkout?.id}
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
          recentBadgeIcon={recentBadges[0]?.icon_emoji}
          recentBadgeName={recentBadges[0]?.name}
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
    padding: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  // PR Celebration Banner
  prBanner: {
    padding: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
    backgroundColor: colors.goldSubtle,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
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
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.goldDark,
  },
  prBannerDismiss: {
    fontSize: 16,
    color: colors.goldDark,
    opacity: 0.6,
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  prBannerTypeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.goldDark,
    textTransform: 'uppercase' as const,
  },
  prBannerExercise: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
  },
  prBannerValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.goldDark,
  },
  // Guardrail styles
  guardrailBanner: {
    padding: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
    backgroundColor: colors.amberSubtle,
    borderLeftWidth: 4,
    borderLeftColor: colors.amber,
  },
  guardrailTitle: {
    fontWeight: '700',
    color: colors.amber,
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
  // Training tip
  trainingTipCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: colors.goldSubtle,
    borderRadius: 12,
    padding: spacing.sm,
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.goldSubtle,
  },
  trainingTipIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  trainingTipText: {
    flex: 1,
    fontSize: 13,
    color: colors.goldDark,
    lineHeight: 18,
  },
});
