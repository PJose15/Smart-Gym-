import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
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
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    fetchNote();
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dateText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 28,
  },
  bodyContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  bodyText: {
    fontSize: 15,
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
    backgroundColor: colors.border,
    marginBottom: spacing.md,
    borderRadius: 1,
  },
  trainerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  trainerLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 15,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  ackContainer: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  ackButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ackButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  ackDone: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ackDoneText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // ─── Enrichment Styles ────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  metaChip: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionItemsContainer: {
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  actionItemsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  actionItemText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  tipsContainer: {
    backgroundColor: colors.success + '10',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
});
