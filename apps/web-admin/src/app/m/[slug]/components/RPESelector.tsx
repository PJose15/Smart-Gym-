'use client';

const RPE_OPTIONS = [
  { value: 6, label: '6', description: 'Easy' },
  { value: 7, label: '7', description: 'Moderate' },
  { value: 8, label: '8', description: 'Hard' },
  { value: 9, label: '9', description: 'Very Hard' },
  { value: 10, label: '10', description: 'Max' },
];

interface RPESelectorProps {
  value: number | null;
  onChange: (rpe: number | null) => void;
  disabled?: boolean;
}

export function RPESelector({ value, onChange, disabled }: RPESelectorProps) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-2)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-wider)',
          }}
        >
          Effort (RPE)
        </span>
        {value !== null && (
          <button
            onClick={() => onChange(null)}
            disabled={disabled}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              padding: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
        {RPE_OPTIONS.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(isSelected ? null : opt.value)}
              disabled={disabled}
              title={`RPE ${opt.value}: ${opt.description}`}
              style={{
                flex: 1,
                height: 'var(--tap-target-min)',
                borderRadius: 'var(--radius-sm)',
                border: `2px solid ${isSelected ? 'var(--color-blue)' : 'var(--color-border-default)'}`,
                backgroundColor: isSelected ? 'var(--color-blue-subtle)' : 'var(--color-bg-raised)',
                color: isSelected ? 'var(--color-blue)' : 'var(--color-text-secondary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-bold)',
                fontFamily: 'var(--font-mono)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: `all var(--duration-fast) var(--ease-default)`,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
