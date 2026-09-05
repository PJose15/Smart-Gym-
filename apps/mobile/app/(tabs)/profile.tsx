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
import { deduper } from '../../src/lib/requestDeduper';
import { getWeightUnit } from '../../src/lib/weightUnit';
import { getPointsSummary } from '../../src/lib/pointsService';
import { getStreak } from '../../src/lib/streakService';
import type { StreakResult } from '../../src/lib/streakService';
import { getBadges } from '../../src/lib/badgeService';
import type { BadgeWithStatus } from '../../src/lib/badgeService';
import { isFeatureEnabled, needsRefresh, refreshFeatureFlags } from '../../src/lib/featureFlags';
import { fetchMemberLevel, fetchDNAResult, fetchMuscleMap, getMemberId } from '../../src/lib/memberData';
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
import { typography } from '../../src/theme/typography';
import type { UserGoal, WeightUnit } from '@nexera/types';

// ─── Types ──────────────────────────────────────────────

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
}

interface LifetimeStats {
  totalWorkouts: number;
  totalVolumeKg: number;
  totalVolumeLbs: number;
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
  const [streakDays, setStreakDays] = useState<number | undefined>(undefined);
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
        .select('id, full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      setProfile({
        id: user.id,
        full_name: profileData?.full_name || null,
        avatar_url: profileData?.avatar_url || null,
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

        // Resolve members.id — achievements are keyed by member id, not
        // the auth user id. Also grab the day-streak for badge progress.
        let memberId: string | null = null;
        try {
          const { data: memberRow } = await supabase
            .from('members')
            .select('id, best_streak')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
          memberId = memberRow?.id ?? null;
          setStreakDays(
            typeof memberRow?.best_streak === 'number' ? memberRow.best_streak : undefined,
          );
        } catch {
          // Non-critical
        }

        // Load badges (read-only view over member_achievements)
        if (memberId && isFeatureEnabled('badges_enabled')) {
          try {
            const badgeData = await getBadges(memberId, memberData.gym_id);
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
      // Session data lives in workout_sessions keyed by member_id (members.id),
      // not by the auth profile id — resolve the mapping first.
      const memberId = await getMemberId(userId);

      const [sessionsResult, memberResult] = await Promise.all([
        memberId
          ? supabase
              .from('workout_sessions')
              .select('id, session_date, sets_count, total_volume_lbs, machine_id, created_at, completed_at, machines(name, qr_slug)')
              .eq('member_id', memberId)
              .order('session_date', { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [] }),

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

      // Lifetime stats from workout_sessions (one row per machine session)
      interface SessionRow {
        id: string;
        session_date: string | null;
        sets_count: number | null;
        total_volume_lbs: number | null;
        machine_id: string | null;
        created_at: string | null;
        completed_at: string | null;
        machines?: { name: string; qr_slug?: string } | null;
      }
      const sessions = (sessionsResult.data ?? []) as unknown as SessionRow[];

      const LBS_TO_KG = 0.45359237;
      let totalVolumeLbs = 0;
      let totalSets = 0;
      let totalTimeMinutes = 0;
      const machineFreq = new Map<string, { name: string; count: number; slug: string }>();
      const trainedDates = new Set<string>();

      for (const s of sessions) {
        totalSets += s.sets_count ?? 0;
        totalVolumeLbs += Number(s.total_volume_lbs) || 0;
        if (s.session_date) trainedDates.add(s.session_date);
        if (s.created_at && s.completed_at) {
          const mins = (new Date(s.completed_at).getTime() - new Date(s.created_at).getTime()) / 60000;
          if (mins > 0 && mins < 300) totalTimeMinutes += mins;
        }
        if (s.machine_id && s.machines?.name) {
          const existing = machineFreq.get(s.machine_id);
          if (existing) {
            existing.count++;
          } else {
            machineFreq.set(s.machine_id, {
              name: s.machines.name,
              count: 1,
              slug: s.machines.qr_slug ?? s.machine_id,
            });
          }
        }
      }

      setLifetimeStats({
        totalWorkouts: sessions.length,
        totalVolumeKg: Math.round(totalVolumeLbs * LBS_TO_KG),
        totalVolumeLbs: Math.round(totalVolumeLbs),
        totalSets,
        totalTimeMinutes: Math.round(totalTimeMinutes),
      });

      // Top 3 favorite machines
      const sorted = Array.from(machineFreq.values()).sort((a, b) => b.count - a.count);
      setFavoriteMachines(sorted.slice(0, 3));

      // Average training days per week from distinct session dates
      const dates = Array.from(trainedDates).sort();
      if (dates.length >= 2) {
        const oldest = new Date(dates[0]);
        const newest = new Date(dates[dates.length - 1]);
        const weeks = Math.max(1, (newest.getTime() - oldest.getTime()) / (7 * 24 * 60 * 60 * 1000));
        setAvgWorkoutsPerWeek(Math.round((dates.length / weeks) * 10) / 10);
      } else if (dates.length === 1) {
        setAvgWorkoutsPerWeek(1);
      }
    } catch (err) {
      console.warn('[profile] enrichment load failed:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      deduper.dedupe('profile:load', loadProfile).catch(() => {});
    }, [loadProfile])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    deduper.clear('profile:load');
    await deduper.dedupe('profile:load', loadProfile).catch(() => {});
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
            <Text style={styles.signInTitle}>Sign In to Nexera</Text>
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
          avatarUrl={profile.avatar_url}
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
            completedWorkouts={lifetimeStats?.totalWorkouts}
            totalVolumeLbs={lifetimeStats?.totalVolumeLbs}
            streakDays={streakDays}
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
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  signInTitle: {
    fontFamily: typography.fontSerif,
    fontSize: 26,
    color: colors.text,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: spacing.sm,
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
    borderWidth: 1,
    borderColor: colors.error + '55',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
});
