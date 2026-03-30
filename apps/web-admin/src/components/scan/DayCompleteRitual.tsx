'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { haptics } from '@/lib/ui/haptics';

export interface DayCompleteRitualProps {
  dayNumber: number;
  weekNumber: number;
  stats: { machinesCount: number; totalVolumeLbs: number; prsHit: number };
  nextSessionDay: string | null;
  isRestDay: boolean;
  onComplete: () => void;
}

type Phase = 'blackout' | 'day-number' | 'complete' | 'stats' | 'rest-day' | 'done-btn';

// Phase timing constants (ms) — staggered entrance sequence
const PHASE_TIMING = {
  dayNumber: 300,
  complete: 700,
  stats: 1100,
  restDay: 2000,
  doneBtn: 2700,
} as const;

export function StatPill({
  value,
  label,
  delay,
  gold,
}: {
  value: string;
  label: string;
  delay: number;
  gold?: boolean;
}) {
  return (
    <div
      className={`ritual-stat-pill${gold ? ' gold' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="pill-value">{value}</span>
      <span className="pill-label">{label}</span>
    </div>
  );
}

export function DayCompleteRitual({
  dayNumber,
  weekNumber,
  stats,
  nextSessionDay,
  isRestDay,
  onComplete,
}: DayCompleteRitualProps) {
  const [phase, setPhase] = useState<Phase>('blackout');
  const doneRef = useRef<HTMLButtonElement>(null);

  // Timer sequence
  useEffect(() => {
    haptics.light();

    // Skip phased sequence for users who prefer reduced motion
    const prefersReduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      const t = setTimeout(() => { setPhase('done-btn'); haptics.celebration(); }, 100);
      return () => clearTimeout(t);
    }

    const t1 = setTimeout(() => setPhase('day-number'), PHASE_TIMING.dayNumber);
    const t2 = setTimeout(() => setPhase('complete'), PHASE_TIMING.complete);
    const t3 = setTimeout(() => setPhase('stats'), PHASE_TIMING.stats);
    const t4 = setTimeout(() => setPhase('rest-day'), PHASE_TIMING.restDay);
    const t5 = setTimeout(() => {
      setPhase('done-btn');
      haptics.celebration();
    }, PHASE_TIMING.doneBtn);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, []);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape + Tab trap handler — only allow dismiss after done button appears
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && phase === 'done-btn') onComplete();
    if (e.key === 'Tab') {
      e.preventDefault();
      doneRef.current?.focus();
    }
  }, [onComplete, phase]);

  // Focus done button when it appears
  useEffect(() => {
    if (phase === 'done-btn') doneRef.current?.focus();
  }, [phase]);

  const phaseOrder: Phase[] = ['blackout', 'day-number', 'complete', 'stats', 'rest-day', 'done-btn'];
  const phaseIdx = phaseOrder.indexOf(phase);

  const showDayNumber = phaseIdx >= 1;
  const showComplete = phaseIdx >= 2;
  const showStats = phaseIdx >= 3;
  const showRest = phaseIdx >= 4;
  const showDone = phaseIdx >= 5;

  const k = stats.totalVolumeLbs / 1000;
  const volumeDisplay = stats.totalVolumeLbs >= 1000
    ? `${k % 1 === 0 ? Math.round(k) : k.toFixed(1)}k`
    : `${stats.totalVolumeLbs}`;

  const machinesLabel = stats.machinesCount === 1 ? 'machine' : 'machines';

  const thirdPill = stats.prsHit > 0
    ? { value: `${stats.prsHit} PR${stats.prsHit > 1 ? 's' : ''}`, label: '\u{1F3C6}', gold: true }
    : { value: `Week ${weekNumber}`, label: 'progress', gold: false };

  return (
    <div
      className="day-complete-ritual"
      role="dialog"
      aria-modal="true"
      aria-label="Day complete celebration"
      data-testid="day-complete-ritual"
      onKeyDown={handleKeyDown}
    >
      <div className="ritual-bg" />

      {showDayNumber && (
        <div className="ritual-day-number" aria-label={`Day ${dayNumber}`}>
          Day {dayNumber}
        </div>
      )}

      {showComplete && (
        <div className="ritual-complete-text">COMPLETE.</div>
      )}

      {showStats && (
        <div className="ritual-stats">
          <StatPill value={String(stats.machinesCount)} label={machinesLabel} delay={0} />
          <StatPill value={volumeDisplay} label="lbs" delay={100} />
          <StatPill
            value={thirdPill.value}
            label={thirdPill.label}
            delay={200}
            gold={thirdPill.gold}
          />
        </div>
      )}

      {showRest && isRestDay && nextSessionDay && (
        <div className="ritual-rest-message">
          Rest up — next session {nextSessionDay}
        </div>
      )}

      {showDone && (
        <button
          ref={doneRef}
          className="ritual-done-btn"
          type="button"
          onClick={onComplete}
        >
          Done
        </button>
      )}
    </div>
  );
}
