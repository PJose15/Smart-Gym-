import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { trackEvent } from '../../src/lib/events';

interface CoachNoteDetail {
  id: string;
  source: string;
  title: string;
  body: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  sent_at: string | null;
  trainer_profile: { full_name: string } | null;
}

export default function CoachNoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<CoachNoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    fetchNote();
  }, [id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchNote();
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  async function fetchNote() {
    if (!id) return;
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('coach_notes')
        .select('id, source, title, body, meta, created_at, sent_at, trainer_profile:trainer_profile_id(full_name)')
        .eq('id', id)
        .single();

      if (fetchErr || !data) {
        setError('Failed to load note. Please try again.');
        setLoading(false);
        return;
      }

      setNote(data as unknown as CoachNoteDetail);

      // Check if already acknowledged
      const { data: { user } } = await supabase.auth.getUser();
      if (user && id) {
        const { data: ackData } = await supabase
          .from('member_note_ack')
          .select('id')
          .eq('note_id', id)
          .eq('profile_id', user.id)
          .limit(1);
        if (ackData && ackData.length > 0) {
          setAcknowledged(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load note');
    } finally {
      setLoading(false);
    }
  }

  const handleAcknowledge = useCallback(async () => {
    if (!id || acknowledged || acking) return;
    setAcking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('member_note_ack').insert({
        note_id: id,
        profile_id: user.id,
      });

      trackEvent('ai_cues_viewed', { action: 'note_acknowledged', note_id: id });
      setAcknowledged(true);
    } catch {
      // Best-effort
    } finally {
      setAcking(false);
    }
  }, [id, acknowledged, acking]);

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function sourceLabel(source: string): string {
    if (source === 'workout') return 'Post-Workout Note';
    if (source === 'weekly') return 'Weekly Check-in';
    return 'Coach Note';
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
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchNote(); }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!note) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Note not found.</Text>
      </View>
    );
  }

  // ─── Enrichment: computed values ─────────────────────
  const sentDate = new Date(note.sent_at ?? note.created_at);
  const daysSinceSent = Math.floor((Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
  const timeSinceText = daysSinceSent === 0
    ? 'Today'
    : daysSinceSent === 1
      ? 'Yesterday'
      : daysSinceSent < 7
        ? `${daysSinceSent} days ago`
        : daysSinceSent < 30
          ? `${Math.floor(daysSinceSent / 7)} week${Math.floor(daysSinceSent / 7) > 1 ? 's' : ''} ago`
          : `${Math.floor(daysSinceSent / 30)} month${Math.floor(daysSinceSent / 30) > 1 ? 's' : ''} ago`;

  const wordCount = note.body.split(/\s+/).length;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  const metaActionItems = Array.isArray((note.meta as Record<string, unknown>)?.action_items)
    ? (note.meta as Record<string, unknown>).action_items as string[]
    : [];
  const metaTips = Array.isArray((note.meta as Record<string, unknown>)?.tips)
    ? (note.meta as Record<string, unknown>).tips as string[]
    : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.sourceChip}>{sourceLabel(note.source)}</Text>
        <Text style={styles.dateText}>{formatDate(note.sent_at ?? note.created_at)}</Text>
      </View>

      {/* Enrichment: time-since + reading time */}
      <View style={styles.metaRow}>
        <Text style={styles.metaChip}>{timeSinceText}</Text>
        <Text style={styles.metaChip}>~{readingTimeMin} min read</Text>
      </View>

      <Text style={styles.title}>{note.title}</Text>

      <View style={styles.bodyContainer}>
        <LinearGradient
          colors={[colors.primaryLight, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.energyRibbon}
        />
        {note.body.split('\n\n').map((paragraph, i) => (
          <Text key={i} style={styles.bodyText}>{paragraph}</Text>
        ))}
      </View>

      {/* Action Items from meta */}
      {metaActionItems.length > 0 && (
        <View style={styles.actionItemsContainer}>
          <Text style={styles.actionItemsTitle}>Action Items</Text>
          {metaActionItems.map((item, i) => (
            <View key={i} style={styles.actionItemRow}>
              <View style={styles.actionDot} />
              <Text style={styles.actionItemText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tips from meta */}
      {metaTips.length > 0 && (
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Tips</Text>
          {metaTips.map((tip, i) => (
            <Text key={i} style={styles.tipText}>{tip}</Text>
          ))}
        </View>
      )}

      {/* Acknowledgement button */}
      <View style={styles.ackContainer}>
        {acknowledged ? (
          <View style={styles.ackDone}>
            <Text style={styles.ackDoneText}>Acknowledged</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.ackButton}
            onPress={handleAcknowledge}
            disabled={acking}
            activeOpacity={0.7}
          >
            <Text style={styles.ackButtonText}>
              {acking ? 'Sending...' : 'Got it'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.divider} />
        <Text style={styles.trainerName}>
          {note.trainer_profile?.full_name ?? 'Your Coach'}
        </Text>
        <Text style={styles.trainerLabel}>Your Trainer</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sourceChip: {
    fontSize: 10,
    fontFamily: typography.fontBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.primaryLight,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  dateText: {
    fontSize: 11,
    fontFamily: typography.fontMono,
    color: colors.textMuted,
  },
  title: {
    fontFamily: typography.fontSerif,
    fontSize: 26,
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 34,
  },
  bodyContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    padding: spacing.lg,
    paddingTop: spacing.lg + 2,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  energyRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  bodyText: {
    fontSize: 15,
    fontFamily: typography.fontRegular,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  footer: {
    alignItems: 'center',
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
    borderRadius: 1,
  },
  trainerName: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  trainerLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 15,
    fontFamily: typography.fontRegular,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: colors.textOnAccent,
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  ackContainer: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  ackButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ackButtonText: {
    color: colors.textOnAccent,
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  ackDone: {
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ackDoneText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // ─── Enrichment Styles ────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  metaChip: {
    fontSize: 11,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  actionItemsContainer: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  actionItemsTitle: {
    fontSize: 11,
    fontFamily: typography.fontBold,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  actionItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  actionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryLight,
    marginTop: 6,
  },
  actionItemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: colors.text,
    lineHeight: 20,
  },
  tipsContainer: {
    backgroundColor: colors.successSubtle,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success + '40',
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  tipsTitle: {
    fontSize: 11,
    fontFamily: typography.fontBold,
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
});
