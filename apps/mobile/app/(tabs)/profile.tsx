import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';

const WEIGHT_UNIT_KEY = 'smartgym_weight_unit';

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

      // Fetch profile from profiles table
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

      // Load weight unit preference
      const savedUnit = await AsyncStorage.getItem(WEIGHT_UNIT_KEY);
      if (savedUnit === 'kg' || savedUnit === 'lbs') {
        setWeightUnit(savedUnit);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
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

  const handleToggleWeightUnit = async () => {
    const newUnit = weightUnit === 'kg' ? 'lbs' : 'kg';
    setWeightUnit(newUnit);
    await AsyncStorage.setItem(WEIGHT_UNIT_KEY, newUnit);
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

  // ─── Render: Loading ──────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // ─── Render: Not Signed In ────────────────────────────

  if (!profile) {
    return (
      <View style={styles.centered}>
        <View style={styles.signInCard}>
          <Text style={styles.signInTitle}>Sign In to SmartGym</Text>
          <Text style={styles.signInSubtitle}>
            Sign in to track your workouts, view your progress, and manage your
            profile.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/auth')}
          >
            <Text style={styles.primaryButtonText}>Sign In / Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Render: Signed In ────────────────────────────────

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Avatar + Basic Info */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{getInitials(profile.full_name)}</Text>
        </View>
        <Text style={styles.profileName}>
          {profile.full_name || 'No Name Set'}
        </Text>
        <Text style={styles.profileEmail}>{profile.email}</Text>
      </View>

      {/* Edit Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Edit Profile</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Full Name</Text>
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
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveName}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelEditName}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.fieldRow} onPress={startEditName}>
              <Text style={styles.fieldValue}>
                {profile.full_name || 'Tap to set name'}
              </Text>
              <Text style={styles.editIndicator}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Weight Unit</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  weightUnit === 'kg' && styles.toggleOptionActive,
                ]}
                onPress={() => {
                  if (weightUnit !== 'kg') handleToggleWeightUnit();
                }}
              >
                <Text
                  style={[
                    styles.toggleOptionText,
                    weightUnit === 'kg' && styles.toggleOptionTextActive,
                  ]}
                >
                  kg
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  weightUnit === 'lbs' && styles.toggleOptionActive,
                ]}
                onPress={() => {
                  if (weightUnit !== 'lbs') handleToggleWeightUnit();
                }}
              >
                <Text
                  style={[
                    styles.toggleOptionText,
                    weightUnit === 'lbs' && styles.toggleOptionTextActive,
                  ]}
                >
                  lbs
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  // ─── Sign In Card ──────────────────────────────────────
  signInCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    width: '100%',
  },
  signInTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 8,
  },
  signInSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  // ─── Avatar ────────────────────────────────────────────
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  // ─── Sections ──────────────────────────────────────────
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // ─── Edit Profile ─────────────────────────────────────
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  editIndicator: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 12,
  },
  editRow: {
    gap: 12,
  },
  editInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    minHeight: 40,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  // ─── Preferences ───────────────────────────────────────
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preferenceLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 3,
  },
  toggleOption: {
    paddingHorizontal: 18,
    paddingVertical: 8,
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
  // ─── Account ───────────────────────────────────────────
  signOutButton: {
    backgroundColor: colors.error,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  // ─── Buttons ───────────────────────────────────────────
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    width: '100%',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  // ─── Error ─────────────────────────────────────────────
  errorBanner: {
    backgroundColor: '#fce4e6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
});
