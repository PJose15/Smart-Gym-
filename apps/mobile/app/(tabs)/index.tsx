import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated as RNAnimated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../src/lib/supabase';
import { getTodaysProgramDay } from '@nexera/utils';
import { getTodayExplanation, computeGuardrails, getCoachingInsight, buildMemberContext } from '@nexera/ai-assist';
import type { WorkoutRecord, CoachingInsight } from '@nexera/ai-assist';
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
import { Button, Text, Card } from '../../src/components';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { SkeletonGate, HomeScreenSkeleton } from '../../src/components/skeleton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import type { TodayExplanation, UserGoal, GuardrailInsight, ExperienceLevel, WorkoutSet, SessionIntent } from '@nexera/types';

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

const WEB = Platform.OS === 'web';
const ND = !WEB;

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

function PulsingGreeting({ name }: { name: string | null }) {
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const slideIn = useRef(new RNAnimated.Value(-40)).current;
  const fadeIn = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const entryAnim = RNAnimated.parallel([
      RNAnimated.spring(slideIn, {
        toValue: 0,
        tension: 40,
        friction: 7,
        useNativeDriver: ND,
      }),
      RNAnimated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        useNativeDriver: ND,
      }),
    ]);
    entryAnim.start();

    const loopAnim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 2000,
          useNativeDriver: ND,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: ND,
        }),
      ]),
    );
    loopAnim.start();

    return () => {
      entryAnim.stop();
      loopAnim.stop();
    };
  }, []);

  return (
    <RNAnimated.View style={{
      opacity: fadeIn,
      transform: [{ translateX: slideIn }, { scale: pulseAnim }],
      marginBottom: 20,
    }}>
      <Text variant="heading" style={styles.greeting}>
        {name ? `Hey, ${name.split(' ')[0]}` : 'Welcome back'}
      </Text>
    </RNAnimated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkout | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [explanation, setExplanation] = useState<TodayExplanation | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
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

  const loadHome = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      // Refresh feature flags if stale
      if (needsRefresh()) {
        await refreshFeatureFlags();
      }

      // Load profile name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (mountedRef.current) setUserName(profileData?.full_name || null);

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
      if (mountedRef.current) setGymId(gymId);

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

      // Load program assignment
      const { data: assignment } = await supabase
        .from('member_program_assignments')
        .select('program_id, assigned_at')
        .eq('profile_id', user.id)
        .eq('gym_id', gymId)
        .limit(1)
        .maybeSingle();

      if (!assignment) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      // Load program days
      const { data: days } = await supabase
        .from('program_days')
        .select('id, program_id, day_number, name')
        .eq('program_id', assignment.program_id)
        .order('day_number');

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
      const todayDay = days.find((d) => d.day_number === todayDayNumber) || days[0];

      // Set program day context (always-visible)
      if (mountedRef.current) setProgramDayContext({ dayNumber: todayDayNumber, totalDays: days.length });

      // Load exercises for today
      const { data: exercises } = await supabase
        .from('program_exercises')
        .select('id, exercise_name, default_sets, default_reps, machine_id')
        .eq('program_day_id', todayDay.id)
        .order('order_index');

      const todayExercises = exercises || [];

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
          const tomorrowDay = days.find((d) => d.day_number === tomorrowDayNumber) || days[0];

          const { count: nextExCount } = await supabase
            .from('program_exercises')
            .select('id', { count: 'exact', head: true })
            .eq('program_day_id', tomorrowDay.id);

          if (mountedRef.current) {
            setNextDayPreview({
              name: tomorrowDay.name,
              exerciseCount: nextExCount ?? 0,
            });
          }
        }
      } catch (err) {
        console.warn('[home] rest day check failed:', err instanceof Error ? err.message : err);
      }

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
          .map((e) => e.machine_id)
          .filter((id): id is string => id !== null);

        if (machineIds.length > 0) {
          const { data: machines } = await supabase
            .from('machines')
            .select('id, target_muscles')
            .in('id', machineIds);

          if (machines) {
            const allMuscles = new Set<string>();
            for (const m of machines) {
              for (const muscle of m.target_muscles) {
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
            exercises: todayExercises.map((e) => ({
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
                .select('id, primary_muscles')
                .in('id', machineIds);
              if (machineData) {
                for (const m of machineData) {
                  machineMap.set(m.id, m.primary_muscles ?? []);
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
                  primary_muscles: e.machine_id ? machineMap.get(e.machine_id) : undefined,
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
      loadHome();
      return () => {
        mountedRef.current = false;
      };
    }, [loadHome]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHome();
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

  return (
    <SkeletonGate loading={loading} skeleton={<HomeScreenSkeleton />}>
    <AnimatedScreen>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text variant="caption" style={styles.errorText}>{error}</Text>
          </View>
        )}

        <PulsingGreeting name={userName} />

        {/* Date + Program Day Context */}
        {programDayContext && (
          <Text variant="caption" color="textSecondary" style={styles.dayContext}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            {' — Day '}
            {programDayContext.dayNumber} of {programDayContext.totalDays}
          </Text>
        )}

        {/* Phase 2.6: Streak Badge */}
        {streak && streak.currentStreak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakBadgeFlame}>{'\uD83D\uDD25'}</Text>
            <Text style={styles.streakBadgeText}>
              {streak.currentStreak} week streak
            </Text>
            {!streak.currentWeekActive && (
              <Text style={styles.streakBadgeNudge}> — keep it going!</Text>
            )}
          </View>
        )}

        {/* Quick Stats Row */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>{totalWorkoutCount}</Text>
            <Text variant="caption" color="textSecondary" style={styles.quickStatLabel}>
              Total Workouts
            </Text>
          </View>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>{streak?.longestStreak ?? 0}</Text>
            <Text variant="caption" color="textSecondary" style={styles.quickStatLabel}>
              Best Streak
            </Text>
          </View>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatValue}>
              {weeklyVolume >= 1000
                ? `${(weeklyVolume / 1000).toFixed(1)}t`
                : `${weeklyVolume}kg`}
            </Text>
            <Text variant="caption" color="textSecondary" style={styles.quickStatLabel}>
              This Week Vol
            </Text>
          </View>
        </View>

        {/* Training Goal Banner */}
        {userGoal ? (
          <View style={styles.goalBanner}>
            <Text style={styles.goalIcon}>
              {userGoal === 'strength' ? '\uD83C\uDFCB\uFE0F' : userGoal === 'hypertrophy' ? '\uD83D\uDCAA' : userGoal === 'endurance' ? '\uD83C\uDFC3' : '\uD83C\uDFAF'}
            </Text>
            <Text style={styles.goalText}>
              Goal: {userGoal.charAt(0).toUpperCase() + userGoal.slice(1)}
            </Text>
          </View>
        ) : gymId ? (
          <TouchableOpacity
            style={styles.goalBannerCta}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.goalCtaText}>Set your training goal</Text>
            <Text style={styles.goalCtaArrow}>{'\u2192'}</Text>
          </TouchableOpacity>
        ) : null}

        {/* PR Celebration Banner */}
        {unseenPRs.length > 0 && (
          <AnimatedCard index={0} style={styles.prBanner}>
            <View style={styles.prBannerHeader}>
              <Text style={styles.prBannerTrophy}>{'\uD83C\uDFC6'}</Text>
              <Text style={styles.prBannerTitle}>
                New PR{unseenPRs.length > 1 ? 's' : ''}!
              </Text>
              <TouchableOpacity onPress={dismissPRs} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
            {unseenPRs.length > 3 && (
              <Text variant="caption" color="textSecondary" style={{ textAlign: 'center', marginTop: 4 }}>
                +{unseenPRs.length - 3} more
              </Text>
            )}
          </AnimatedCard>
        )}

        {/* Phase 2.6: Leaderboard CTA */}
        {userRank && (
          <TouchableOpacity
            style={styles.leaderboardCta}
            onPress={() => router.push('/leaderboard')}
            activeOpacity={0.7}
          >
            <Text style={styles.leaderboardCtaText}>
              You're #{userRank.rank} of {userRank.total} this week
            </Text>
            <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>
              View Leaderboard
            </Text>
          </TouchableOpacity>
        )}

        {/* Recent Badge Unlock */}
        {recentBadges.length > 0 && (
          <TouchableOpacity
            style={styles.recentBadgeCta}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.recentBadgeEmoji}>{recentBadges[0].icon_emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.recentBadgeTitle}>Badge Unlocked!</Text>
              <Text style={styles.recentBadgeName}>{recentBadges[0].name}</Text>
            </View>
            <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>View</Text>
          </TouchableOpacity>
        )}

        {/* Weekly Progress Summary */}
        {weeklyGoal > 0 && (
          <AnimatedCard index={0} style={styles.weeklyCard}>
            <Text variant="label" style={styles.weeklyTitle}>This Week</Text>
            <View style={styles.weeklyStatsRow}>
              <View style={styles.weeklyStat}>
                <Text style={styles.weeklyStatValue}>
                  {weeklyWorkouts}<Text style={styles.weeklyStatGoal}>/{weeklyGoal}</Text>
                </Text>
                <Text variant="caption" color="textSecondary">Sessions</Text>
              </View>
              <View style={styles.weeklyDivider} />
              <View style={styles.weeklyStat}>
                <Text style={styles.weeklyStatValue}>
                  {weeklyVolume >= 1000
                    ? `${(weeklyVolume / 1000).toFixed(1)}t`
                    : `${weeklyVolume}kg`}
                </Text>
                <Text variant="caption" color="textSecondary">Volume</Text>
              </View>
            </View>
            <View style={styles.weeklyBarBg}>
              <View
                style={[
                  styles.weeklyBarFill,
                  { width: `${Math.min((weeklyWorkouts / weeklyGoal) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text variant="caption" color="textSecondary" style={styles.weeklyBarLabel}>
              {weeklyWorkouts >= weeklyGoal
                ? 'Weekly goal reached!'
                : `${weeklyGoal - weeklyWorkouts} session${weeklyGoal - weeklyWorkouts !== 1 ? 's' : ''} to go`}
            </Text>
          </AnimatedCard>
        )}

        {/* Phase 2.5.2: Guardrails Nudge Banner */}
        {guardrails.length > 0 && (
          <AnimatedCard index={0} style={styles.guardrailBanner}>
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

        {/* Phase 2.5.3: Coach Notes Banner */}
        {unreadNotes > 0 && (
          <AnimatedCard index={0} style={styles.coachNotesBanner}>
            <View style={styles.coachNotesRow}>
              <View style={{ flex: 1 }}>
                <Text variant="label" style={styles.coachNotesTitle}>Coach Notes</Text>
                <Text variant="caption" color="textSecondary">
                  {unreadNotes} note{unreadNotes !== 1 ? 's' : ''} from your trainer
                </Text>
              </View>
              <Button
                title="View"
                onPress={() => router.push('/coach-notes')}
                style={styles.coachNotesBtn}
              />
            </View>
          </AnimatedCard>
        )}

        {activeWorkout && (
          <AnimatedCard index={0} style={styles.activeCard}>
            <Text variant="label" style={styles.activeLabel}>Workout in Progress</Text>
            <Text variant="caption" color="textSecondary" style={styles.activeStarted}>
              Started {new Date(activeWorkout.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Button
              title="Continue Workout"
              onPress={() => router.push(`/workout/${activeWorkout.id}?intent=${sessionIntent}`)}
              style={styles.continueButton}
            />
          </AnimatedCard>
        )}

        {/* Smart Rest Day: show rest card when today's workout is done */}
        {todayWorkout && todayDone && !activeWorkout ? (
          <AnimatedCard index={0} style={styles.restDayCard}>
            <Text style={styles.restDayEmoji}>{'\u2705'}</Text>
            <Text variant="label" style={styles.restDayTitle}>
              All done for today!
            </Text>
            <Text variant="body" color="textSecondary" style={styles.restDaySubtitle}>
              Great work completing {todayWorkout.dayName}. Time to recover.
            </Text>

            {nextDayPreview && (
              <View style={styles.restDayNextPreview}>
                <Text variant="caption" style={styles.restDayNextLabel}>NEXT UP</Text>
                <Text variant="body" style={styles.restDayNextName}>
                  {nextDayPreview.name}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {nextDayPreview.exerciseCount} exercise{nextDayPreview.exerciseCount !== 1 ? 's' : ''}
                </Text>
              </View>
            )}

            <View style={styles.restDayTipBox}>
              <Text style={styles.restDayTipIcon}>{'\uD83D\uDCA1'}</Text>
              <Text variant="caption" style={styles.restDayTipText}>
                {getTodayTip()}
              </Text>
            </View>

            {/* Still show coaching insight on rest state */}
            {coachingInsight && (
              <View style={styles.restDayCoaching}>
                <Text variant="label" style={styles.coachingTitle}>
                  {coachingInsight.source === 'ai' ? 'AI Coach' : 'Coach Tip'}
                </Text>
                <Text variant="body" color="textSecondary" style={styles.coachingMessage}>
                  {coachingInsight.message}
                </Text>
              </View>
            )}
          </AnimatedCard>
        ) : todayWorkout ? (
          <View style={styles.todaySection}>
            <Text variant="label" style={styles.sectionTitle}>
              Today: {todayWorkout.dayName}
            </Text>
            {todayWorkout.exercises.length > 0 && (
              <Text variant="caption" color="textSecondary" style={styles.durationEstimate}>
                ~{(() => {
                  const totalSets = todayWorkout.exercises.reduce((sum, e) => sum + e.default_sets, 0);
                  const mins = Math.round(totalSets * 2.5);
                  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins} min`;
                })()} estimated
              </Text>
            )}

            {todayWorkout.exercises.map((exercise, i) => (
              <AnimatedCard key={exercise.id} index={i + 1} style={styles.exerciseCard}>
                <Text variant="body" style={styles.exerciseName}>
                  {exercise.exercise_name}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {exercise.default_sets} sets x {exercise.default_reps} reps
                </Text>
              </AnimatedCard>
            ))}

            {explanation && (
              <AnimatedCard index={todayWorkout.exercises.length + 1} style={styles.explanationCard}>
                <Text variant="label" style={styles.explanationTitle}>
                  Why This Today?
                </Text>
                <Text variant="body" color="textSecondary" style={styles.explanationText}>
                  {explanation.reasoning}
                </Text>
                {explanation.focus_muscles.length > 0 && (
                  <View style={styles.muscleRow}>
                    {explanation.focus_muscles.map((muscle) => (
                      <View key={muscle} style={styles.muscleTag}>
                        <Text variant="caption" style={styles.muscleTagText}>{muscle}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {explanation.last_workout_gap_text && (
                  <Text variant="caption" color="textSecondary" style={styles.gapText}>
                    {explanation.last_workout_gap_text}
                  </Text>
                )}
              </AnimatedCard>
            )}

            {/* Phase 3: AI Coaching Insight */}
            {coachingInsight && (
              <AnimatedCard index={(todayWorkout?.exercises.length ?? 0) + 2} style={styles.coachingCard}>
                <Text variant="label" style={styles.coachingTitle}>
                  {coachingInsight.source === 'ai' ? 'AI Coach' : 'Coach Tip'}
                </Text>
                <Text variant="body" color="textSecondary" style={styles.coachingMessage}>
                  {coachingInsight.message}
                </Text>
                {coachingInsight.action_items.length > 0 && (
                  <View style={styles.coachingActions}>
                    {coachingInsight.action_items.map((item, i) => (
                      <View key={i} style={styles.coachingActionRow}>
                        <View style={styles.coachingBullet} />
                        <Text variant="caption" style={styles.coachingActionText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </AnimatedCard>
            )}

            {/* Tip of the Day */}
            <View style={styles.trainingTipCard}>
              <Text style={styles.trainingTipIcon}>{'\uD83D\uDCA1'}</Text>
              <Text variant="caption" style={styles.trainingTipText}>
                {getTodayTrainingTip()}
              </Text>
            </View>

            {!activeWorkout && (
              <Button
                title="Start Workout"
                onPress={() => router.push(`/workout/start?intent=${sessionIntent}`)}
                style={styles.startButton}
              />
            )}
          </View>
        ) : (
          <AnimatedCard index={0} style={styles.emptyCard}>
            <Text variant="body" color="textSecondary" style={styles.emptyText}>
              No program assigned yet. Ask your trainer to set one up!
            </Text>
          </AnimatedCard>
        )}
      </ScrollView>
    </AnimatedScreen>
    </SkeletonGate>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.sm,
  },
  greeting: {
    marginBottom: 0,
  },
  dayContext: {
    marginBottom: spacing.md,
    fontSize: 13,
  },
  quickStatsRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: 11,
    textAlign: 'center' as const,
  },
  goalBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start' as const,
    marginBottom: spacing.md,
    gap: 6,
  },
  goalIcon: {
    fontSize: 14,
  },
  goalText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#4338ca',
  },
  goalBannerCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#f5f3ff',
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start' as const,
    marginBottom: spacing.md,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  goalCtaText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6366f1',
  },
  goalCtaArrow: {
    fontSize: 14,
    color: '#6366f1',
  },
  durationEstimate: {
    marginTop: -2,
    marginBottom: spacing.xs,
    fontSize: 13,
  },
  trainingTipCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: spacing.sm,
    gap: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  trainingTipIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  trainingTipText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  errorBanner: {
    backgroundColor: '#fce4e6',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  activeCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  activeLabel: {
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  activeStarted: {
    marginBottom: spacing.sm,
  },
  continueButton: {
    marginTop: spacing.xs,
  },
  todaySection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  exerciseCard: {
    padding: spacing.md,
  },
  exerciseName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  explanationCard: {
    padding: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  explanationTitle: {
    fontWeight: '700',
    marginBottom: spacing.xs,
    color: colors.primary,
  },
  explanationText: {
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  muscleTag: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  muscleTagText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  gapText: {
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  startButton: {
    marginTop: spacing.md,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  // Smart Rest Day
  restDayCard: {
    padding: spacing.lg,
    alignItems: 'center' as const,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  restDayEmoji: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  restDayTitle: {
    fontWeight: '700' as const,
    fontSize: 18,
    color: '#166534',
    marginBottom: spacing.xs,
  },
  restDaySubtitle: {
    textAlign: 'center' as const,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  restDayNextPreview: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: spacing.md,
    width: '100%' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  restDayNextLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  restDayNextName: {
    fontWeight: '600' as const,
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  restDayTipBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    padding: spacing.sm,
    width: '100%' as const,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  restDayTipIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  restDayTipText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  restDayCoaching: {
    width: '100%' as const,
    backgroundColor: '#f0f4ff',
    borderRadius: 10,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  // PR Celebration Banner
  prBanner: {
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: '#fffbeb',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
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
    color: '#92400e',
  },
  prBannerDismiss: {
    fontSize: 16,
    color: '#92400e',
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
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  prBannerTypeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#92400e',
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
    color: '#92400e',
  },
  // Weekly Progress Summary
  weeklyCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: '#f0faf7',
    borderLeftWidth: 4,
    borderLeftColor: '#2a9d8f',
  },
  weeklyTitle: {
    fontWeight: '700',
    color: '#2a9d8f',
    marginBottom: spacing.sm,
    fontSize: 13,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  weeklyStatsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.sm,
  },
  weeklyStat: {
    flex: 1,
    alignItems: 'center' as const,
  },
  weeklyStatValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1a1a2e',
  },
  weeklyStatGoal: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: '#999',
  },
  weeklyDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e0e0e0',
  },
  weeklyBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden' as const,
    marginBottom: spacing.xs,
  },
  weeklyBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2a9d8f',
  },
  weeklyBarLabel: {
    textAlign: 'center' as const,
    fontSize: 12,
  },
  // Guardrail styles
  guardrailBanner: {
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: '#fff8e1',
    borderLeftWidth: 4,
    borderLeftColor: '#ffa726',
  },
  guardrailTitle: {
    fontWeight: '700',
    color: '#e65100',
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
    backgroundColor: '#ffa726',
  },
  guardrailDotLow: {
    backgroundColor: '#66bb6a',
  },
  guardrailMessage: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
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
  // Coach Notes styles
  coachNotesBanner: {
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  coachNotesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coachNotesTitle: {
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  coachNotesBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  // Streak badge styles
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: '#fff3e0',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  streakBadgeFlame: {
    fontSize: 16,
    marginRight: 4,
  },
  streakBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6b35',
  },
  streakBadgeNudge: {
    fontSize: 13,
    color: '#ff6b35',
    fontStyle: 'italic',
  },
  // Recent Badge CTA
  recentBadgeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#7b2ff7' + '30',
    gap: spacing.sm,
  },
  recentBadgeEmoji: {
    fontSize: 28,
  },
  recentBadgeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7b2ff7',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  recentBadgeName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  // Leaderboard CTA
  leaderboardCta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#edf2ff',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  leaderboardCtaText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  // Phase 3: Coaching Card
  coachingCard: {
    backgroundColor: '#f0f4ff',
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#d0dafe',
  },
  coachingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  coachingMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  coachingActions: {
    marginTop: spacing.sm,
    gap: 6,
  },
  coachingActionRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
  },
  coachingBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  coachingActionText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});
