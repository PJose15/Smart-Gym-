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
  const unit = member?.weight_unit ?? 'lbs';
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

  // Resolve the member's preferred display unit. The scan store is populated
  // by /api/auth/verify which always includes weight_unit (defaults to 'lbs').
  const weightUnit = member?.weight_unit ?? 'lbs';

  // Display-unit step. useSessionManager's increment is lbs-native
  // (5 for upper body, 10 for lower). Map to the closest clean metric step.
  const displayIncrement =
    weightUnit === 'kg'
      ? session.weightIncrement >= 10
        ? 5
        : 2.5
      : session.weightIncrement;

  return (
    <div className="set-logger-wrapper">
      {/* Header */}
      <div className="set-logger-header">
        <h2 className="set-logger-machine-name">{machine.name}</h2>
        {member && (
          <p className="set-logger-member-info">
            {member.first_name || member.display_name} — Set {session.setsCount + 1}
          </p>
        )}
      </div>

      {/* Program context banner */}
      {programContext?.machine_in_plan && programContext.target_exercise && (
        <div className="set-logger-program-banner">
          <span className="set-logger-program-title">
            Program: {programContext.title}
          </span>
          {' — '}
          {programContext.target_exercise.exercise_name}
          {': '}
          {programContext.target_exercise.default_sets}x{programContext.target_exercise.default_reps}
          <span className="set-logger-program-week">
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
        weightIncrement={displayIncrement}
        weightUnit={weightUnit}
        loading={session.loading}
        onDone={() => goTo('complete')}
        machineName={machine.name}
      />

      {/* PR Celebration — Tier 1: full-screen overlay */}
      {prDetection.activePR && activeTier === 'full' && machine && (
        <PRCelebration
          pr={prDetection.activePR}
          machineName={machine.name}
          weightUnit={unit}
          onDismiss={() => { prDetection.dismissPR(); setActiveTier('none'); }}
        />
      )}

      {/* PR Celebration — Tier 2: bottom sheet */}
      {prDetection.activePR && activeTier === 'sheet' && machine && (
        <PRBottomSheet
          prResult={prDetection.activePR}
          machineName={machine.name}
          weightUnit={unit}
          onDismiss={() => { prDetection.dismissPR(); setActiveTier('none'); }}
        />
      )}
    </div>
  );
}
