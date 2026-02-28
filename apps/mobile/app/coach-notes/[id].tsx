import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

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

  useEffect(() => {
    fetchNote();
  }, [id]);

  async function fetchNote() {
    if (!id) return;
    const { data, error } = await supabase
      .from('coach_notes')
      .select('id, source, title, body, meta, created_at, sent_at, trainer_profile:trainer_profile_id(full_name)')
      .eq('id', id)
      .single();

    if (!error && data) {
      setNote(data as unknown as CoachNoteDetail);
    }
    setLoading(false);
  }

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

  if (!note) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Note not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.sourceChip}>{sourceLabel(note.source)}</Text>
        <Text style={styles.dateText}>{formatDate(note.sent_at ?? note.created_at)}</Text>
      </View>

      <Text style={styles.title}>{note.title}</Text>

      <View style={styles.bodyContainer}>
        {note.body.split('\n\n').map((paragraph, i) => (
          <Text key={i} style={styles.bodyText}>{paragraph}</Text>
        ))}
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
});
