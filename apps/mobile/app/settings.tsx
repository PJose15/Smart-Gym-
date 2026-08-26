import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../src/lib/supabase';
import { getMemberId } from '../src/lib/memberData';
import { getWeightUnit, saveWeightUnit } from '../src/lib/weightUnit';
import { isFeatureEnabled, needsRefresh, refreshFeatureFlags, clearFlagCache } from '../src/lib/featureFlags';
import { unregisterPushToken } from '../src/lib/notificationService';
import { clearAllCaches } from '../src/lib/cacheManager';
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

/**
 * Quiet hours hour steps for the Alert picker.
 * HH values in 2-hour increments covering a full day (UTC, per Pitfall 7).
 */
const HOUR_OPTIONS: string[] = [
  '00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22',
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
  // Per-category push toggles (7 booleans — schema columns in notification_preferences)
  const [pushPrs, setPushPrs] = useState(true);
  const [pushAchievements, setPushAchievements] = useState(true);
  const [pushLevelUp, setPushLevelUp] = useState(true);
  const [pushChallengeRank, setPushChallengeRank] = useState(true);
  const [pushTrainerNote, setPushTrainerNote] = useState(true);
  const [pushNewProgram, setPushNewProgram] = useState(true);
  const [pushGymFeed, setPushGymFeed] = useState(true);
  // Quiet hours (persisted as 'HH:MM:SS' in UTC)
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00:00');
  // For quiet hours time picker modal
  const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | null>(null);
  const [showTrainingProfile, setShowTrainingProfile] = useState(false);
  const [trainingProfile, setTrainingProfile] = useState<TrainingProfileState>(DEFAULT_TRAINING_PROFILE);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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

      // Load profile name + avatar
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      setFullName(profileData?.full_name || '');
      setAvatarUrl(profileData?.avatar_url || null);

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

        // Notification preferences (global + 7 categories + 3 quiet-hours columns)
        if (isFeatureEnabled('push_notifications')) {
          try {
            const memberId = await getMemberId(user.id);
            if (memberId) {
              const { data: prefData } = await supabase
                .from('notification_preferences')
                .select(
                  'enabled, push_prs, push_achievements, push_level_up, push_challenge_rank, push_trainer_note, push_new_program, push_gym_feed, quiet_hours_enabled, quiet_hours_start, quiet_hours_end',
                )
                .eq('member_id', memberId)
                .maybeSingle();
              setNotificationsEnabled(prefData?.enabled ?? true);
              setPushPrs(prefData?.push_prs ?? true);
              setPushAchievements(prefData?.push_achievements ?? true);
              setPushLevelUp(prefData?.push_level_up ?? true);
              setPushChallengeRank(prefData?.push_challenge_rank ?? true);
              setPushTrainerNote(prefData?.push_trainer_note ?? true);
              setPushNewProgram(prefData?.push_new_program ?? true);
              setPushGymFeed(prefData?.push_gym_feed ?? true);
              setQuietHoursEnabled(prefData?.quiet_hours_enabled ?? false);
              setQuietHoursStart(prefData?.quiet_hours_start ?? '22:00:00');
              setQuietHoursEnd(prefData?.quiet_hours_end ?? '07:00:00');
            }
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
      const { error: updateErr } = await supabase.rpc('upsert_own_profile', {
        p_full_name: nameInput.trim(),
      });
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
    // Sync to cloud if gym membership exists
    if (userId && gymId) {
      supabase
        .from('user_training_profiles')
        .upsert(
          { profile_id: userId, gym_id: gymId, units: newUnit },
          { onConflict: 'gym_id,profile_id' },
        )
        .then(({ error: syncErr }) => {
          if (syncErr) console.warn('[settings] unit sync failed:', syncErr.message);
        });
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    if (!userId) return;
    try {
      const memberId = await getMemberId(userId);
      if (!memberId) return;
      const { error: upsertErr } = await supabase.from('notification_preferences').upsert(
        { member_id: memberId, enabled, updated_at: new Date().toISOString() },
        { onConflict: 'member_id' },
      );
      if (upsertErr) throw upsertErr;
    } catch (err) {
      console.warn('[settings] notification toggle failed:', err);
      setNotificationsEnabled(!enabled);
    }
  };

  /**
   * Optimistic upsert for a single push-category boolean.
   * Rolls back to `!newValue` on error (mirrors handleToggleNotifications).
   */
  const handleTogglePushCategory = async (
    column: string,
    newValue: boolean,
    setter: (v: boolean) => void,
  ) => {
    setter(newValue);
    if (!userId) return;
    try {
      const memberId = await getMemberId(userId);
      if (!memberId) return;
      const { error: upsertErr } = await supabase.from('notification_preferences').upsert(
        { member_id: memberId, [column]: newValue, updated_at: new Date().toISOString() },
        { onConflict: 'member_id' },
      );
      if (upsertErr) throw upsertErr;
    } catch (err) {
      console.warn(`[settings] ${column} toggle failed:`, err);
      setter(!newValue);
    }
  };

  /** Persist quiet hours fields (enabled + start + end) together. */
  const handleUpsertQuietHours = async (
    patch: {
      quiet_hours_enabled?: boolean;
      quiet_hours_start?: string;
      quiet_hours_end?: string;
    },
  ) => {
    if (!userId) return;
    try {
      const memberId = await getMemberId(userId);
      if (!memberId) return;
      // Persist the device timezone alongside quiet hours (column added by
      // migration 032) so the server can evaluate windows in local time.
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { error: upsertErr } = await supabase.from('notification_preferences').upsert(
        { member_id: memberId, ...patch, timezone, updated_at: new Date().toISOString() },
        { onConflict: 'member_id' },
      );
      if (upsertErr) throw upsertErr;
    } catch (err) {
      console.warn('[settings] quiet hours upsert failed:', err);
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

  const handleAvatarUpload = async () => {
    if (!userId) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const path = `${userId}/avatar.${ext}`;

    setUploadingAvatar(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: mimeType, upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateErr } = await supabase.rpc('upsert_own_profile', {
        p_avatar_url: newUrl,
      });

      if (updateErr) throw updateErr;

      setAvatarUrl(newUrl);
    } catch (err: unknown) {
      Alert.alert('Upload Failed', err instanceof Error ? err.message : 'Could not upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await clearAllCaches();
          await AsyncStorage.removeItem(TRAINING_PROFILE_CACHE_KEY);
          clearFlagCache();
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleAvatarUpload} disabled={uploadingAvatar} style={styles.avatarTouchable}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {fullName ? fullName[0].toUpperCase() : '?'}
                </Text>
              </View>
            )}
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.avatarOverlay} />
            ) : (
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>Edit</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

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
              <>
                {/* Global On/Off */}
                <View style={[styles.preferenceRow, { marginTop: spacing.md }]}>
                  <Text variant="body" style={styles.preferenceLabel}>Notifications</Text>
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity
                      style={[styles.toggleOption, notificationsEnabled && styles.toggleOptionActive]}
                      onPress={() => handleToggleNotifications(true)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: notificationsEnabled }}
                      accessibilityLabel="Notifications on"
                    >
                      <Text style={[styles.toggleOptionText, notificationsEnabled && styles.toggleOptionTextActive]}>On</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleOption, !notificationsEnabled && styles.toggleOptionActive]}
                      onPress={() => handleToggleNotifications(false)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: !notificationsEnabled }}
                      accessibilityLabel="Notifications off"
                    >
                      <Text style={[styles.toggleOptionText, !notificationsEnabled && styles.toggleOptionTextActive]}>Off</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Per-category toggles — dimmed when global is off */}
                <View style={[styles.categorySection, !notificationsEnabled && styles.categorySectionDisabled]}>
                  {/* Activity group */}
                  <Text variant="caption" color="textSecondary" style={styles.categoryGroupLabel}>Activity</Text>
                  {([
                    { label: 'PRs & records', col: 'push_prs', val: pushPrs, setter: setPushPrs },
                    { label: 'Achievements & streaks', col: 'push_achievements', val: pushAchievements, setter: setPushAchievements },
                    { label: 'Level ups', col: 'push_level_up', val: pushLevelUp, setter: setPushLevelUp },
                    { label: 'Challenges & leaderboard', col: 'push_challenge_rank', val: pushChallengeRank, setter: setPushChallengeRank },
                  ] as { label: string; col: string; val: boolean; setter: (v: boolean) => void }[]).map((item) => (
                    <TouchableOpacity
                      key={item.col}
                      style={styles.categoryRow}
                      onPress={() => {
                        if (!notificationsEnabled) return;
                        handleTogglePushCategory(item.col, !item.val, item.setter);
                      }}
                      disabled={!notificationsEnabled}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: item.val, disabled: !notificationsEnabled }}
                      accessibilityLabel={item.label}
                    >
                      <Text variant="caption" style={[styles.categoryLabel, !notificationsEnabled && { color: colors.textDisabled }]}>
                        {item.label}
                      </Text>
                      <View style={[styles.categoryToggle, item.val && styles.categoryToggleActive]}>
                        <Text style={[styles.toggleOptionText, item.val && styles.toggleOptionTextActive, { fontSize: 11 }]}>
                          {item.val ? 'On' : 'Off'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* Coaching group */}
                  <Text variant="caption" color="textSecondary" style={[styles.categoryGroupLabel, { marginTop: spacing.md }]}>Coaching</Text>
                  {([
                    { label: 'Trainer notes & check-ins', col: 'push_trainer_note', val: pushTrainerNote, setter: setPushTrainerNote },
                    { label: 'New programs', col: 'push_new_program', val: pushNewProgram, setter: setPushNewProgram },
                  ] as { label: string; col: string; val: boolean; setter: (v: boolean) => void }[]).map((item) => (
                    <TouchableOpacity
                      key={item.col}
                      style={styles.categoryRow}
                      onPress={() => {
                        if (!notificationsEnabled) return;
                        handleTogglePushCategory(item.col, !item.val, item.setter);
                      }}
                      disabled={!notificationsEnabled}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: item.val, disabled: !notificationsEnabled }}
                      accessibilityLabel={item.label}
                    >
                      <Text variant="caption" style={[styles.categoryLabel, !notificationsEnabled && { color: colors.textDisabled }]}>
                        {item.label}
                      </Text>
                      <View style={[styles.categoryToggle, item.val && styles.categoryToggleActive]}>
                        <Text style={[styles.toggleOptionText, item.val && styles.toggleOptionTextActive, { fontSize: 11 }]}>
                          {item.val ? 'On' : 'Off'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* Social group */}
                  <Text variant="caption" color="textSecondary" style={[styles.categoryGroupLabel, { marginTop: spacing.md }]}>Social</Text>
                  <TouchableOpacity
                    style={styles.categoryRow}
                    onPress={() => {
                      if (!notificationsEnabled) return;
                      handleTogglePushCategory('push_gym_feed', !pushGymFeed, setPushGymFeed);
                    }}
                    disabled={!notificationsEnabled}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: pushGymFeed, disabled: !notificationsEnabled }}
                    accessibilityLabel="Gym feed activity"
                  >
                    <Text variant="caption" style={[styles.categoryLabel, !notificationsEnabled && { color: colors.textDisabled }]}>
                      Gym feed activity
                    </Text>
                    <View style={[styles.categoryToggle, pushGymFeed && styles.categoryToggleActive]}>
                      <Text style={[styles.toggleOptionText, pushGymFeed && styles.toggleOptionTextActive, { fontSize: 11 }]}>
                        {pushGymFeed ? 'On' : 'Off'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Quiet Hours */}
                  <Text variant="caption" color="textSecondary" style={[styles.categoryGroupLabel, { marginTop: spacing.md }]}>Quiet Hours</Text>
                  <Text variant="caption" style={styles.quietHoursNote}>
                    Quiet hours use UTC for now
                  </Text>
                  <TouchableOpacity
                    style={styles.categoryRow}
                    onPress={() => {
                      if (!notificationsEnabled) return;
                      const newVal = !quietHoursEnabled;
                      setQuietHoursEnabled(newVal);
                      handleUpsertQuietHours({ quiet_hours_enabled: newVal });
                    }}
                    disabled={!notificationsEnabled}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: quietHoursEnabled, disabled: !notificationsEnabled }}
                    accessibilityLabel="Enable quiet hours"
                  >
                    <Text variant="caption" style={[styles.categoryLabel, !notificationsEnabled && { color: colors.textDisabled }]}>
                      Enable quiet hours
                    </Text>
                    <View style={[styles.categoryToggle, quietHoursEnabled && styles.categoryToggleActive]}>
                      <Text style={[styles.toggleOptionText, quietHoursEnabled && styles.toggleOptionTextActive, { fontSize: 11 }]}>
                        {quietHoursEnabled ? 'On' : 'Off'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {quietHoursEnabled && notificationsEnabled && (
                    <View style={styles.quietHoursTimeRow}>
                      <View style={styles.quietHoursTimeBlock}>
                        <Text variant="caption" color="textSecondary" style={styles.quietHoursTimeLabel}>From</Text>
                        <TouchableOpacity
                          style={styles.timeChip}
                          onPress={() =>
                            Alert.alert(
                              'Start Hour (UTC)',
                              'Select the hour when quiet hours begin',
                              HOUR_OPTIONS.map((h) => ({
                                text: h,
                                onPress: () => {
                                  const val = `${h}:00:00`;
                                  setQuietHoursStart(val);
                                  handleUpsertQuietHours({ quiet_hours_start: val });
                                },
                              })).concat([{ text: 'Cancel', onPress: () => {} }]),
                            )
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Quiet hours start: ${quietHoursStart}`}
                        >
                          <Text variant="caption" style={styles.timeChipText}>
                            {quietHoursStart.slice(0, 5)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.quietHoursTimeBlock}>
                        <Text variant="caption" color="textSecondary" style={styles.quietHoursTimeLabel}>Until</Text>
                        <TouchableOpacity
                          style={styles.timeChip}
                          onPress={() =>
                            Alert.alert(
                              'End Hour (UTC)',
                              'Select the hour when quiet hours end',
                              HOUR_OPTIONS.map((h) => ({
                                text: h,
                                onPress: () => {
                                  const val = `${h}:00:00`;
                                  setQuietHoursEnd(val);
                                  handleUpsertQuietHours({ quiet_hours_end: val });
                                },
                              })).concat([{ text: 'Cancel', onPress: () => {} }]),
                            )
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Quiet hours end: ${quietHoursEnd}`}
                        >
                          <Text variant="caption" style={styles.timeChipText}>
                            {quietHoursEnd.slice(0, 5)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </>
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
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={opt.label}
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
      </KeyboardAvoidingView>
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarTouchable: {
    position: 'relative',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.white,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
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
  // Per-category notification toggles
  categorySection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  categorySectionDisabled: {
    opacity: 0.5,
  },
  categoryGroupLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  categoryLabel: {
    flex: 1,
    marginRight: spacing.sm,
  },
  categoryToggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: 36,
    alignItems: 'center',
  },
  categoryToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  // Quiet hours
  quietHoursNote: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: spacing.xs,
    fontStyle: 'italic',
  },
  quietHoursTimeRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
  quietHoursTimeBlock: {
    alignItems: 'flex-start',
  },
  quietHoursTimeLabel: {
    marginBottom: spacing.xs,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  timeChipText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});
