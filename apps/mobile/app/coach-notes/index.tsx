import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { isFeatureEnabled, refreshFeatureFlags, needsRefresh } from '../../src/lib/featureFlags';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

interface CoachNoteRow {
  id: string;
  source: string;
  status: string;
  title: string;
  body: string;
  created_at: string;
  sent_at: string | null;
  trainer_profile: { full_name: string } | null;
}

export default function CoachNotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<CoachNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    if (needsRefresh()) await refreshFeatureFlags();
    const flagEnabled = isFeatureEnabled('ai_trainer_copilot');
    setEnabled(flagEnabled);

    if (!flagEnabled) {
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('coach_notes')
      .select('id, source, status, title, body, created_at, sent_at, trainer_profile:trainer_profile_id(full_name)')
      .eq('member_profile_id', user.id)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(100);

    if (error) {
      setError(error.message);
    } else if (data) {
      setNotes(data as unknown as CoachNoteRow[]);
    }
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotes();
    setRefreshing(false);
  }, []);

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function sourceLabel(source: string): string {
    if (source === 'workout') return 'Post-Workout';
    if (source === 'weekly') return 'Weekly Check-in';
    return 'Note';
  }

  function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0]?.toUpperCase() || '?';
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Failed to load notes. Pull down to retry.</Text>
      </View>
    );
  }

  if (!enabled) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Coach Notes are not available yet.</Text>
      </View>
    );
  }

  // ─── Enrichment: computed stats ─────────────────────
  const postWorkoutCount = notes.filter(n => n.source === 'workout').length;
  const weeklyCount = notes.filter(n => n.source === 'weekly').length;

  const daysSinceLastNote = notes.length > 0
    ? Math.floor((Date.now() - new Date(notes[0].sent_at ?? notes[0].created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <View style={styles.container}>
      {notes.length > 0 && (
        <View style={styles.statsHeader}>
          <Text style={styles.sectionLabel}>
            {notes.length} note{notes.length !== 1 ? 's' : ''} from your coach
          </Text>
          <View style={styles.statsChipsRow}>
            {postWorkoutCount > 0 && (
              <View style={styles.statsChip}>
                <Text style={styles.statsChipText}>{postWorkoutCount} Post-Workout</Text>
              </View>
            )}
            {weeklyCount > 0 && (
              <View style={[styles.statsChip, { backgroundColor: colors.successSubtle, borderColor: colors.success + '40' }]}>
                <Text style={[styles.statsChipText, { color: colors.success }]}>{weeklyCount} Weekly</Text>
              </View>
            )}
          </View>
          {daysSinceLastNote !== null && (
            <Text style={styles.lastNoteText}>
              {daysSinceLastNote === 0
                ? 'Last note: today'
                : daysSinceLastNote === 1
                  ? 'Last note: yesterday'
                  : `Last note: ${daysSinceLastNote} days ago`}
            </Text>
          )}
        </View>
      )}
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
        contentContainerStyle={notes.length === 0 ? styles.center : { paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No coach notes yet. Your trainer will send notes after your workouts.</Text>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.card, index === 0 && styles.cardLatest]}
            activeOpacity={0.7}
            onPress={() => router.push(`/coach-notes/${item.id}`)}
          >
            {index === 0 && (
              <LinearGradient
                colors={[colors.primaryLight, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.energyRibbon}
              />
            )}
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(item.trainer_profile?.full_name ?? 'Your Coach')}
                </Text>
              </View>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.trainerName} numberOfLines={1}>
                  {item.trainer_profile?.full_name ?? 'Your Coach'}
                </Text>
                <Text style={styles.sourceChip}>{sourceLabel(item.source)}</Text>
              </View>
              <View style={styles.cardHeaderRight}>
                {index === 0 && <Text style={styles.latestBadge}>Latest</Text>}
                <Text style={styles.dateText}>{formatDate(item.sent_at ?? item.created_at)}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginBottom: spacing.sm + 2,
  },
  sourceChip: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.primaryLight,
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    fontFamily: typography.fontMono,
    color: colors.textMuted,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  trainerName: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ─── Stats Header ─────────────────────────────────────
  statsHeader: {
    marginBottom: spacing.md,
  },
  statsChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  statsChip: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statsChipText: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.primaryLight,
  },
  lastNoteText: {
    fontSize: 11,
    fontFamily: typography.fontMono,
    color: colors.textMuted,
    marginTop: 4,
  },

  // ─── Latest Card (featured: Energy Ribbon top accent) ──
  cardLatest: {
    borderColor: colors.borderAccent,
  },
  energyRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  cardHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  latestBadge: {
    fontSize: 10,
    fontFamily: typography.fontBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.primaryLight,
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },

  // ─── Trainer avatar ────────────────────────────────────
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHighest,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: typography.fontBold,
  },
});
