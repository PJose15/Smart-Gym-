/**
 * Onboarding / Auth Screen — DOC_10 compliant.
 * Multi-step flow: Phone → OTP → Goal → Experience → Done
 * 90-second target from scan to first set.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { AnimatedScreen } from '../src/components/AnimatedScreen';

// ─── Types ────────────────────────────────────────────
type OnboardingStep = 'phone' | 'otp' | 'goal' | 'experience';

type UserGoal = 'strength' | 'hypertrophy' | 'endurance' | 'general';
type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

const GOALS: Array<{ key: UserGoal; icon: string; label: string; sub: string }> = [
  { key: 'hypertrophy', icon: '\uD83D\uDCAA', label: 'Build Muscle', sub: 'Grow size and definition' },
  { key: 'strength', icon: '\uD83C\uDFCB\uFE0F', label: 'Get Stronger', sub: 'Lift heavier, build power' },
  { key: 'endurance', icon: '\uD83C\uDFC3', label: 'Stay Fit', sub: 'Maintain health and endurance' },
  { key: 'general', icon: '\uD83C\uDFAF', label: 'General Fitness', sub: 'All-around improvement' },
];

const EXPERIENCE_LEVELS: Array<{ key: ExperienceLevel; label: string; sub: string }> = [
  { key: 'beginner', label: 'Beginner', sub: 'New to lifting or < 6 months' },
  { key: 'intermediate', label: 'Intermediate', sub: '6 months to 2 years' },
  { key: 'advanced', label: 'Advanced', sub: '2+ years of consistent training' },
];

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();

  const [step, setStep] = useState<OnboardingStep>('phone');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<UserGoal | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReturningMember, setIsReturningMember] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  const animateStepIn = useCallback(() => {
    fadeIn.setValue(0);
    slideUp.setValue(30);
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [fadeIn, slideUp]);

  useEffect(() => {
    animateStepIn();
  }, [step, animateStepIn]);

  // OTP resend cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  // ─── Step 1: Send OTP ──────────────────────────────
  const handleSendOTP = async () => {
    if (otpCooldown > 0) return;

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError('Please enter your phone number.');
      return;
    }
    if (!isReturningMember && !firstName.trim()) {
      setError('Please enter your first name.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: trimmedPhone,
      });

      if (otpError) throw otpError;
      setOtpCooldown(30);
      setStep('otp');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Verify OTP ────────────────────────────
  const handleVerifyOTP = async () => {
    if (otpCode.length < 6) {
      setError('Please enter the 6-digit code.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: otpCode,
        type: 'sms',
      });

      if (verifyError) throw verifyError;

      // Update profile with first name
      if (!isReturningMember && firstName.trim()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').upsert({
            id: user.id,
            full_name: firstName.trim(),
          });
        }
      }

      // Returning members skip intake
      if (isReturningMember) {
        router.replace(params.returnTo ? (params.returnTo as `/${string}`) : '/(tabs)');
        return;
      }

      setStep('goal');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 3: Save goal ─────────────────────────────
  const handleGoalSelect = (goal: UserGoal) => {
    setSelectedGoal(goal);
    setStep('experience');
  };

  // ─── Step 4: Save experience & complete ────────────
  const handleExperienceSelect = async (exp: ExperienceLevel) => {
    setSelectedExperience(exp);

    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get gym from membership
      const { data: memberData } = await supabase
        .from('gym_members')
        .select('gym_id')
        .eq('profile_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberData?.gym_id) {
        await supabase.from('user_training_profiles').upsert({
          profile_id: user.id,
          gym_id: memberData.gym_id,
          goal: selectedGoal || 'general',
          experience: exp,
        });

        // Mark onboarding complete
        await supabase.from('gym_members')
          .update({ onboarding_status: 'active' })
          .eq('profile_id', user.id)
          .eq('gym_id', memberData.gym_id);
      }

      router.replace(params.returnTo ? (params.returnTo as `/${string}`) : '/(tabs)');
    } catch (err: unknown) {
      // Non-blocking — still navigate even if profile save fails
      console.warn('[onboarding] profile save failed:', err);
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  // ─── Progress dots ─────────────────────────────────
  const steps: OnboardingStep[] = isReturningMember ? ['phone', 'otp'] : ['phone', 'otp', 'goal', 'experience'];
  const stepIndex = steps.indexOf(step);

  return (
    <AnimatedScreen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Progress indicator */}
          <View style={styles.progressRow}>
            {steps.map((s, i) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  i <= stepIndex && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>

            {/* ─── STEP 1: Phone ────────────────── */}
            {step === 'phone' && (
              <View style={styles.stepContent}>
                <Text style={styles.stepHeading}>
                  {isReturningMember ? 'Welcome back.' : 'Let\'s get you set up.'}
                </Text>
                <Text style={styles.stepSubheading}>
                  {isReturningMember
                    ? 'Enter your phone to sign back in.'
                    : 'Under a minute — then you\'re training.'}
                </Text>

                {!isReturningMember && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>First name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Your first name"
                      placeholderTextColor={colors.textMuted}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      autoComplete="given-name"
                      autoFocus
                      editable={!loading}
                    />
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+1 (555) 000-0000"
                    placeholderTextColor={colors.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    autoFocus={isReturningMember}
                    editable={!loading}
                  />
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.disabledBtn]}
                  onPress={handleSendOTP}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Continue →</Text>
                  )}
                </TouchableOpacity>

                {!isReturningMember && (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setIsReturningMember(true)}
                  >
                    <Text style={styles.secondaryBtnText}>Already a member? Sign in</Text>
                  </TouchableOpacity>
                )}
                {isReturningMember && (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setIsReturningMember(false)}
                  >
                    <Text style={styles.secondaryBtnText}>New here? Create account</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ─── STEP 2: OTP Verify ──────────── */}
            {step === 'otp' && (
              <View style={styles.stepContent}>
                <Text style={styles.stepHeading}>Enter your code.</Text>
                <Text style={styles.stepSubheading}>
                  We sent a 6-digit code to {phone}.
                </Text>

                <View style={styles.otpContainer}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="000000"
                    placeholderTextColor={colors.textMuted}
                    value={otpCode}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(cleaned);
                      // Auto-submit on 6 digits
                      if (cleaned.length === 6) {
                        setTimeout(() => handleVerifyOTP(), 100);
                      }
                    }}
                    keyboardType="number-pad"
                    autoFocus
                    maxLength={6}
                    editable={!loading}
                  />
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.disabledBtn]}
                  onPress={handleVerifyOTP}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify →</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryBtn, otpCooldown > 0 && styles.disabledBtn]}
                  onPress={handleSendOTP}
                  disabled={otpCooldown > 0 || loading}
                >
                  <Text style={styles.secondaryBtnText}>
                    {otpCooldown > 0 ? `Resend code in ${otpCooldown}s` : 'Resend code'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => { setStep('phone'); setOtpCode(''); setError(null); }}
                >
                  <Text style={styles.secondaryBtnText}>Change phone number</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── STEP 3: Goal ────────────────── */}
            {step === 'goal' && (
              <View style={styles.stepContent}>
                <Text style={styles.stepHeading}>What's your goal?</Text>
                <Text style={styles.stepSubheading}>
                  This helps us personalize your experience.
                </Text>

                <View style={styles.optionList}>
                  {GOALS.map((g) => (
                    <TouchableOpacity
                      key={g.key}
                      style={[
                        styles.optionCard,
                        selectedGoal === g.key && styles.optionCardSelected,
                      ]}
                      onPress={() => handleGoalSelect(g.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.optionIcon}>{g.icon}</Text>
                      <View style={styles.optionText}>
                        <Text style={styles.optionLabel}>{g.label}</Text>
                        <Text style={styles.optionSub}>{g.sub}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ─── STEP 4: Experience ──────────── */}
            {step === 'experience' && (
              <View style={styles.stepContent}>
                <Text style={styles.stepHeading}>Experience level?</Text>
                <Text style={styles.stepSubheading}>
                  We'll adjust suggestions to match your level.
                </Text>

                <View style={styles.optionList}>
                  {EXPERIENCE_LEVELS.map((e) => (
                    <TouchableOpacity
                      key={e.key}
                      style={[
                        styles.optionCard,
                        selectedExperience === e.key && styles.optionCardSelected,
                      ]}
                      onPress={() => handleExperienceSelect(e.key)}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionText}>
                        <Text style={styles.optionLabel}>{e.label}</Text>
                        <Text style={styles.optionSub}>{e.sub}</Text>
                      </View>
                      {loading && selectedExperience === e.key && (
                        <ActivityIndicator color={colors.primary} size="small" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AnimatedScreen>
  );
}

// ─── Styles ──────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  // Progress
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  // Step content
  stepContent: {
    flex: 1,
  },
  stepHeading: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  stepSubheading: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  // Inputs
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  // OTP
  otpContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  otpInput: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 12,
    width: '100%',
    maxWidth: 280,
  },
  // Options (goal / experience)
  optionList: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 18,
    gap: 16,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  optionIcon: {
    fontSize: 28,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  optionSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Buttons
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginTop: 8,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  secondaryBtn: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
});
