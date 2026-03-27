import { useState, useEffect, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { AnimatedScreen } from '../src/components/AnimatedScreen';

type AuthMode = 'login' | 'signup';

// ─── Feature highlights ───────────────────────────────
const FEATURES = [
  { icon: '\uD83D\uDCF1', label: 'Scan machines' },
  { icon: '\uD83E\uDDE0', label: 'AI form tips' },
  { icon: '\uD83D\uDCC8', label: 'Track progress' },
];

// ─── Motivational welcome messages ────────────────────
const LOGIN_MESSAGES = [
  'Welcome back — let\'s pick up where you left off.',
  'Ready to crush another session?',
  'Your gains are waiting.',
  'Time to get after it.',
];

const SIGNUP_MESSAGES = [
  'Start training smarter today.',
  'Your AI-powered gym companion awaits.',
  'Join the smart way to train.',
  'Every rep counts — let\'s track them.',
];

// ─── Password strength ───────────────────────────────
type PasswordStrength = 'weak' | 'fair' | 'strong';

function getPasswordStrength(pw: string): { level: PasswordStrength; score: number } {
  if (pw.length === 0) return { level: 'weak', score: 0 };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { level: 'weak', score: Math.min(0.33, score / 5) };
  if (score <= 3) return { level: 'fair', score: 0.6 };
  return { level: 'strong', score: 1 };
}

const STRENGTH_COLORS: Record<PasswordStrength, string> = {
  weak: colors.error,
  fair: '#e9c46a',
  strong: colors.success,
};

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animated brand icon
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 40,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Motivational message based on day
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
  );
  const loginMsg = LOGIN_MESSAGES[dayOfYear % LOGIN_MESSAGES.length];
  const signupMsg = SIGNUP_MESSAGES[dayOfYear % SIGNUP_MESSAGES.length];

  const passwordStrength = getPasswordStrength(password);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;
      }

      router.replace('/(tabs)' as const);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    setError(null);
  };

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
        {/* ─── Brand header ──────────────────────── */}
        <View style={styles.header}>
          <Animated.View style={[styles.brandIcon, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}>
            <Text style={styles.brandEmoji}>{'\uD83C\uDFCB\uFE0F'}</Text>
          </Animated.View>
          <Text style={styles.title}>Nexera</Text>
          <Text style={styles.tagline}>
            {mode === 'login' ? loginMsg : signupMsg}
          </Text>
        </View>

        {/* ─── Feature pills ─────────────────────── */}
        <View style={styles.featureRow}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featurePill}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* ─── Form ──────────────────────────────── */}
        <View style={styles.form}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {mode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textSecondary}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
                editable={!loading}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              editable={!loading}
            />
            {/* Password strength indicator (signup only) */}
            {mode === 'signup' && password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBarBg}>
                  <View
                    style={[
                      styles.strengthBarFill,
                      {
                        width: `${passwordStrength.score * 100}%`,
                        backgroundColor: STRENGTH_COLORS[passwordStrength.level],
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.strengthLabel, { color: STRENGTH_COLORS[passwordStrength.level] }]}
                >
                  {passwordStrength.level}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={toggleMode}
            disabled={loading}
          >
            <Text style={styles.toggleText}>
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  // ─── Brand header ─────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brandIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  brandEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: spacing.md,
  },
  // ─── Feature pills ────────────────────────────────
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  featureIcon: {
    fontSize: 14,
  },
  featureLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  // ─── Form ─────────────────────────────────────────
  form: {
    width: '100%',
  },
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
  // ─── Password strength ────────────────────────────
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: spacing.sm,
  },
  strengthBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
    width: 44,
  },
  // ─── Buttons ──────────────────────────────────────
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 8,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  toggleButton: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  toggleText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: '#fce4e6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
});
