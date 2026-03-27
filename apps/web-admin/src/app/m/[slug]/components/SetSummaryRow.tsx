'use client';

interface SetSummaryRowProps {
  setNumber: number;
  weightLbs: number;
  reps: number;
  rpe: number | null;
}

export function SetSummaryRow({ setNumber, weightLbs, reps, rpe }: SetSummaryRowProps) {
  const volume = weightLbs * reps;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-bg-raised)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      {/* Set number badge */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-blue-subtle)',
          color: 'var(--color-blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-bold)',
          fontFamily: 'var(--font-mono)',
          marginRight: 'var(--space-3)',
          flexShrink: 0,
        }}
      >
        {setNumber}
      </div>

      {/* Weight × Reps */}
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)' }}>
          {weightLbs} lbs
        </span>
        <span style={{ color: 'var(--color-text-muted)', margin: '0 var(--space-1)' }}>×</span>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)' }}>
          {reps} reps
        </span>
      </div>

      {/* RPE */}
      {rpe !== null && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            marginRight: 'var(--space-3)',
          }}
        >
          RPE {rpe}
        </span>
      )}

      {/* Volume */}
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {volume.toLocaleString()} lbs
      </span>
    </div>
  );
}
