'use client';

import { useScanFlowStore } from '@/lib/stores/scanFlowStore';

const GOALS = [
  {
    value: 'muscle-gain',
    label: 'Build Muscle',
    icon: '💪',
    description: 'Grow and define your muscles',
  },
  {
    value: 'strength',
    label: 'Get Stronger',
    icon: '🏋️',
    description: 'Increase your max lifts',
  },
  {
    value: 'weight-loss',
    label: 'Lose Weight',
    icon: '🔥',
    description: 'Burn calories and lean out',
  },
  {
    value: 'general-fitness',
    label: 'General Fitness',
    icon: '⚡',
    description: 'Stay active and healthy',
  },
];

export function OnboardGoal() {
  const { goTo, setSelectedGoal } = useScanFlowStore();

  const handleSelect = (value: string) => {
    setSelectedGoal(value);
    // Auto-advance — no submit button
    goTo('onboard_experience');
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
        What&apos;s your goal?
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-8)',
        }}
      >
        This helps us personalize your experience.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {GOALS.map((goal) => (
          <button
            key={goal.value}
            onClick={() => handleSelect(goal.value)}
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
            <span style={{ fontSize: 28 }}>{goal.icon}</span>
            <div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>
                {goal.label}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {goal.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
