import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../src/lib/supabase';
import { getWeightUnit, saveWeightUnit } from '../src/lib/weightUnit';
import { isFeatureEnabled, needsRefresh, refreshFeatureFlags } from '../src/lib/featureFlags';
import { unregisterPushToken } from '../src/lib/notificationService';
import { Button, Text, Card } from '../src/components';
import { AnimatedScreen } from '../src/components/AnimatedScreen';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import type { UserGoal, ExperienceLevel, WeightUnit } from '@nexera/types';

// ─── Constants ──────────────────────────────────────────

const TRAINING_PROFILE_CACHE_KEY = '@nexera:training_profile';

const GOAL_OPTIONS: { value: UserGoal; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Hypertrophy' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'general', label: 'General Fitness' },
];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const LIMITATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'knee_sensitive', label: 'Knee Sensitive' },
  { value: 'lower_back_sensitive', label: 'Lower Back Sensitive' },
  { value: 'shoulder_sensitive', label: 'Shoulder Sensitive' },
  { value: 'wrist_sensitive', label: 'Wrist Sensitive' },
  { value: 'neck_sensitive', label: 'Neck Sensitive' },
];

// ─── Types ──────────────────────────────────────────────

interface TrainingProfileState {
  goal: UserGoal;
  experience: ExperienceLevel;
  units: WeightUnit;
  preferred_rep_min: string;
  preferred_rep_max: string;
  limitations: string[];
}

const DEFAULT_TRAINING_PROFILE: TrainingProfileState = {
  goal: 'general',
  experience: 'beginner',
  units: 'lbs',
  preferred_rep_min: '',
  preferred_rep_max: '',
  limitations: [],
};

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [fullName, setFullName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [gymId, setGymId] = useState<string | null>(null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [showTrainingProfile, setShowTrainingProfile] = useState(false);
  const [trainingProfile, setTrainingProfile] = useState<TrainingProfileState>(DEFAULT_TRAINING_PROFILE);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth');
        return;
      }
      setUserId(user.id);

      if (needsRefresh()) {
        await refreshFeatureFlags();
      }

      // Load profile name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      setFullName(profileData?.full_name || '');

      // Load weight unit
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

        // Training profile
        const profileEnabled = isFeatureEnabled('training_profile_enabled');
        setShowTrainingProfile(profileEnabled);

        if (profileEnabled) {
          // Try cache first
          const cached = await AsyncStorage.getItem(TRAINING_PROFILE_CACHE_KEY);
          if (cached) {
            try {
              setTrainingProfile(JSON.parse(cached));
            } catch {
              await AsyncStorage.removeItem(TRAINING_PROFILE_CACHE_KEY);
            }
          }

          // Then fetch from server
          const { data } = await supabase
            .from('user_training_profiles')
            .select('goal, experience, units, preferred_rep_min, preferred_rep_max, limitations')
            .eq('profile_id', user.id)
            .eq('gym_id', memberData.gym_id)
            .maybeSingle();

          if (data) {
            const serverProfile: TrainingProfileState = {
              goal: data.goal as UserGoal,
              experience: data.experience as ExperienceLevel,
              units: data.units as WeightUnit,
              preferred_rep_min: data.preferred_rep_min?.toString() || '',
              preferred_rep_max: data.preferred_rep_max?.toString() || '',
              limitations: data.limitations || [],
            };
            setTrainingProfile(serverProfile);
            await AsyncStorage.setItem(TRAINING_PROFILE_CACHE_KEY, JSON.stringify(serverProfile));
          }
        }

        // Notification preferences
        if (isFeatureEnabled('push_notifications')) {
          try {
            const { data: prefData } = await supabase
              .from('notification_preferences')
              .select('enabled')
              .eq('profile_id', user.id)
              .maybeSingle();
            setNotificationsEnabled(prefData?.enabled ?? true);
          } catch {
            // Non-critical
          }
          setNotificationsLoaded(true);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings]),
  );

  const handleSaveName = async () => {
    if (!userId) return;
    try {
      setSaving(true);
      setError(null);
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ full_name: nameInput.trim() })
        .eq('id', userId);
      if (updateErr) throw updateErr;
      setFullName(nameInput.trim());
      setEditingName(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleWeightUnit = async (newUnit: WeightUnit) => {
    setWeightUnit(newUnit);
    await saveWeightUnit(newUnit);
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    if (!userId) return;
    try {
      const { error: upsertErr } = await supabase.from('notification_preferences').upsert(
        { profile_id: userId, enabled, updated_at: new Date().toISOString() },
        { onConflict: 'profile_id' },
      );
      if (upsertErr) throw upsertErr;
    } catch (err) {
      console.warn('[settings] notification toggle failed:', err);
      setNotificationsEnabled(!enabled);
    }
  };

  const handleSaveTrainingProfile = async () => {
    if (!userId || !gymId) return;

    const minStr = trainingProfile.preferred_rep_min.trim();
    const maxStr = trainingProfile.preferred_rep_max.trim();
    const hasMin = minStr.length > 0;
    const hasMax = maxStr.length > 0;

    if (hasMin !== hasMax) {
      Alert.alert('Invalid Range', 'Both min and max reps must be set, or both left empty.');
      return;
    }

    if (hasMin && hasMax) {
      const min = parseInt(minStr, 10);
      const max = parseInt(maxStr, 10);
      if (isNaN(min) || isNaN(max) || min < 1 || max > 30 || max < min) {
        Alert.alert('Invalid Range', 'Rep range must be between 1-30, and min must be <= max.');
        return;
      }
    }

    try {
      setSavingProfile(true);
      const repMin = hasMin ? parseInt(minStr, 10) : null;
      const repMax = hasMax ? parseInt(maxStr, 10) : null;

      const { error: upsertErr } = await supabase
        .from('user_training_profiles')
        .upsert(
          {
            gym_id: gymId,
            profile_id: userId,
            goal: trainingProfile.goal,
            experience: trainingProfile.experience,
            units: trainingProfile.units,
            preferred_rep_min: repMin,
            preferred_rep_max: repMax,
            limitations: trainingProfile.limitations,
          },
          { onConflict: 'gym_id,profile_id' },
        );

      if (upsertErr) throw upsertErr;

      await AsyncStorage.setItem(TRAINING_PROFILE_CACHE_KEY, JSON.stringify(trainingProfile));
      await saveWeightUnit(trainingProfile.units);
      setWeightUnit(trainingProfile.units);

      Alert.alert('Saved', 'Training profile updated successfully.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save training profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleLimitation = (limitation: string) => {
    setTrainingProfile((prev) => {
      const has = prev.limitations.includes(limitation);
      return {
        ...prev,
        limitations: has
          ? prev.limitations.filter((l) => l !== limitation)
          : [...prev.limitations, limitation],
      };
    });
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(TRAINING_PROFILE_CACHE_KEY);
          await unregisterPushToken();
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text variant="body" color="textSecondary">Loading settings...</Text>
      </View>
    );
  }

  return (
    <AnimatedScreen>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text variant="body" color="primary" style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>

        <Text variant="heading" style={styles.pageTitle}>Settings</Text>

        {error && (
          <View style={styles.errorBanner}>
            <Text variant="caption" style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Edit Name */}
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
                  <Button title="Save" onPress={handleSaveName} loading={saving} style={{ flex: 1 }} />
                  <Button
                    title="Cancel"
                    onPress={() => { setEditingName(false); setNameInput(''); }}
                    variant="outline"
                    disabled={saving}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => { setNameInput(fullName); setEditingName(true); }}
              >
                <Text variant="body" style={styles.fieldValue}>
                  {fullName || 'Tap to set name'}
                </Text>
                <Text variant="body" color="primary" style={styles.editIndicator}>Edit</Text>
              </TouchableOpacity>
            )}
          </Card>
        </View>

        {/* Preferences */}
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
                  <Text style={[styles.toggleOptionText, weightUnit === 'kg' && styles.toggleOptionTextActive]}>kg</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleOption, weightUnit === 'lbs' && styles.toggleOptionActive]}
                  onPress={() => handleToggleWeightUnit('lbs')}
                >
                  <Text style={[styles.toggleOptionText, weightUnit === 'lbs' && styles.toggleOptionTextActive]}>lbs</Text>
                </TouchableOpacity>
              </View>
            </View>
            {notificationsLoaded && (
              <View style={[styles.preferenceRow, { marginTop: spacing.md }]}>
                <Text variant="body" style={styles.preferenceLabel}>Notifications</Text>
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[styles.toggleOption, notificationsEnabled && styles.toggleOptionActive]}
                    onPress={() => handleToggleNotifications(true)}
                  >
                    <Text style={[styles.toggleOptionText, notificationsEnabled && styles.toggleOptionTextActive]}>On</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOption, !notificationsEnabled && styles.toggleOptionActive]}
                    onPress={() => handleToggleNotifications(false)}
                  >
                    <Text style={[styles.toggleOptionText, !notificationsEnabled && styles.toggleOptionTextActive]}>Off</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Card>
        </View>

        {/* Training Profile */}
        {showTrainingProfile && gymId && (
          <View style={styles.section}>
            <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>Training Profile</Text>
            <Card style={styles.card}>
              {/* Goal */}
              <Text variant="caption" color="textSecondary" style={styles.fieldLabel}>Goal</Text>
              <View style={styles.chipRow}>
                {GOAL_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, trainingProfile.goal === opt.value && styles.chipActive]}
                    onPress={() => setTrainingProfile((p) => ({ ...p, goal: opt.value }))}
                  >
                    <Text style={[styles.chipText, trainingProfile.goal === opt.value && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Experience */}
              <Text variant="caption" color="textSecondary" style={[styles.fieldLabel, { marginTop: spacing.md }]}>Experience</Text>
              <View style={styles.chipRow}>
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, trainingProfile.experience === opt.value && styles.chipActive]}
                    onPress={() => setTrainingProfile((p) => ({ ...p, experience: opt.value }))}
                  >
                    <Text style={[styles.chipText, trainingProfile.experience === opt.value && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Units */}
              <Text variant="caption" color="textSecondary" style={[styles.fieldLabel, { marginTop: spacing.md }]}>Units</Text>
              <View style={styles.chipRow}>
                {(['kg', 'lbs'] as WeightUnit[]).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.chip, trainingProfile.units === u && styles.chipActive]}
                    onPress={() => setTrainingProfile((p) => ({ ...p, units: u }))}
                  >
                    <Text style={[styles.chipText, trainingProfile.units === u && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Rep Range */}
              <Text variant="caption" color="textSecondary" style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Preferred Rep Range (optional)
              </Text>
              <View style={styles.repRangeRow}>
                <TextInput
                  style={styles.repInput}
                  value={trainingProfile.preferred_rep_min}
                  onChangeText={(v) => setTrainingProfile((p) => ({ ...p, preferred_rep_min: v }))}
                  placeholder="Min"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text variant="body" color="textSecondary"> - </Text>
                <TextInput
                  style={styles.repInput}
                  value={trainingProfile.preferred_rep_max}
                  onChangeText={(v) => setTrainingProfile((p) => ({ ...p, preferred_rep_max: v }))}
                  placeholder="Max"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>

              {/* Limitations */}
              <Text variant="caption" color="textSecondary" style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Limitations
              </Text>
              <View style={styles.chipRow}>
                {LIMITATION_OPTIONS.map((opt) => {
                  const selected = trainingProfile.limitations.includes(opt.value);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => toggleLimitation(opt.value)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Button
                title="Save Training Profile"
                onPress={handleSaveTrainingProfile}
                loading={savingProfile}
                style={{ marginTop: spacing.lg }}
              />
            </Card>
          </View>
        )}

        {/* Sign Out */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>Account</Text>
          <Button
            title="Sign Out"
            onPress={handleSignOut}
            style={{ backgroundColor: colors.error }}
          />
        </View>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  backButton: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  backText: {
    fontWeight: '600',
    fontSize: 16,
  },
  pageTitle: {
    marginBottom: spacing.lg,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },
  repRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  repInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
    width: 70,
    textAlign: 'center',
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
