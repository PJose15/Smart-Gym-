import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated as RNAnimated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/lib/supabase';
import { getWeightUnit } from '../../src/lib/weightUnit';
import { getPointsSummary } from '../../src/lib/pointsService';
import { getStreak } from '../../src/lib/streakService';
import type { StreakResult } from '../../src/lib/streakService';
import { getBadges } from '../../src/lib/badgeService';
import { isFeatureEnabled, needsRefresh, refreshFeatureFlags } from '../../src/lib/featureFlags';
import { fetchMemberLevel, fetchDNAResult, fetchMuscleMap } from '../../src/lib/memberData';
import type { DNACacheResult, MuscleMapCacheResult } from '../../src/lib/memberData';
import type { LevelProgress } from '@nexera/ai-assist';
import { Button, Text, Card } from '../../src/components';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { SkeletonGate, ProfileScreenSkeleton } from '../../src/components/skeleton';
import { ProfileHeader } from '../../src/components/profile/ProfileHeader';
import { ProfileTabs } from '../../src/components/profile/ProfileTabs';
import type { ProfileTabKey } from '../../src/components/profile/ProfileTabs';
import { OverviewTab } from '../../src/components/profile/OverviewTab';
import { AchievementsTab } from '../../src/components/profile/AchievementsTab';
import { DNATab } from '../../src/components/profile/DNATab';
import { BodyMapTab } from '../../src/components/profile/BodyMapTab';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import type { UserGoal, WeightUnit, BadgeWithStatus } from '@nexera/types';

// ─── Types ──────────────────────────────────────────────

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface LifetimeStats {
  totalWorkouts: number;
  totalVolumeKg: number;
  totalSets: number;
  totalTimeMinutes: number;
}

interface FavoriteMachine {
  name: string;
  count: number;
  slug: string;
}

// ─── Breathing Animation Card ───────────────────────────

const ND = Platform.OS !== 'web';

function BreathingCard({ children }: { children: React.ReactNode }) {
  const scale = useRef(new RNAnimated.Value(0.9)).current;
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const breathe = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(scale, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: ND,
      }),
      RNAnimated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: ND,
      }),
    ]).start();

    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(breathe, {
          toValue: 1.02,
          duration: 1800,
          useNativeDriver: ND,
        }),
        RNAnimated.timing(breathe, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: ND,
        }),
      ]),
    ).start();
  }, []);

  const combinedScale = RNAnimated.multiply(scale, breathe);

  return (
    <RNAnimated.View style={{
      opacity,
      transform: [{ scale: combinedScale }],
      width: '100%',
    }}>
      {children}
    </RNAnimated.View>
  );
}

// ─── Screen ─────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [error, setError] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [gymId, setGymId] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakResult | null>(null);
  const [badges, setBadges] = useState<BadgeWithStatus[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('overview');

  // Enrichment state
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [favoriteMachines, setFavoriteMachines] = useState<FavoriteMachine[]>([]);
  const [avgWorkoutsPerWeek, setAvgWorkoutsPerWeek] = useState<number | null>(null);
  const [trainingGoal, setTrainingGoal] = useState<UserGoal | null>(null);

  // New profile data
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null);
  const [dnaResult, setDnaResult] = useState<DNACacheResult | null>(null);
  const [muscleMapResult, setMuscleMapResult] = useState<MuscleMapCacheResult | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Refresh feature flags if stale
      if (needsRefresh()) {
        await refreshFeatureFlags();
      }

      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      setProfile({
        id: user.id,
        full_name: profileData?.full_name || null,
        email: user.email || '',
      });

      const savedUnit = await getWeightUnit();
      setWeightUnit(savedUnit);

      // Load gym membership
      const { data: memberData } = await supabase
        .from('gym_members')
        .select('gym_id')
        .eq('profile_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberData?.gym_id) {
        setGymId(memberData.gym_id);

        // Load points
        try {
          const summary = await getPointsSummary(user.id, memberData.gym_id);
          setTotalPoints(summary.total);
        } catch {
          // Non-critical
        }

        // Load streak data
        if (isFeatureEnabled('streaks_enabled')) {
          try {
            const streakData = await getStreak(user.id, memberData.gym_id);
            setStreak(streakData);
          } catch {
            // Non-critical
          }
        }

        // Load badges
        if (isFeatureEnabled('badges_enabled')) {
          try {
            const badgeData = await getBadges(user.id, memberData.gym_id);
            setBadges(badgeData);
          } catch {
            // Non-critical
          }
        }

        // Load training goal
        try {
          const { data: tpData } = await supabase
            .from('user_training_profiles')
            .select('goal')
            .eq('profile_id', user.id)
            .eq('gym_id', memberData.gym_id)
            .maybeSingle();
          setTrainingGoal((tpData?.goal as UserGoal | undefined) ?? null);
        } catch {
          // Non-critical
        }

        // Load enrichment data
        await loadEnrichmentData(user.id, memberData.gym_id);

        // Load new profile data (level, DNA, muscle map)
        try {
          const [level, dna, muscle] = await Promise.all([
            fetchMemberLevel(user.id),
            fetchDNAResult(user.id),
            fetchMuscleMap(user.id),
          ]);
          setLevelProgress(level);
          setDnaResult(dna);
          setMuscleMapResult(muscle);
        } catch {
          // Non-critical — these are enhancement data
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEnrichmentData = async (userId: string, currentGymId: string) => {
    try {
      const [workoutsResult, exercisesResult, memberResult] = await Promise.all([
        supabase
          .from('workouts')
          .select('id, started_at, finished_at')
          .eq('profile_id', userId)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(500),

        supabase
          .from('workout_exercises')
          .select(`
            exercise_name,
            machine_id,
            machines(name, qr_slug),
            sets(weight_kg, reps)
          `)
          .eq('workouts.profile_id', userId)
          .limit(500),

        supabase
          .from('gym_members')
          .select('created_at')
          .eq('profile_id', userId)
          .eq('gym_id', currentGymId)
          .limit(1)
          .maybeSingle(),
      ]);

      // Member since
      if (memberResult.data?.created_at) {
        setMemberSince(memberResult.data.created_at);
      }

      // Lifetime stats from workouts
      const workouts = workoutsResult.data ?? [];
      let totalTimeMinutes = 0;
      for (const w of workouts) {
        if (w.started_at && w.finished_at) {
          const mins = (new Date(w.finished_at).getTime() - new Date(w.started_at).getTime()) / 60000;
          if (mins > 0 && mins < 300) totalTimeMinutes += mins;
        }
      }

      // Calculate volume and sets from exercises, plus machine frequency
      const exercises = (exercisesResult.data ?? []) as any[];
      let totalVolumeKg = 0;
      let totalSets = 0;
      const machineFreq = new Map<string, { name: string; count: number; slug: string }>();

      for (const ex of exercises) {
        const sets = ex.sets ?? [];
        for (const s of sets) {
          totalSets++;
          totalVolumeKg += (s.weight_kg ?? 0) * (s.reps ?? 0);
        }
        if (ex.machine_id && ex.machines?.name) {
          const existing = machineFreq.get(ex.machine_id);
          if (existing) {
            existing.count++;
          } else {
            machineFreq.set(ex.machine_id, {
              name: ex.machines.name,
              count: 1,
              slug: ex.machines.qr_slug ?? ex.machine_id,
            });
          }
        }
      }

      setLifetimeStats({
        totalWorkouts: workouts.length,
        totalVolumeKg: Math.round(totalVolumeKg),
        totalSets,
        totalTimeMinutes: Math.round(totalTimeMinutes),
      });

      // Top 3 favorite machines
      const sorted = Array.from(machineFreq.values()).sort((a, b) => b.count - a.count);
      setFavoriteMachines(sorted.slice(0, 3));

      // Average workouts per week
      if (workouts.length >= 2) {
        const oldest = new Date(workouts[workouts.length - 1].started_at);
        const newest = new Date(workouts[0].started_at);
        const weeks = Math.max(1, (newest.getTime() - oldest.getTime()) / (7 * 24 * 60 * 60 * 1000));
        setAvgWorkoutsPerWeek(Math.round((workouts.length / weeks) * 10) / 10);
      } else if (workouts.length === 1) {
        setAvgWorkoutsPerWeek(workouts.length);
      }
    } catch (err) {
      console.warn('[profile] enrichment load failed:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  if (loading) {
    return <SkeletonGate loading={true} skeleton={<ProfileScreenSkeleton />}><View /></SkeletonGate>;
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <BreathingCard>
          <Card style={styles.signInCard}>
            <Text variant="heading" style={styles.signInTitle}>Sign In to Nexera</Text>
            <Text variant="body" color="textSecondary" style={styles.signInSubtitle}>
              Sign in to track your workouts, view your progress, and manage your profile.
            </Text>
            <Button
              title="Sign In / Sign Up"
              onPress={() => router.push('/auth')}
              style={styles.fullWidth}
            />
          </Card>
        </BreathingCard>
      </View>
    );
  }

  return (
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

        <ProfileHeader
          fullName={profile.full_name}
          email={profile.email}
          memberSince={memberSince}
          levelProgress={levelProgress}
          streak={streak?.currentStreak ?? 0}
          totalSessions={lifetimeStats?.totalWorkouts ?? 0}
        />

        <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'overview' && (
          <OverviewTab
            lifetimeStats={lifetimeStats}
            avgWorkoutsPerWeek={avgWorkoutsPerWeek}
            favoriteMachines={favoriteMachines}
            trainingGoal={trainingGoal}
            weightUnit={weightUnit}
            totalPoints={totalPoints}
          />
        )}

        {activeTab === 'achievements' && (
          <AchievementsTab
            badges={badges}
            streak={streak}
            totalPoints={totalPoints}
          />
        )}

        {activeTab === 'dna' && (
          <DNATab dna={dnaResult} />
        )}

        {activeTab === 'bodymap' && (
          <BodyMapTab muscleMap={muscleMapResult} />
        )}
      </ScrollView>
    </AnimatedScreen>
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
  signInCard: {
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  signInTitle: {
    marginBottom: spacing.xs,
  },
  signInSubtitle: {
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  fullWidth: {
    width: '100%',
  },
  errorBanner: {
    backgroundColor: colors.errorSubtle,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
});
