'use client';

import { useState, useEffect, useRef } from 'react';
import { useScanFlowStore } from '@/lib/stores/scanFlowStore';
import { useSessionManager } from '@/lib/hooks/useSessionManager';
import { usePRDetection } from '@/lib/hooks/usePRDetection';
import { getPRCelebrationTier, type PRCelebrationTier } from '@/lib/pr/getPRCelebrationTier';
import { launchBottomConfetti } from '@/lib/ui/confetti';
import { SetSummaryRow } from './SetSummaryRow';
import { RPESelector } from './RPESelector';
import { PRCelebration } from './PRCelebration';
import { PRBottomSheet } from '@/components/scan/PRBottomSheet';

export function SetLogger() {
  const { machine, member, goTo, programContext, setProgramContext } = useScanFlowStore();
  const prDetection = usePRDetection();
  const session = useSessionManager();

  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(10);
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [activeTier, setActiveTier] = useState<PRCelebrationTier>('none');

  const weightRef = useRef<HTMLInputElement>(null);

  // Fetch program context on mount
  useEffect(() => {
    if (!member?.id || !machine?.id) return;
    fetch(`/api/programs/active?member_id=${member.id}&machine_id=${machine.id}`)
      .then((r) => r.json())
      .then((data) => { if (data) setProgramContext(data); })
      .catch(() => { /* non-critical */ });
  }, [member?.id, machine?.id, setProgramContext]);

  // Apply suggestion when available (for 2nd+ sets)
  useEffect(() => {
    if (session.suggestion && session.sets.length > 0) {
      if (session.suggestion.suggested_weight !== null) {
        setWeight(session.suggestion.suggested_weight);
      }
      if (session.suggestion.suggested_reps !== null) {
        setReps(session.suggestion.suggested_reps);
      }
      if (session.suggestion.suggested_rpe !== null) {
        setRpe(session.suggestion.suggested_rpe);
      }
    }
  }, [session.suggestion, session.sets.length]);

  // Auto-focus weight input on mount and after each set
  useEffect(() => {
    weightRef.current?.focus();
  }, [session.setsCount]);

  const adjustWeight = (delta: number) => {
    setWeight((w) => Math.max(0, Math.min(2000, w + delta)));
  };

  const adjustReps = (delta: number) => {
    setReps((r) => Math.max(1, Math.min(100, r + delta)));
  };

  const handleLogSet = async () => {
    if (weight <= 0 || reps <= 0) return;

    const result = await session.logSet({
      weight_lbs: weight,
      reps,
      rpe,
      notes: notes || undefined,
    });

    if (result) {
      // Check for PR and decide celebration tier
      if (machine && member) {
        const pr = await prDetection.checkPR({
          session_id: result.session_id,
          member_id: member.id,
          machine_id: machine.id,
          weight_lbs: weight,
          reps,
        });

        const tier = getPRCelebrationTier(pr);
        setActiveTier(tier);
        if (tier === 'sheet') {
          launchBottomConfetti();
        }
      }

      // Reset form for next set (keep weight, suggestion will adjust)
      setRpe(null);
      setNotes('');
      setShowNotes(false);
    }
  };

  const handleDone = () => {
    goTo('complete');
  };

  if (!machine) return null;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--page-padding-x)',
        paddingTop: 'var(--space-6)',
        paddingBottom: 'var(--space-4)',
        gap: 'var(--space-4)',
      }}
    >
      {/* Header */}
      <div>
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

      {/* Previous sets summary */}
      {session.sets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {session.sets.map((s: { set_number: number; weight_lbs: number; reps: number; rpe: number | null }) => (
            <SetSummaryRow
              key={s.set_number}
              setNumber={s.set_number}
              weightLbs={s.weight_lbs}
              reps={s.reps}
              rpe={s.rpe}
            />
          ))}
        </div>
      )}

      {/* Suggestion banner */}
      {session.suggestion && session.suggestion.reason_code !== 'INSUFFICIENT_DATA' && (
        <div
          style={{
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-blue-subtle)',
            border: '1px solid color-mix(in srgb, var(--color-blue) 20%, transparent)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-blue-light)',
          }}
        >
          {session.suggestion.reason_text}
          {session.suggestion.safety_note && (
            <span style={{ color: 'var(--color-gold)', marginLeft: 'var(--space-2)' }}>
              {session.suggestion.safety_note}
            </span>
          )}
        </div>
      )}

      {/* Weight input */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-wider)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Weight (lbs)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <StepButton onClick={() => adjustWeight(-session.weightIncrement)} label={`-${session.weightIncrement}`} />
          <input
            ref={weightRef}
            type="number"
            inputMode="decimal"
            value={weight || ''}
            onChange={(e) => setWeight(Math.max(0, Number(e.target.value)))}
            disabled={session.loading}
            style={{
              flex: 1,
              height: 'var(--input-height-gym)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--color-border-default)',
              backgroundColor: 'var(--color-bg-raised)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-bold)',
              fontFamily: 'var(--font-mono)',
              textAlign: 'center',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <StepButton onClick={() => adjustWeight(session.weightIncrement)} label={`+${session.weightIncrement}`} />
        </div>
      </div>

      {/* Reps input */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-wider)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Reps
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <StepButton onClick={() => adjustReps(-1)} label="-1" />
          <input
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(Math.max(1, parseInt(e.target.value) || 1))}
            disabled={session.loading}
            style={{
              flex: 1,
              height: 'var(--input-height-gym)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--color-border-default)',
              backgroundColor: 'var(--color-bg-raised)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-bold)',
              fontFamily: 'var(--font-mono)',
              textAlign: 'center',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <StepButton onClick={() => adjustReps(1)} label="+1" />
        </div>
      </div>

      {/* RPE Selector */}
      <RPESelector value={rpe} onChange={setRpe} disabled={session.loading} />

      {/* Notes toggle */}
      {!showNotes ? (
        <button
          onClick={() => setShowNotes(true)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            padding: 0,
            textAlign: 'left',
          }}
        >
          + Add notes
        </button>
      ) : (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Set notes (optional)"
          rows={2}
          disabled={session.loading}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--color-border-default)',
            backgroundColor: 'var(--color-bg-raised)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            resize: 'none',
            boxSizing: 'border-box',
          }}
        />
      )}

      {/* Error */}
      {session.error && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-red-subtle)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-red-light)',
          }}
        >
          {session.error}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Log Set button */}
      <button
        onClick={handleLogSet}
        disabled={session.loading || weight <= 0 || reps <= 0}
        style={{
          width: '100%',
          height: 'var(--tap-target-lg)',
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          backgroundColor: 'var(--gym-primary)',
          color: 'var(--gym-text-on-primary)',
          fontSize: 'var(--text-md)',
          fontWeight: 'var(--weight-bold)',
          fontFamily: 'var(--font-sans)',
          cursor: session.loading ? 'wait' : 'pointer',
          opacity: session.loading || weight <= 0 ? 0.6 : 1,
          transition: `opacity var(--duration-fast) var(--ease-default)`,
          boxShadow: 'var(--shadow-blue)',
        }}
      >
        {session.loading ? 'Logging...' : `Log Set ${session.setsCount + 1}`}
      </button>

      {/* Done button */}
      {session.setsCount > 0 && (
        <button
          onClick={handleDone}
          disabled={session.loading}
          style={{
            width: '100%',
            height: 'var(--tap-target-min)',
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--color-border-default)',
            backgroundColor: 'transparent',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            transition: `border-color var(--duration-fast) var(--ease-default)`,
          }}
        >
          Done with {machine.name}
        </button>
      )}

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

// ── Step Button (±) ──────────────────────────────────────────
function StepButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 'var(--tap-target-pref)',
        height: 'var(--input-height-gym)',
        borderRadius: 'var(--radius-md)',
        border: '2px solid var(--color-border-default)',
        backgroundColor: 'var(--color-bg-raised)',
        color: 'var(--color-text-secondary)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-bold)',
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: `background-color var(--duration-fast) var(--ease-default),
                     border-color var(--duration-fast) var(--ease-default)`,
      }}
    >
      {label}
    </button>
  );
}
