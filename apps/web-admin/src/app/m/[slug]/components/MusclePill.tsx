'use client';

const MUSCLE_COLORS: Record<string, string> = {
  chest: 'var(--color-blue)',
  back: 'var(--color-purple)',
  shoulders: 'var(--color-amber)',
  biceps: 'var(--color-green)',
  triceps: 'var(--color-green)',
  quads: 'var(--color-gold)',
  hamstrings: 'var(--color-gold)',
  glutes: 'var(--color-gold)',
  calves: 'var(--color-gold)',
  core: 'var(--color-amber)',
  abs: 'var(--color-amber)',
  forearms: 'var(--color-green)',
  traps: 'var(--color-purple)',
  lats: 'var(--color-purple)',
};

function getColor(muscle: string): string {
  const key = muscle.toLowerCase().replace(/\s+/g, '');
  return MUSCLE_COLORS[key] || 'var(--color-blue)';
}

interface MusclePillProps {
  muscle: string;
}

export function MusclePill({ muscle }: MusclePillProps) {
  const color = getColor(muscle);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-medium)',
        letterSpacing: 'var(--tracking-wide)',
        textTransform: 'capitalize',
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      {muscle}
    </span>
  );
}
