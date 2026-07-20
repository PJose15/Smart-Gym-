/**
 * Program screen — stack route (NOT a tab).
 *
 * State machine:
 *   loading → ProgramScreenSkeleton
 *   empty   → "No program assigned yet" + freestyle CTA (PROG-04)
 *   error   → "Couldn't load program" + retry
 *   loaded  → ProgramHeader + Start CTA + ProgramDayCard list
 *
 * Data: cacheFirst(PROGRAM_CACHE_KEY, fetchProgram, CacheTTL.programData)
 * Auth: fetchFeedContext() for memberId — never hand-roll auth.getUser + members query.
 * Pull-to-refresh: clearCache then fresh fetch.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { fetchFeedContext } from '../../src/lib/feedService';
import {
  cacheFirst,
  clearCache,
  CacheTTL,
  type CacheKey,
} from '../../src/lib/cacheManager';
import {
  fetchProgram,
  PROGRAM_CACHE_KEY,
  type ActiveProgram,
} from '../../src/lib/programService';
import {
  resolveTodayDayNumber,
  dayStatus,
} from '../../src/lib/programLogic';
import { ProgramHeader } from '../../src/components/program/ProgramHeader';
import { ProgramDayCard } from '../../src/components/program/ProgramDayCard';
import { ProgramScreenSkeleton } from '../../src/components/skeleton/ProgramScreenSkeleton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

// ─── Screen state machine ─────────────────────────────────────────────────────

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error' }
  | { kind: 'loaded'; program: ActiveProgram };

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProgramScreen() {
  const router = useRouter();

  const [screenState, setScreenState] = useState<ScreenState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const memberIdRef = useRef<string | null>(null);

  // ─── Load ─────────────────────────────────────────────────────────────────

  // Mounted flag tied to unmount cleanup — guards setState after unmount
  // (the previous `let mounted` local was dead code: nothing ever flipped it)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (bypassCache = false) => {
    try {
      const ctx = await fetchFeedContext();
      if (!mountedRef.current) return;

      if (!ctx) {
        setScreenState({ kind: 'error' });
        return;
      }

      memberIdRef.current = ctx.memberId;

      let program: ActiveProgram | null;

      if (bypassCache) {
        await clearCache(PROGRAM_CACHE_KEY(ctx.memberId) as CacheKey);
        program = await fetchProgram(ctx.memberId);
      } else {
        program = await cacheFirst(
          PROGRAM_CACHE_KEY(ctx.memberId) as CacheKey,
          () => fetchProgram(ctx.memberId),
          CacheTTL.programData,
        );
      }

      if (!mountedRef.current) return;

      if (program === null || program.days.length === 0) {
        setScreenState({ kind: 'empty' });
      } else {
        setScreenState({ kind: 'loaded', program });
      }
    } catch {
      if (mountedRef.current) setScreenState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  // ─── Pull-to-refresh ──────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  // ─── Start workout handler ─────────────────────────────────────────────────

  const handleStartWorkout = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/scan');
  }, [router]);

  // ─── Exercise press handler ───────────────────────────────────────────────

  const handleExercisePress = useCallback(
    (exerciseName: string) => {
      router.push(`/exercise/${encodeURIComponent(exerciseName)}`);
    },
    [router],
  );

  // ─── Render: empty state ──────────────────────────────────────────────────

  function renderEmpty() {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateKicker}>PROGRAM</Text>
        <Text style={styles.stateTitle}>No program assigned yet</Text>
        <Text style={styles.stateBody}>
          Your trainer or AI coach hasn't assigned a program. You can still train
          freestyle — scan any machine to start logging.
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/(tabs)/scan')}
          accessibilityRole="button"
          accessibilityLabel="Open Scanner"
        >
          <Text style={styles.ctaText}>Open Scanner →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render: error state ──────────────────────────────────────────────────

  function renderError() {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>Couldn't load program</Text>
        <Text style={styles.stateBody}>Check your connection and try again.</Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => {
            setScreenState({ kind: 'loading' });
            load(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.ctaText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render: loaded state ─────────────────────────────────────────────────

  function renderLoaded(program: ActiveProgram) {
    const todayDayNumber = resolveTodayDayNumber(
      program.created_at,
      program.days.length,
      new Date(),
    );

    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Program header: name, chips, week progress */}
        <ProgramHeader program={program} />

        {/* Primary CTA: start today's workout */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleStartWorkout}
            accessibilityRole="button"
            accessibilityLabel="Start today's workout"
          >
            <Text style={styles.ctaText}>Start today's workout →</Text>
          </TouchableOpacity>
        </View>

        {/* Day cards */}
        {program.days.map((d) => (
          <ProgramDayCard
            key={d.day_number}
            day={d}
            status={dayStatus(d.day_number, todayDayNumber)}
            onExercisePress={handleExercisePress}
          />
        ))}
      </ScrollView>
    );
  }

  // ─── Final render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {screenState.kind === 'loading' && (
        <ScrollView style={styles.screen} contentContainerStyle={styles.skeletonContent}>
          <ProgramScreenSkeleton />
        </ScrollView>
      )}
      {screenState.kind === 'empty' && renderEmpty()}
      {screenState.kind === 'error' && renderError()}
      {screenState.kind === 'loaded' && renderLoaded(screenState.program)}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  skeletonContent: {
    paddingBottom: 80,
  },

  // Centered states (empty + error)
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  stateKicker: {
    fontSize: typography.labelSize,
    fontFamily: typography.fontSemiBold,
    color: colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  stateTitle: {
    fontSize: typography.h4Size,
    fontFamily: typography.fontBold,
    color: colors.text,
    textAlign: 'center',
  },
  stateBody: {
    fontSize: typography.bodySize,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.bodySize * 1.6,
  },

  // CTA button (primary + glow — TodayZone pattern)
  ctaContainer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
  ctaText: {
    fontSize: typography.bodyLgSize,
    fontFamily: typography.fontSemiBold,
    color: colors.white,
    letterSpacing: 0.5,
  },
});
