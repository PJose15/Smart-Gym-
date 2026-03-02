import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  TouchableOpacity,
  Animated as RNAnimated,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/lib/supabase';
import { getWeightUnit, saveWeightUnit } from '../../src/lib/weightUnit';
import { getPointsSummary, formatPointsReason } from '../../src/lib/pointsService';
import type { PointsEntry } from '../../src/lib/pointsService';
import { getStreak } from '../../src/lib/streakService';
import type { StreakResult } from '../../src/lib/streakService';
import { getBadges, RARITY_COLORS, RARITY_LABELS } from '../../src/lib/badgeService';
import { isFeatureEnabled, needsRefresh, refreshFeatureFlags } from '../../src/lib/featureFlags';
import { unregisterPushToken } from '../../src/lib/notificationService';
import { Button, Text, Card } from '../../src/components';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { SkeletonGate, ProfileScreenSkeleton } from '../../src/components/skeleton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import type { UserGoal, ExperienceLevel, WeightUnit, BadgeWithStatus } from '@smartgym/types';

// ─── Constants ──────────────────────────────────────────

const TRAINING_PROFILE_CACHE_KEY = '@smartgym:training_profile';

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

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

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

// ─── Breathing Animation Card ───────────────────────────

const ND = Platform.OS !== 'web';

function BreathingCard({ children }: { children: React.ReactNode }) {
  const scale = useRef(new RNAnimated.Value(0.9)).current;
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const breathe = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(scale, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: ND,
      }),
      RNAnimated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: ND,
      }),
    ]).start();

    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(breathe, {
          toValue: 1.02,
          duration: 1800,
          useNativeDriver: ND,
        }),
        RNAnimated.timing(breathe, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: ND,
        }),
      ]),
    ).start();
  }, []);

  const combinedScale = RNAnimated.multiply(scale, breathe);

  return (
    <RNAnimated.View style={{
      opacity,
      transform: [{ scale: combinedScale }],
      width: '100%',
    }}>
      {children}
    </RNAnimated.View>
  );
}

// ─── Screen ─────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [error, setError] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [pointsEntries, setPointsEntries] = useState<PointsEntry[]>([]);
  const [gymId, setGymId] = useState<string | null>(null);
  const [trainingProfile, setTrainingProfile] = useState<TrainingProfileState>(DEFAULT_TRAINING_PROFILE);
  const [showTrainingProfile, setShowTrainingProfile] = useState(false);
  const [streak, setStreak] = useState<StreakResult | null>(null);
  const [badges, setBadges] = useState<BadgeWithStatus[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<BadgeWithStatus | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);

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

      // Refresh feature flags if stale
      if (needsRefresh()) {
        await refreshFeatureFlags();
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

      // Load points ledger
      const { data: memberData } = await supabase
        .from('gym_members')
        .select('gym_id')
        .eq('profile_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberData?.gym_id) {
        setGymId(memberData.gym_id);
        try {
          const summary = await getPointsSummary(user.id, memberData.gym_id);
          setTotalPoints(summary.total);
          setPointsEntries(summary.entries.slice(0, 5));
        } catch {
          // Points are non-critical — ignore errors
        }

        // Load streak data
        if (isFeatureEnabled('streaks_enabled')) {
          try {
            const streakData = await getStreak(user.id, memberData.gym_id);
            setStreak(streakData);
          } catch {
            // Non-critical
          }
        }

        // Load badges
        if (isFeatureEnabled('badges_enabled')) {
          try {
            const badgeData = await getBadges(user.id, memberData.gym_id);
            setBadges(badgeData);
          } catch {
            // Non-critical
          }
        }

        // Load training profile (check cache first)
        const profileEnabled = isFeatureEnabled('training_profile_enabled');
        setShowTrainingProfile(profileEnabled);

        if (profileEnabled) {
          await loadTrainingProfile(user.id, memberData.gym_id);
        }

        // Load notification preferences
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
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrainingProfile = async (userId: string, currentGymId: string) => {
    try {
      // Try local cache first
      const cached = await AsyncStorage.getItem(TRAINING_PROFILE_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as TrainingProfileState;
          setTrainingProfile(parsed);
        } catch {
          await AsyncStorage.removeItem(TRAINING_PROFILE_CACHE_KEY);
        }
      }

      // Then fetch from server
      const { data } = await supabase
        .from('user_training_profiles')
        .select('goal, experience, units, preferred_rep_min, preferred_rep_max, limitations')
        .eq('profile_id', userId)
        .eq('gym_id', currentGymId)
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
    } catch {
      // Non-critical
    }
  };

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

  const handleToggleWeightUnit = async (newUnit: WeightUnit) => {
    setWeightUnit(newUnit);
    await saveWeightUnit(newUnit);
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    if (!profile) return;
    try {
      await supabase.from('notification_preferences').upsert(
        {
          profile_id: profile.id,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' },
      );
    } catch {
      setNotificationsEnabled(!enabled);
    }
  };

  const handleSaveTrainingProfile = async () => {
    if (!profile || !gymId) return;

    // Validate rep range
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
            profile_id: profile.id,
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

      // Update local cache
      await AsyncStorage.setItem(TRAINING_PROFILE_CACHE_KEY, JSON.stringify(trainingProfile));

      // Also sync weight unit
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
    return <SkeletonGate loading={true} skeleton={<ProfileScreenSkeleton />}><View /></SkeletonGate>;
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <BreathingCard>
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
        </BreathingCard>
      </View>
    );
  }

  return (
    <AnimatedScreen>
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

      {streak && streak.currentStreak > 0 && (
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>Streak</Text>
          <Card style={styles.streakCard}>
            <View style={styles.streakRow}>
              <Text style={styles.streakFlame}>{'\uD83D\uDD25'}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="heading" style={styles.streakCount}>
                  {streak.currentStreak} week{streak.currentStreak !== 1 ? 's' : ''}
                </Text>
                <Text variant="caption" color="textSecondary">
                  Longest: {streak.longestStreak} week{streak.longestStreak !== 1 ? 's' : ''}
                </Text>
              </View>
              {streak.bonusPoints > 0 && (
                <View style={styles.streakBonusBadge}>
                  <Text style={styles.streakBonusText}>+{streak.bonusPoints}</Text>
                </View>
              )}
            </View>
            {!streak.currentWeekActive && (
              <Text variant="caption" style={styles.streakNudge}>
                Work out this week to keep your streak!
              </Text>
            )}
          </Card>
        </View>
      )}

      {badges.length > 0 && (
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
            Badges ({badges.filter((b) => b.unlocked).length}/{badges.length})
          </Text>
          <Card style={styles.card}>
            <View style={styles.badgeGrid}>
              {badges.map((badge) => (
                <TouchableOpacity
                  key={badge.id}
                  style={[styles.badgeCell, !badge.unlocked && styles.badgeLocked]}
                  onPress={() => setSelectedBadge(badge)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.badgeEmoji}>
                    {badge.unlocked ? badge.icon_emoji : '\uD83D\uDD12'}
                  </Text>
                  <Text
                    style={[styles.badgeName, !badge.unlocked && styles.badgeNameLocked]}
                    numberOfLines={1}
                  >
                    {badge.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        </View>
      )}

      {/* Badge Detail Modal */}
      <Modal
        visible={selectedBadge !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBadge(null)}
      >
        <TouchableOpacity
          style={styles.badgeModalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedBadge(null)}
        >
          <View style={styles.badgeModalContent}>
            <Text style={styles.badgeModalEmoji}>
              {selectedBadge?.unlocked ? selectedBadge.icon_emoji : '\uD83D\uDD12'}
            </Text>
            <Text style={styles.badgeModalName}>{selectedBadge?.name}</Text>
            {selectedBadge && (
              <View style={[
                styles.badgeRarityTag,
                { backgroundColor: (RARITY_COLORS[selectedBadge.rarity] ?? '#6c757d') + '20' },
              ]}>
                <Text style={[
                  styles.badgeRarityText,
                  { color: RARITY_COLORS[selectedBadge.rarity] ?? '#6c757d' },
                ]}>
                  {RARITY_LABELS[selectedBadge.rarity] ?? selectedBadge.rarity}
                </Text>
              </View>
            )}
            <Text style={styles.badgeModalDesc}>{selectedBadge?.description}</Text>
            {selectedBadge?.unlocked && selectedBadge.unlocked_at && (
              <Text style={styles.badgeModalDate}>
                Unlocked {new Date(selectedBadge.unlocked_at).toLocaleDateString()}
              </Text>
            )}
            {selectedBadge && !selectedBadge.unlocked && (
              <Text style={styles.badgeModalLocked}>Keep going to unlock this badge!</Text>
            )}
            <TouchableOpacity
              style={styles.badgeModalClose}
              onPress={() => setSelectedBadge(null)}
            >
              <Text style={styles.badgeModalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
          {notificationsLoaded && (
            <View style={[styles.preferenceRow, { marginTop: spacing.md }]}>
              <Text variant="body" style={styles.preferenceLabel}>Notifications</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleOption, notificationsEnabled && styles.toggleOptionActive]}
                  onPress={() => handleToggleNotifications(true)}
                >
                  <Text
                    style={[styles.toggleOptionText, notificationsEnabled && styles.toggleOptionTextActive]}
                  >
                    On
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleOption, !notificationsEnabled && styles.toggleOptionActive]}
                  onPress={() => handleToggleNotifications(false)}
                >
                  <Text
                    style={[styles.toggleOptionText, !notificationsEnabled && styles.toggleOptionTextActive]}
                  >
                    Off
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>
      </View>

      {gymId && (
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>Points</Text>
          <Card style={styles.card}>
            <View style={styles.pointsHeader}>
              <Text variant="heading" style={styles.pointsTotal}>{totalPoints.toLocaleString()}</Text>
              <Text variant="caption" color="textSecondary">total points</Text>
            </View>
            {pointsEntries.length > 0 ? (
              pointsEntries.map((entry) => (
                <View key={entry.id} style={styles.pointsRow}>
                  <Text variant="body" style={styles.pointsReason}>
                    {formatPointsReason(entry.reason)}
                  </Text>
                  <Text variant="label" color="primary">+{entry.points}</Text>
                </View>
              ))
            ) : (
              <Text variant="caption" color="textSecondary" style={styles.pointsEmpty}>
                Complete workouts to earn points!
              </Text>
            )}
          </Card>
        </View>
      )}

      {showTrainingProfile && gymId && (
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
            Training Profile
          </Text>
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
                  <Text
                    style={[
                      styles.chipText,
                      trainingProfile.goal === opt.value && styles.chipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Experience */}
            <Text variant="caption" color="textSecondary" style={[styles.fieldLabel, { marginTop: spacing.md }]}>
              Experience
            </Text>
            <View style={styles.chipRow}>
              {EXPERIENCE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, trainingProfile.experience === opt.value && styles.chipActive]}
                  onPress={() => setTrainingProfile((p) => ({ ...p, experience: opt.value }))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      trainingProfile.experience === opt.value && styles.chipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Units */}
            <Text variant="caption" color="textSecondary" style={[styles.fieldLabel, { marginTop: spacing.md }]}>
              Units
            </Text>
            <View style={styles.chipRow}>
              {(['kg', 'lbs'] as WeightUnit[]).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.chip, trainingProfile.units === u && styles.chipActive]}
                  onPress={() => setTrainingProfile((p) => ({ ...p, units: u }))}
                >
                  <Text
                    style={[styles.chipText, trainingProfile.units === u && styles.chipTextActive]}
                  >
                    {u}
                  </Text>
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
  pointsHeader: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pointsTotal: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 44,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pointsReason: {
    flex: 1,
    marginRight: spacing.sm,
  },
  pointsEmpty: {
    textAlign: 'center',
    paddingVertical: spacing.md,
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
  // Streak styles
  streakCard: {
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b35',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streakFlame: {
    fontSize: 32,
  },
  streakCount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ff6b35',
    lineHeight: 26,
  },
  streakBonusBadge: {
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  streakBonusText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  streakNudge: {
    marginTop: spacing.sm,
    color: '#ff6b35',
    fontStyle: 'italic',
  },
  // Badge styles
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCell: {
    width: '22%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  badgeLocked: {
    opacity: 0.4,
  },
  badgeEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: colors.textSecondary,
  },
  badgeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  badgeModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  badgeModalEmoji: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  badgeModalName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  badgeRarityTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  badgeRarityText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  badgeModalDesc: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  badgeModalDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  badgeModalLocked: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  badgeModalClose: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  badgeModalCloseText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
