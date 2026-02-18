import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../src/lib/supabase';
import { getWeightUnit, saveWeightUnit } from '../../src/lib/weightUnit';
import { Button, Text, Card } from '../../src/components';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';


interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleSaveName = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      setError(null);

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ full_name: nameInput.trim() })
        .eq('id', profile.id);

      if (updateErr) throw updateErr;

      setProfile({ ...profile, full_name: nameInput.trim() });
      setEditingName(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleWeightUnit = async (newUnit: 'kg' | 'lbs') => {
    setWeightUnit(newUnit);
    await saveWeightUnit(newUnit);
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  const startEditName = () => {
    setNameInput(profile?.full_name || '');
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setNameInput('');
  };

  const getInitials = (name: string | null): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0]?.toUpperCase() || '?';
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" color="textSecondary" style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Card style={styles.signInCard}>
          <Text variant="heading" style={styles.signInTitle}>Sign In to SmartGym</Text>
          <Text variant="body" color="textSecondary" style={styles.signInSubtitle}>
            Sign in to track your workouts, view your progress, and manage your profile.
          </Text>
          <Button
            title="Sign In / Sign Up"
            onPress={() => router.push('/auth')}
            style={styles.fullWidth}
          />
        </Card>
      </View>
    );
  }

  return (
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

      <View style={styles.avatarSection}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{getInitials(profile.full_name)}</Text>
        </View>
        <Text variant="heading" style={styles.profileName}>
          {profile.full_name || 'No Name Set'}
        </Text>
        <Text variant="body" color="textSecondary">{profile.email}</Text>
      </View>

      <View style={styles.section}>
        <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>Edit Profile</Text>
        <Card style={styles.card}>
          <Text variant="caption" color="textSecondary" style={styles.fieldLabel}>Full Name</Text>
          {editingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textSecondary}
                autoFocus
                editable={!saving}
              />
              <View style={styles.editActions}>
                <Button
                  title="Save"
                  onPress={handleSaveName}
                  loading={saving}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Cancel"
                  onPress={cancelEditName}
                  variant="outline"
                  disabled={saving}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.fieldRow} onPress={startEditName}>
              <Text variant="body" style={styles.fieldValue}>
                {profile.full_name || 'Tap to set name'}
              </Text>
              <Text variant="body" color="primary" style={styles.editIndicator}>Edit</Text>
            </TouchableOpacity>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>Preferences</Text>
        <Card style={styles.card}>
          <View style={styles.preferenceRow}>
            <Text variant="body" style={styles.preferenceLabel}>Weight Unit</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleOption, weightUnit === 'kg' && styles.toggleOptionActive]}
                onPress={() => handleToggleWeightUnit('kg')}
              >
                <Text
                  style={[styles.toggleOptionText, weightUnit === 'kg' && styles.toggleOptionTextActive]}
                >
                  kg
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleOption, weightUnit === 'lbs' && styles.toggleOptionActive]}
                onPress={() => handleToggleWeightUnit('lbs')}
              >
                <Text
                  style={[styles.toggleOptionText, weightUnit === 'lbs' && styles.toggleOptionTextActive]}
                >
                  lbs
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>Account</Text>
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          style={{ backgroundColor: colors.error }}
        />
      </View>
    </ScrollView>
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
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  profileName: {
    marginBottom: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingHorizontal: 4,
  },
  card: {
    padding: spacing.md,
  },
  fieldLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: spacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  fieldValue: {
    flex: 1,
  },
  editIndicator: {
    fontWeight: '600',
    marginLeft: spacing.md,
  },
  editRow: {
    gap: spacing.md,
  },
  editInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preferenceLabel: {
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 3,
  },
  toggleOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  toggleOptionActive: {
    backgroundColor: colors.primary,
  },
  toggleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleOptionTextActive: {
    color: colors.white,
  },
  fullWidth: {
    width: '100%',
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
});
