import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { parseQrCode } from '@smartgym/utils';
import { Button, Text } from '../../src/components';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { supabase } from '../../src/lib/supabase';
import { trackEvent } from '../../src/lib/events';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

// ─── Types ─────────────────────────────────────────────
interface RecentMachine {
  machine_id: string;
  exercise_name: string;
  qr_slug: string;
  machine_name: string;
  target_muscles: string[];
  last_used: string;
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
  'Scanning before your set helps SmartGym suggest your next weight and reps.',
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
  const mountedRef = useRef(true);

  // Animated scan frame pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset scan state every time the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setError(null);
      loadContext();
    }, []),
  );

  async function loadContext() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mountedRef.current) return;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [recentResult, scanCountResult, uniqueResult, programResult] = await Promise.all([
        // 1. Recently used machines (last 5 unique)
        supabase
          .from('workout_exercises')
          .select(`
            machine_id,
            exercise_name,
            workouts!inner(profile_id, started_at, status),
            machines!inner(qr_slug, name, target_muscles)
          `)
          .eq('workouts.profile_id', user.id)
          .eq('workouts.status', 'completed')
          .not('machine_id', 'is', null)
          .order('workouts(started_at)', { ascending: false })
          .limit(20),

        // 2. Scan count today
        supabase
          .from('app_events')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', user.id)
          .eq('event_name', 'qr_scanned')
          .gte('created_at', todayStart.toISOString()),

        // 3. Total unique machines ever used
        supabase
          .from('workout_exercises')
          .select('machine_id, workouts!inner(profile_id)')
          .eq('workouts.profile_id', user.id)
          .not('machine_id', 'is', null)
          .limit(200),

        // 4. Today's program machine (if assigned)
        loadProgramMachine(user.id),
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
            exercise_name: row.exercise_name,
            qr_slug: row.machines?.qr_slug ?? mid,
            machine_name: row.machines?.name ?? row.exercise_name,
            target_muscles: row.machines?.target_muscles ?? [],
            last_used: row.workouts?.started_at ?? '',
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
    } finally {
      if (mountedRef.current) setLoadingContext(false);
    }
  }

  async function loadProgramMachine(profileId: string): Promise<TodayProgramMachine | null> {
    try {
      // Get current program assignment
      const { data: assignment } = await supabase
        .from('member_program_assignments')
        .select('program_id, assigned_at')
        .eq('profile_id', profileId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (!assignment) return null;

      // Get program days
      const { data: days } = await supabase
        .from('program_days')
        .select('id, day_number')
        .eq('program_id', assignment.program_id)
        .order('day_number')
        .limit(30);

      if (!days || days.length === 0) return null;

      // Determine today's day in the cycle
      const assignedDate = new Date(assignment.assigned_at);
      const daysSinceAssigned = Math.floor((Date.now() - assignedDate.getTime()) / (1000 * 60 * 60 * 24));
      const todayIndex = daysSinceAssigned % days.length;
      const todayDay = days[todayIndex];

      // Get first exercise of today's program day
      const { data: exercises } = await supabase
        .from('program_day_exercises')
        .select('exercise_name, machine_id, machines(name, qr_slug)')
        .eq('program_day_id', todayDay.id)
        .order('order_index')
        .limit(1);

      if (!exercises || exercises.length === 0) return null;

      const ex = exercises[0] as any;
      return {
        exercise_name: ex.exercise_name,
        machine_name: ex.machines?.name ?? ex.exercise_name,
        qr_slug: ex.machines?.qr_slug ?? '',
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
      setError('Invalid QR code. Please scan a SmartGym machine QR code.');
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
              SmartGym needs your camera to scan QR codes on gym machines.
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
                      {m.target_muscles.slice(0, 2).join(', ')}
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
            <Animated.View
              style={[styles.scanArea, { transform: [{ scale: pulseAnim }] }]}
            />
            <Text variant="body" color="white" style={styles.hint}>
              Point at a machine QR code
            </Text>
          </View>
        </CameraView>
      </View>

      {/* Bottom context panel */}
      <View style={styles.bottomPanel}>
        <ScrollView
          horizontal={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.bottomPanelContent}
        >
          {/* 1. Scan Stats Strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statPill}>
              <Text variant="label" style={styles.statValue}>{scanCountToday}</Text>
              <Text variant="caption" color="textSecondary">scans today</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statPill}>
              <Text variant="label" style={styles.statValue}>{totalUniqueMachines}</Text>
              <Text variant="caption" color="textSecondary">machines used</Text>
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
    backgroundColor: '#000',
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
  scanArea: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  // ─── Bottom context panel ──────────────────────────
  bottomPanel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: 260,
    paddingTop: spacing.md,
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
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  // ─── Program card ──────────────────────────────────
  programCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  programLabel: {
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  programName: {
    fontWeight: '600',
  },
  // ─── Recent machines (horizontal) ──────────────────
  recentSection: {
    marginBottom: spacing.sm,
  },
  recentLabel: {
    marginBottom: spacing.xs,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentScroll: {
    gap: spacing.sm,
  },
  recentChip: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 4,
    minWidth: 100,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  recentChipName: {
    fontWeight: '600',
    fontSize: 13,
    color: colors.text,
  },
  recentChipTime: {
    fontSize: 11,
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
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  // ─── Error overlay ─────────────────────────────────
  errorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: spacing.lg,
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
