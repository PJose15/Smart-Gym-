'use client';

import { useScanFlowStore } from '@/lib/stores/scanFlowStore';

const LEVELS = [
  {
    value: 'beginner',
    label: 'Beginner',
    range: '0–6 months',
    icon: '🌱',
    description: 'New to working out or just getting started',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    range: '6 months – 2 years',
    icon: '📈',
    description: 'Comfortable with most exercises',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    range: '2+ years',
    icon: '🏆',
    description: 'Experienced and training consistently',
  },
];

export function OnboardExperience() {
  const { goTo, setSelectedExperience } = useScanFlowStore();

  const handleSelect = (value: string) => {
    setSelectedExperience(value);
    // Auto-advance to welcome
    goTo('welcome');
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--page-padding-x)',
        paddingTop: 'var(--space-10)',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        Experience Level
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-8)',
        }}
      >
        How long have you been training?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {LEVELS.map((level) => (
          <button
            key={level.value}
            onClick={() => handleSelect(level.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              width: '100%',
              padding: 'var(--card-padding)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--color-border-default)',
              backgroundColor: 'var(--color-bg-raised)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              textAlign: 'left',
              minHeight: 'var(--tap-target-lg)',
              transition: `border-color var(--duration-fast) var(--ease-default),
                           transform var(--duration-fast) var(--ease-default),
                           background-color var(--duration-fast) var(--ease-default)`,
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-blue)';
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
            onTouchStart={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-blue)';
            }}
            onTouchEnd={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            <span style={{ fontSize: 28 }}>{level.icon}</span>
            <div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>
                {level.label}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {level.range} — {level.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
