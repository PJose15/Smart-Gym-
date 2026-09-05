import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { parseQrCode } from '@nexera/utils';
import { Button, Text } from '../../src/components';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { supabase } from '../../src/lib/supabase';
import { getMemberId } from '../../src/lib/memberData';
import { trackEvent } from '../../src/lib/events';
import { deduper } from '../../src/lib/requestDeduper';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

// Viewfinder geometry (Stitch scan-machine reticle)
const RETICLE_SIZE = 250;
const RETICLE_INSET = 20;
const LASER_TRAVEL = RETICLE_SIZE - RETICLE_INSET * 2 - 2;

// ─── Types ─────────────────────────────────────────────
interface RecentMachine {
  machine_id: string;
  qr_slug: string;
  machine_name: string;
  muscle_groups: string[];
  last_used: string; // session_date (YYYY-MM-DD)
}

interface TodayProgramMachine {
  exercise_name: string;
  machine_name: string;
  qr_slug: string;
}

// ─── Scan Tips ─────────────────────────────────────────
const SCAN_TIPS = [
  'Hold your phone 6-8 inches from the QR code for the fastest scan.',
  'Each machine has a unique QR code — scan it to get personalized form tips.',
  'Scanning logs which machines you use, building your training profile over time.',
  'After scanning, you\'ll see setup steps, safety cues, and your personal history.',
  'Can\'t find the QR code? Check the front panel or the weight stack frame.',
  'Scanning before your set helps Nexera suggest your next weight and reps.',
  'Your scan history powers smarter rest-day and recovery recommendations.',
];

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enrichment state
  const [recentMachines, setRecentMachines] = useState<RecentMachine[]>([]);
  const [programMachine, setProgramMachine] = useState<TodayProgramMachine | null>(null);
  const [scanCountToday, setScanCountToday] = useState(0);
  const [totalUniqueMachines, setTotalUniqueMachines] = useState(0);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState(false);
  const mountedRef = useRef(true);

  // Animated scan frame pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Animated crimson laser line sweeping the viewfinder
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    const laserLoop = Animated.loop(
      Animated.timing(laserAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    );
    laserLoop.start();

    return () => {
      loop.stop();
      laserLoop.stop();
    };
  }, [pulseAnim, laserAnim]);

  const laserTranslate = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, LASER_TRAVEL],
  });
  const laserOpacity = laserAnim.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset scan state every time the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setError(null);
      deduper.clear('scan:context');
      deduper.dedupe('scan:context', loadContext).catch(() => {});
    }, []),
  );

  async function loadContext() {
    setContextError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mountedRef.current) return;

      // workout_sessions is keyed by members.id, not the auth user id
      const memberId = await getMemberId(user.id);
      if (!mountedRef.current) return;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [recentResult, scanCountResult, uniqueResult, programResult] = await Promise.all([
        // 1. Recently used machines (last 5 unique)
        memberId
          ? supabase
              .from('workout_sessions')
              .select('machine_id, session_date, machines!inner(qr_slug, name, muscle_groups)')
              .eq('member_id', memberId)
              .not('machine_id', 'is', null)
              .not('completed_at', 'is', null)
              .order('session_date', { ascending: false })
              .limit(20)
          : Promise.resolve({ data: null }),

        // 2. Scan count today
        supabase
          .from('app_events')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', user.id)
          .eq('event_name', 'qr_scanned')
          .gte('created_at', todayStart.toISOString()),

        // 3. Total unique machines ever used
        memberId
          ? supabase
              .from('workout_sessions')
              .select('machine_id')
              .eq('member_id', memberId)
              .not('machine_id', 'is', null)
              .limit(1000)
          : Promise.resolve({ data: null }),

        // 4. Today's program machine (if assigned)
        loadProgramMachine(memberId),
      ]);

      if (!mountedRef.current) return;

      // Deduplicate recent machines by machine_id, keep most recent
      if (recentResult.data) {
        const seen = new Set<string>();
        const deduped: RecentMachine[] = [];
        for (const row of recentResult.data as any[]) {
          const mid = row.machine_id;
          if (!mid || seen.has(mid)) continue;
          seen.add(mid);
          deduped.push({
            machine_id: mid,
            qr_slug: row.machines?.qr_slug ?? mid,
            machine_name: row.machines?.name ?? 'Machine',
            muscle_groups: row.machines?.muscle_groups ?? [],
            last_used: row.session_date ?? '',
          });
          if (deduped.length >= 5) break;
        }
        setRecentMachines(deduped);
      }

      setScanCountToday(scanCountResult.count ?? 0);

      // Count unique machine IDs
      if (uniqueResult.data) {
        const uniqueIds = new Set((uniqueResult.data as any[]).map((r) => r.machine_id));
        setTotalUniqueMachines(uniqueIds.size);
      }

      setProgramMachine(programResult);
    } catch (err) {
      console.warn('[scan] context load failed:', err);
      if (mountedRef.current) setContextError(true);
    } finally {
      if (mountedRef.current) setLoadingContext(false);
    }
  }

  async function loadProgramMachine(memberId: string | null): Promise<TodayProgramMachine | null> {
    try {
      if (!memberId) return null;

      // Get active AI program
      const { data: activeProgram } = await supabase
        .from('ai_programs')
        .select('program_data, created_at, sessions_per_week')
        .eq('member_id', memberId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeProgram?.program_data) return null;

      const days = (activeProgram.program_data as any)?.days ?? [];
      if (days.length === 0) return null;

      // Determine today's day in the cycle
      const assignedDate = new Date(activeProgram.created_at);
      const daysSinceAssigned = Math.floor((Date.now() - assignedDate.getTime()) / (1000 * 60 * 60 * 24));
      const todayIndex = daysSinceAssigned % days.length;
      const todayDay = days[todayIndex];

      const exercises = todayDay?.exercises ?? [];
      if (exercises.length === 0) return null;

      const ex = exercises[0];
      // If exercise has a machine_id, look up the machine details
      if (ex.machine_id) {
        const { data: machine } = await supabase
          .from('machines')
          .select('name, qr_slug')
          .eq('id', ex.machine_id)
          .maybeSingle();

        return {
          exercise_name: ex.exercise_name ?? 'Unknown',
          machine_name: machine?.name ?? ex.exercise_name ?? 'Unknown',
          qr_slug: machine?.qr_slug ?? '',
        };
      }

      return {
        exercise_name: ex.exercise_name ?? 'Unknown',
        machine_name: ex.exercise_name ?? 'Unknown',
        qr_slug: '',
      };
    } catch {
      return null;
    }
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const slug = parseQrCode(data);
    if (slug) {
      trackEvent('qr_scanned', { slug });
      router.push(`/machine/${slug}`);
    } else {
      setError('Invalid QR code. Please scan a Nexera machine QR code.');
    }
  };

  // Scan tip based on day
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
  );
  const todayTip = SCAN_TIPS[dayOfYear % SCAN_TIPS.length];

  function timeSince(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  }

  // ─── Permission: loading ────────────────────────────
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text variant="body" color="textSecondary">
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  // ─── Permission: denied ─────────────────────────────
  if (!permission.granted) {
    return (
      <AnimatedScreen>
        <ScrollView
          style={styles.permissionScroll}
          contentContainerStyle={styles.permissionScrollContent}
        >
          <View style={styles.permissionContainer}>
            <Text variant="heading" style={styles.permissionTitle}>
              Camera Access Required
            </Text>
            <Text variant="body" color="textSecondary" style={styles.message}>
              Nexera needs your camera to scan QR codes on gym machines.
            </Text>
            <Button title="Grant Permission" onPress={requestPermission} />
          </View>

          {/* Show enrichments even without camera permission */}
          {!loadingContext && recentMachines.length > 0 && (
            <AnimatedCard index={0} style={styles.enrichmentCard}>
              <Text variant="subheading" style={styles.sectionTitle}>
                Recently Used Machines
              </Text>
              <Text variant="caption" color="textSecondary" style={styles.sectionSubtitle}>
                Tap to go directly — no scan needed
              </Text>
              {recentMachines.map((m) => (
                <TouchableOpacity
                  key={m.machine_id}
                  style={styles.recentRow}
                  onPress={() => router.push(`/machine/${m.qr_slug}` as any)}
                >
                  <View style={styles.recentInfo}>
                    <Text variant="body" style={styles.recentName}>{m.machine_name}</Text>
                    <Text variant="caption" color="textSecondary">
                      {m.muscle_groups.slice(0, 2).join(', ')}
                    </Text>
                  </View>
                  <Text variant="caption" color="textSecondary">{timeSince(m.last_used)}</Text>
                </TouchableOpacity>
              ))}
            </AnimatedCard>
          )}

          {/* Tip */}
          <AnimatedCard index={1} style={styles.enrichmentCard}>
            <Text variant="caption" color="textSecondary" style={styles.tipLabel}>
              Did you know?
            </Text>
            <Text variant="body" style={styles.tipText}>{todayTip}</Text>
          </AnimatedCard>
        </ScrollView>
      </AnimatedScreen>
    );
  }

  // ─── Camera active ──────────────────────────────────
  return (
    <View style={styles.cameraContainer}>
      {/* Camera: upper portion */}
      <View style={styles.cameraSection}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        >
          <View style={styles.overlay}>
            <LinearGradient
              colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0)']}
              style={styles.topGradient}
              pointerEvents="none"
            />
            <Text style={styles.scanHeaderLabel}>SCAN MACHINE</Text>

            {/* Viewfinder: crimson corner brackets + hairline frame + laser sweep */}
            <Animated.View
              style={[styles.reticle, { transform: [{ scale: pulseAnim }] }]}
            >
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <View style={styles.innerFrame}>
                <Animated.View
                  style={[
                    styles.laser,
                    { opacity: laserOpacity, transform: [{ translateY: laserTranslate }] },
                  ]}
                />
              </View>
            </Animated.View>

            <Text style={styles.scanningLabel}>SCANNING…</Text>
            <Text variant="body" color="white" style={styles.hint}>
              Point at a machine QR code
            </Text>
          </View>
        </CameraView>
      </View>

      {/* Bottom context panel */}
      {Platform.OS === 'ios' ? (
        <BlurView tint="dark" intensity={60} style={styles.bottomPanel}>
          <LinearGradient
            colors={[colors.primaryLight, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.panelRibbon}
            pointerEvents="none"
          />
          <ScrollView
            horizontal={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.bottomPanelContent}
          >
          {/* 1. Scan Stats Strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statPill}>
              <Text variant="label" style={styles.statValue}>{scanCountToday}</Text>
              <Text variant="caption" color="textSecondary" style={styles.statLabel}>scans today</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statPill}>
              <Text variant="label" style={styles.statValue}>{totalUniqueMachines}</Text>
              <Text variant="caption" color="textSecondary" style={styles.statLabel}>machines used</Text>
            </View>
            {loadingContext && (
              <>
                <View style={styles.statDivider} />
                <ActivityIndicator size="small" color={colors.primary} />
              </>
            )}
          </View>

          {/* 2. Today's Program Machine */}
          {programMachine && (
            <TouchableOpacity
              style={styles.programCard}
              onPress={() => {
                if (programMachine.qr_slug) {
                  router.push(`/machine/${programMachine.qr_slug}` as any);
                }
              }}
            >
              <Text variant="caption" color="primary" style={styles.programLabel}>
                Up next in your program
              </Text>
              <Text variant="body" style={styles.programName}>
                {programMachine.machine_name}
              </Text>
              <Text variant="caption" color="textSecondary">
                {programMachine.exercise_name}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3. Recently Used Machines (horizontal) */}
          {recentMachines.length > 0 && (
            <View style={styles.recentSection}>
              <Text variant="caption" color="textSecondary" style={styles.recentLabel}>
                Quick access — recently used
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentScroll}
              >
                {recentMachines.map((m) => (
                  <TouchableOpacity
                    key={m.machine_id}
                    style={styles.recentChip}
                    onPress={() => router.push(`/machine/${m.qr_slug}` as any)}
                  >
                    <Text variant="caption" style={styles.recentChipName} numberOfLines={1}>
                      {m.machine_name}
                    </Text>
                    <Text variant="caption" color="textSecondary" style={styles.recentChipTime}>
                      {timeSince(m.last_used)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 4. Scan Tip */}
          <View style={styles.tipRow}>
            <Text variant="caption" color="textSecondary" style={styles.tipIcon}>
              {'💡'}
            </Text>
            <Text variant="caption" color="textSecondary" style={styles.tipTextSmall}>
              {todayTip}
            </Text>
          </View>
          </ScrollView>
        </BlurView>
      ) : (
        <View style={[styles.bottomPanel, styles.bottomPanelAndroid]}>
          <LinearGradient
            colors={[colors.primaryLight, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.panelRibbon}
            pointerEvents="none"
          />
          <ScrollView
            horizontal={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.bottomPanelContent}
          >
            {/* 1. Scan Stats Strip */}
            <View style={styles.statsStrip}>
              <View style={styles.statPill}>
                <Text variant="label" style={styles.statValue}>{scanCountToday}</Text>
                <Text variant="caption" color="textSecondary" style={styles.statLabel}>scans today</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statPill}>
                <Text variant="label" style={styles.statValue}>{totalUniqueMachines}</Text>
                <Text variant="caption" color="textSecondary" style={styles.statLabel}>machines used</Text>
              </View>
              {loadingContext && (
                <>
                  <View style={styles.statDivider} />
                  <ActivityIndicator size="small" color={colors.primary} />
                </>
              )}
            </View>

            {/* 2. Today's Program Machine */}
            {programMachine && (
              <TouchableOpacity
                style={styles.programCard}
                onPress={() => {
                  if (programMachine.qr_slug) {
                    router.push(`/machine/${programMachine.qr_slug}` as any);
                  }
                }}
              >
                <Text variant="caption" color="primary" style={styles.programLabel}>
                  Up next in your program
                </Text>
                <Text variant="body" style={styles.programName}>
                  {programMachine.machine_name}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {programMachine.exercise_name}
                </Text>
              </TouchableOpacity>
            )}

            {/* 3. Recently Used Machines (horizontal) */}
            {recentMachines.length > 0 && (
              <View style={styles.recentSection}>
                <Text variant="caption" color="textSecondary" style={styles.recentLabel}>
                  Quick access — recently used
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentScroll}
                >
                  {recentMachines.map((m) => (
                    <TouchableOpacity
                      key={m.machine_id}
                      style={styles.recentChip}
                      onPress={() => router.push(`/machine/${m.qr_slug}` as any)}
                    >
                      <Text variant="caption" style={styles.recentChipName} numberOfLines={1}>
                        {m.machine_name}
                      </Text>
                      <Text variant="caption" color="textSecondary" style={styles.recentChipTime}>
                        {timeSince(m.last_used)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 4. Scan Tip */}
            <View style={styles.tipRow}>
              <Text variant="caption" color="textSecondary" style={styles.tipIcon}>
                {'💡'}
              </Text>
              <Text variant="caption" color="textSecondary" style={styles.tipTextSmall}>
                {todayTip}
              </Text>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Error overlay */}
      {error && (
        <View style={styles.errorContainer}>
          <Text variant="body" color="error" style={styles.errorText}>
            {error}
          </Text>
          <Button
            title="Scan Again"
            onPress={() => { setScanned(false); setError(null); }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  // ─── Permission states ─────────────────────────────
  permissionScroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  permissionScrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  permissionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  permissionTitle: {
    marginBottom: spacing.md,
  },
  message: {
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  enrichmentCard: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    marginBottom: 2,
  },
  sectionSubtitle: {
    marginBottom: spacing.sm,
  },
  // ─── Camera layout ─────────────────────────────────
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraSection: {
    flex: 1,
    minHeight: 280,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 96,
  },
  scanHeaderLabel: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    fontSize: typography.labelSize,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    letterSpacing: 3,
  },
  // ─── Viewfinder (Stitch reticle: corner brackets + laser) ───
  reticle: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  innerFrame: {
    position: 'absolute',
    top: RETICLE_INSET,
    left: RETICLE_INSET,
    right: RETICLE_INSET,
    bottom: RETICLE_INSET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    overflow: 'hidden',
  },
  laser: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primaryLight,
    shadowColor: colors.primaryLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  scanningLabel: {
    marginTop: spacing.lg,
    fontSize: typography.tinySize,
    fontFamily: typography.fontSemiBold,
    color: colors.primaryLight,
    letterSpacing: 2.5,
  },
  hint: {
    marginTop: spacing.xs,
    textAlign: 'center',
    fontSize: typography.smallSize,
    color: colors.textSecondary,
  },
  // ─── Bottom context panel ──────────────────────────
  bottomPanel: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    maxHeight: 260,
    paddingTop: spacing.md,
    overflow: 'hidden',
  },
  bottomPanelAndroid: {
    backgroundColor: colors.surface,
  },
  panelRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.8,
  },
  bottomPanelContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  // ─── Stats strip ───────────────────────────────────
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  statPill: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  statValue: {
    fontSize: 20,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -0.5,
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: typography.fontMedium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  // ─── Program card ──────────────────────────────────
  programCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  programLabel: {
    fontFamily: typography.fontSemiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  programName: {
    fontFamily: typography.fontSemiBold,
  },
  // ─── Recent machines (horizontal) ──────────────────
  recentSection: {
    marginBottom: spacing.sm,
  },
  recentLabel: {
    marginBottom: spacing.xs,
    fontFamily: typography.fontSemiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  recentScroll: {
    gap: spacing.sm,
  },
  recentChip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    minWidth: 100,
  },
  recentChipName: {
    fontFamily: typography.fontSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  recentChipTime: {
    fontSize: 11,
    fontFamily: typography.fontMono,
    color: colors.textMuted,
    marginTop: 1,
  },
  // ─── Recent machines (permission denied list) ──────
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontWeight: '600',
  },
  // ─── Tip ───────────────────────────────────────────
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  tipIcon: {
    fontSize: 14,
  },
  tipText: {
    lineHeight: 20,
  },
  tipTextSmall: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  tipLabel: {
    fontFamily: typography.fontSemiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  // ─── Error overlay ─────────────────────────────────
  errorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
