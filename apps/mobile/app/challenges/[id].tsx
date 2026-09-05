/**
 * Challenge detail screen — join flow, personal progress, leaderboard,
 * and graceful handling of deleted/ended challenges.
 *
 * State machine:
 *   loading  → skeleton
 *   null     → "This challenge is no longer available" (stale deep link)
 *   inactive → full detail + ended banner, NO join CTA
 *   active   → full detail + join CTA (when canJoin passes)
 *
 * Auth pattern: Bearer JWT via joinChallenge() → web-admin API route.
 * Data pattern: cacheFirst with CacheTTL.challengeDetail (2 min); pull-to-refresh
 *               bypasses cache.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { ChallengeDetail, WeightUnit } from '@nexera/types';
import {
  canJoin,
  challengeIcon,
  countdownLabel,
  formatScore,
  progressPct as computeProgressPct,
} from '../../src/lib/challengeLogic';
import {
  CHALLENGE_DETAIL_CACHE_KEY,
  CHALLENGES_CACHE_KEY,
  fetchChallengeDetail,
  joinChallenge,
} from '../../src/lib/challengeService';
import { fetchFeedContext } from '../../src/lib/feedService';
import { cacheFirst, clearCache, setCache, CacheTTL, type CacheKey } from '../../src/lib/cacheManager';
import { getWeightUnit } from '../../src/lib/weightUnit';
import { ChallengeLeaderboard } from '../../src/components/challenges/ChallengeLeaderboard';
import { SkeletonBone } from '../../src/components/skeleton/SkeletonBone';
import { ConfettiEffect } from '../../src/components/effects/ConfettiEffect';
import { useReducedMotion } from '../../src/hooks/useReducedMotion';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

// ─── UUID validation (prevents garbage IDs crashing the detail fetch) ─────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string | string[] | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

// ─── Screen states ────────────────────────────────────────────────────────────

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error' }
  | { kind: 'detail'; detail: ChallengeDetail };

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped}%` as `${number}%` }]} />
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <SkeletonBone variant="line" width="60%" height={16} />
      <SkeletonBone variant="line" width="90%" height={28} style={{ marginTop: spacing.sm }} />
      <SkeletonBone variant="rect" height={80} style={{ marginTop: spacing.md }} />
      <SkeletonBone variant="line" width="40%" height={14} style={{ marginTop: spacing.md }} />
      <SkeletonBone variant="rect" height={200} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const [screenState, setScreenState] = useState<ScreenState>({ kind: 'loading' });
  const [memberId, setMemberId] = useState<string | null>(null);
  const [gymId, setGymId] = useState<string | null>(null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Guard: invalid or missing id goes straight to not-found
  const resolvedId = isValidUuid(id) ? id : null;
  const memberIdRef = useRef<string | null>(null);
  const gymIdRef = useRef<string | null>(null);

  // ─── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(
    async (bypassCache = false) => {
      if (!resolvedId) {
        setScreenState({ kind: 'not-found' });
        return;
      }

      try {
        const [ctx, unit] = await Promise.all([fetchFeedContext(), getWeightUnit()]);
        setWeightUnit(unit);

        if (!ctx || ctx === 'signed-out') {
          setScreenState({ kind: 'error' });
          return;
        }

        setMemberId(ctx.memberId);
        setGymId(ctx.gymId);
        memberIdRef.current = ctx.memberId;
        gymIdRef.current = ctx.gymId;

        const cacheKey = CHALLENGE_DETAIL_CACHE_KEY(resolvedId) as CacheKey;

        let detail: ChallengeDetail | null;
        if (bypassCache) {
          await clearCache(cacheKey);
          detail = await fetchChallengeDetail(resolvedId, ctx.memberId);
          if (detail) {
            await setCache(cacheKey, detail);
          }
        } else {
          detail = await cacheFirst(
            cacheKey,
            () => fetchChallengeDetail(resolvedId, ctx.memberId),
            CacheTTL.challengeDetail,
          );
        }

        if (!detail) {
          setScreenState({ kind: 'not-found' });
          return;
        }

        setScreenState({ kind: 'detail', detail });
      } catch {
        setScreenState({ kind: 'error' });
      }
    },
    [resolvedId],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  // ─── Pull-to-refresh ────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  // ─── Join flow ──────────────────────────────────────────────────────────────

  const handleJoin = useCallback(async () => {
    if (!resolvedId || !memberIdRef.current || !gymIdRef.current) return;
    setJoining(true);
    setJoinError(null);

    try {
      const result = await joinChallenge(resolvedId, memberIdRef.current, gymIdRef.current);

      switch (result) {
        case 'joined': {
          // Optimistic update
          setScreenState((prev) => {
            if (prev.kind !== 'detail') return prev;
            const d = prev.detail;
            const optimisticParticipant = {
              member_id: memberIdRef.current!,
              display_name: 'You',
              avatar_url: null,
              current_score: 0,
              current_rank: d.total_participants + 1,
              joined_at: new Date().toISOString(),
            };
            return {
              kind: 'detail',
              detail: {
                ...d,
                is_joined: true,
                my_score: 0,
                rank: d.total_participants + 1,
                total_participants: d.total_participants + 1,
                progress_pct: 0,
                participants: [...d.participants, optimisticParticipant],
                my_participation: optimisticParticipant,
              },
            };
          });

          // Haptic feedback — unavailable on web/unsupported devices; a throw
          // here would fall into the outer catch and show a false
          // "Couldn't join" error after a successful join.
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

          // Confetti (gated by reduced motion)
          if (!reducedMotion) {
            setShowConfetti(true);
          }

          // Background re-fetch to get real leaderboard row.
          // Also clear the challenges LIST cache so the list screen doesn't
          // show a stale "not joined" card for up to the cache TTL.
          const cacheKey = CHALLENGE_DETAIL_CACHE_KEY(resolvedId) as CacheKey;
          await clearCache(cacheKey);
          await clearCache(CHALLENGES_CACHE_KEY(gymIdRef.current!) as CacheKey);
          const fresh = await fetchChallengeDetail(resolvedId, memberIdRef.current!);
          if (fresh) {
            setScreenState({ kind: 'detail', detail: fresh });
          }
          break;
        }

        case 'already_joined': {
          // State was stale — silently mark as joined
          setScreenState((prev) => {
            if (prev.kind !== 'detail') return prev;
            return { kind: 'detail', detail: { ...prev.detail, is_joined: true } };
          });
          break;
        }

        case 'ended': {
          setScreenState((prev) => {
            if (prev.kind !== 'detail') return prev;
            return { kind: 'detail', detail: { ...prev.detail, is_active: false } };
          });
          break;
        }

        case 'error': {
          setJoinError("Couldn't join — try again");
          break;
        }
      }
    } catch {
      setJoinError("Couldn't join — try again");
    } finally {
      setJoining(false);
    }
  }, [resolvedId, reducedMotion]);

  // ─── Back navigation ────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/challenges' as Parameters<typeof router.replace>[0]);
    }
  }, [router]);

  // ─── Render helpers ─────────────────────────────────────────────────────────

  function renderNotFound() {
    return (
      <View style={styles.fullScreenState}>
        <Text style={styles.stateEmoji}>🏆</Text>
        <Text style={styles.stateTitle}>This challenge is no longer available</Text>
        <Text style={styles.stateSubtitle}>
          The challenge may have ended or been removed.
        </Text>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to challenges"
        >
          <Text style={styles.backButtonText}>Back to challenges</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderError() {
    return (
      <View style={styles.fullScreenState}>
        <Text style={styles.stateEmoji}>⚠️</Text>
        <Text style={styles.stateTitle}>Couldn't load challenge</Text>
        <Text style={styles.stateSubtitle}>Check your connection and try again.</Text>
        <TouchableOpacity
          onPress={() => {
            setScreenState({ kind: 'loading' });
            load(true);
          }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.backButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderDetail(detail: ChallengeDetail) {
    const now = new Date();
    const countdown = countdownLabel(detail.end_date, now);
    const isEnded = !detail.is_active;
    const showJoin = !isEnded && canJoin(detail);
    const showInviteOnly = !isEnded && detail.is_joined === false && detail.entry_mode === 'invite';
    const myScore = detail.my_score;
    const topScore = detail.top_score;
    const showProgress =
      detail.is_joined && topScore > 0 && myScore !== null;

    const pct = showProgress ? computeProgressPct(myScore!, topScore) : 0;

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
        {/* Ended banner */}
        {isEnded && (
          <View style={styles.endedBanner}>
            <Text style={styles.endedText}>Challenge ended</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.typeIcon}>{challengeIcon(detail.challenge_type)}</Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{detail.challenge_type}</Text>
            </View>
          </View>

          <Text style={styles.title}>{detail.title}</Text>

          {detail.description ? (
            <Text style={styles.description}>{detail.description}</Text>
          ) : null}

          {/* Chips row */}
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{countdown}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {detail.total_participants} competing
              </Text>
            </View>
          </View>

          {/* Prize */}
          {detail.prize_description ? (
            <View style={styles.prizeRow}>
              <Text style={styles.prizeLabel}>Prize: </Text>
              <Text style={styles.prizeText}>{detail.prize_description}</Text>
            </View>
          ) : null}
        </View>

        {/* Join CTA */}
        {showJoin && (
          <View style={styles.ctaContainer}>
            <TouchableOpacity
              onPress={handleJoin}
              disabled={joining}
              style={[styles.joinButton, joining && styles.joinButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel={joining ? 'Joining challenge' : 'Join this challenge'}
              accessibilityState={{ disabled: joining }}
            >
              {joining ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.joinButtonText}>Join Challenge</Text>
              )}
            </TouchableOpacity>
            {joinError ? <Text style={styles.joinError}>{joinError}</Text> : null}
          </View>
        )}

        {showInviteOnly && (
          <View style={styles.inviteOnlyRow}>
            <Text style={styles.inviteOnlyText}>Invite-only challenge</Text>
          </View>
        )}

        {/* Joined state */}
        {detail.is_joined && !isEnded && (
          <View style={styles.joinedBadge}>
            <Text style={styles.joinedText}>Joined</Text>
          </View>
        )}

        {/* Progress bar */}
        {showProgress && (
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>
              You:{' '}
              {formatScore(myScore!, detail.challenge_type, weightUnit)}
              {'  ·  '}Leader:{' '}
              {formatScore(topScore, detail.challenge_type, weightUnit)}
            </Text>
            <ProgressBar pct={pct} />
          </View>
        )}

        {/* Leaderboard */}
        <View style={styles.leaderboardSection}>
          <Text style={styles.sectionTitle}>Leaderboard</Text>
          {memberId && (
            <ChallengeLeaderboard
              participants={detail.participants}
              myMemberId={memberId}
              challengeType={detail.challenge_type}
              weightUnit={weightUnit}
            />
          )}
        </View>
      </ScrollView>
    );
  }

  // ─── Final render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Confetti overlay */}
      {showConfetti && !reducedMotion && (
        <ConfettiEffect
          variant="achievement"
          onComplete={() => setShowConfetti(false)}
        />
      )}

      {screenState.kind === 'loading' && (
        <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
          <DetailSkeleton />
        </ScrollView>
      )}
      {screenState.kind === 'not-found' && renderNotFound()}
      {screenState.kind === 'error' && renderError()}
      {screenState.kind === 'detail' && renderDetail(screenState.detail)}
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
  skeletonContainer: {
    padding: spacing.md,
    gap: spacing.xs,
  },

  // Full-screen states
  fullScreenState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  stateEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  stateTitle: {
    fontSize: typography.h4Size,
    fontFamily: typography.fontBold,
    color: colors.text,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: typography.bodySize,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  backButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: typography.bodySize,
    fontFamily: typography.fontSemiBold,
    color: colors.white,
  },

  // Ended banner
  endedBanner: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  endedText: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontMedium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Header card
  headerCard: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeIcon: {
    fontSize: 24,
  },
  typeBadge: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  typeBadgeText: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontBold,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: typography.h3Size,
    fontFamily: typography.fontBold,
    color: colors.text,
    marginBottom: spacing.xs,
    lineHeight: typography.h3Size * 1.35,
  },
  description: {
    fontSize: typography.bodySize,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    lineHeight: typography.bodySize * 1.6,
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
  },
  prizeRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  prizeLabel: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontSemiBold,
    color: colors.gold,
  },
  prizeText: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    flex: 1,
  },

  // CTA
  ctaContainer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  joinButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    fontSize: typography.bodyLgSize,
    fontFamily: typography.fontBold,
    color: colors.white,
    letterSpacing: 0.5,
  },
  joinError: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontRegular,
    color: colors.error,
    textAlign: 'center',
  },

  // Invite-only
  inviteOnlyRow: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  inviteOnlyText: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontMedium,
    color: colors.textMuted,
  },

  // Joined badge
  joinedBadge: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.successSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.success + '40',
    alignSelf: 'flex-start',
  },
  joinedText: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontSemiBold,
    color: colors.success,
  },

  // Progress section
  progressSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  progressLabel: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceHighest,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },

  // Leaderboard section
  leaderboardSection: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.h4Size,
    fontFamily: typography.fontBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
