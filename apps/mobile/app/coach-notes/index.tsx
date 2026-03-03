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
import { supabase } from '../../src/lib/supabase';
import { isFeatureEnabled, refreshFeatureFlags, needsRefresh } from '../../src/lib/featureFlags';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

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

  return (
    <View style={styles.container}>
      {notes.length > 0 && (
        <Text style={styles.sectionLabel}>
          {notes.length} note{notes.length !== 1 ? 's' : ''} from your coach
        </Text>
      )}
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={notes.length === 0 ? styles.center : { paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No coach notes yet. Your trainer will send notes after your workouts.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => router.push(`/coach-notes/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.sourceChip}>{sourceLabel(item.source)}</Text>
              <Text style={styles.dateText}>{formatDate(item.sent_at ?? item.created_at)}</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
            <Text style={styles.trainerName}>
              — {item.trainer_profile?.full_name ?? 'Your Coach'}
            </Text>
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
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sourceChip: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  trainerName: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
