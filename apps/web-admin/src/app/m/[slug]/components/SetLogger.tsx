'use client';

import { useState, useEffect } from 'react';
import { useScanFlowStore } from '@/lib/stores/scanFlowStore';
import { useSessionManager } from '@/lib/hooks/useSessionManager';
import { usePRDetection } from '@/lib/hooks/usePRDetection';
import { getPRCelebrationTier, type PRCelebrationTier } from '@/lib/pr/getPRCelebrationTier';
import { launchBottomConfetti } from '@/lib/ui/confetti';
import { ProgressiveSetForm } from '@/components/scan/ProgressiveSetForm';
import { PRCelebration } from './PRCelebration';
import { PRBottomSheet } from '@/components/scan/PRBottomSheet';

export function SetLogger() {
  const { machine, member, goTo, programContext, setProgramContext } = useScanFlowStore();
  const prDetection = usePRDetection();
  const session = useSessionManager();

  const [activeTier, setActiveTier] = useState<PRCelebrationTier>('none');

  // Fetch program context on mount
  useEffect(() => {
    if (!member?.id || !machine?.id) return;
    fetch(`/api/programs/active?member_id=${member.id}&machine_id=${machine.id}`)
      .then((r) => r.json())
      .then((data) => { if (data) setProgramContext(data); })
      .catch(() => { /* non-critical */ });
  }, [member?.id, machine?.id, setProgramContext]);

  const handleSetLogged = async (set: {
    weight_lbs: number;
    reps: number;
    rpe: number | null;
  }) => {
    const result = await session.logSet({
      weight_lbs: set.weight_lbs,
      reps: set.reps,
      rpe: set.rpe,
    });

    if (!result) {
      throw new Error('Failed to log set');
    }

    // Check for PR and decide celebration tier
    if (machine && member) {
      const pr = await prDetection.checkPR({
        session_id: result.session_id,
        member_id: member.id,
        machine_id: machine.id,
        weight_lbs: set.weight_lbs,
        reps: set.reps,
      });

      const tier = getPRCelebrationTier(pr);
      setActiveTier(tier);
      if (tier === 'sheet') {
        launchBottomConfetti();
      }
    }

    return result;
  };

  if (!machine) return null;

  const targetReps = programContext?.target_exercise?.default_reps ?? null;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding: 'var(--space-6) var(--page-padding-x) 0' }}>
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--color-text-primary)',
          }}
        >
          {machine.name}
        </h2>
        {member && (
          <p style={{ margin: 0, marginTop: 2, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {member.first_name || member.display_name} — Set {session.setsCount + 1}
          </p>
        )}
      </div>

      {/* Program context banner */}
      {programContext?.machine_in_plan && programContext.target_exercise && (
        <div
          style={{
            margin: 'var(--space-3) var(--page-padding-x) 0',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-green-subtle)',
            border: '1px solid color-mix(in srgb, var(--color-green) 20%, transparent)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-green-light)',
          }}
        >
          <span style={{ fontWeight: 'var(--weight-bold)' }}>
            Program: {programContext.title}
          </span>
          {' — '}
          {programContext.target_exercise.exercise_name}
          {': '}
          {programContext.target_exercise.default_sets}x{programContext.target_exercise.default_reps}
          <span style={{ marginLeft: 'var(--space-2)', opacity: 0.7 }}>
            Week {programContext.week_number}, Day {programContext.day_number}
          </span>
        </div>
      )}

      {/* Progressive Set Form — one step at a time */}
      <ProgressiveSetForm
        suggestion={session.suggestion}
        targetReps={targetReps}
        onSetLogged={handleSetLogged}
        setNumber={session.setsCount + 1}
        previousSets={session.sets}
        weightIncrement={session.weightIncrement}
        loading={session.loading}
        onDone={() => goTo('complete')}
        machineName={machine.name}
      />

      {/* PR Celebration — Tier 1: full-screen overlay */}
      {prDetection.activePR && activeTier === 'full' && machine && (
        <PRCelebration
          pr={prDetection.activePR}
          machineName={machine.name}
          onDismiss={() => { prDetection.dismissPR(); setActiveTier('none'); }}
        />
      )}

      {/* PR Celebration — Tier 2: bottom sheet */}
      {prDetection.activePR && activeTier === 'sheet' && machine && (
        <PRBottomSheet
          prResult={prDetection.activePR}
          machineName={machine.name}
          onDismiss={() => { prDetection.dismissPR(); setActiveTier('none'); }}
        />
      )}
    </div>
  );
}
