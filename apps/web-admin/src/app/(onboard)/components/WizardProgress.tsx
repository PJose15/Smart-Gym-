import type { CSSProperties } from 'react';

interface WizardProgressProps {
  currentStep: 1 | 2 | 3 | 4;
}

const STEPS = [
  { label: 'Account', step: 1 },
  { label: 'Verify', step: 2 },
  { label: 'Plan', step: 3 },
  { label: 'Setup', step: 4 },
] as const;

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0,
  marginBottom: 32,
  position: 'relative',
};

const stepWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  position: 'relative',
  flex: 1,
};

const connectorStyle: CSSProperties = {
  flex: 1,
  height: 2,
  backgroundColor: 'var(--color-border-default)',
  marginTop: -20, // align with dot center (dot is ~16px, label ~14px)
  alignSelf: 'flex-start',
  marginLeft: 0,
  marginRight: 0,
};

export function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <nav aria-label="Onboarding progress">
      <span className="sr-only">Step {currentStep} of 4</span>
      <div style={containerStyle}>
        {STEPS.map(({ label, step }, index) => {
          const isActive = step === currentStep;
          const isComplete = step < currentStep;

          const dotStyle: CSSProperties = {
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: `2px solid ${isActive || isComplete ? 'var(--accent)' : 'var(--color-border-default)'}`,
            backgroundColor: isActive ? 'var(--accent)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6,
            position: 'relative',
            zIndex: 1,
          };

          const labelStyle: CSSProperties = {
            fontSize: '0.6875rem',
            fontWeight: isActive ? 600 : 400,
            color: isActive
              ? 'var(--color-text-primary)'
              : 'var(--color-text-muted)',
            whiteSpace: 'nowrap',
          };

          return (
            <div
              key={step}
              style={{ display: 'flex', alignItems: 'flex-start', flex: index === STEPS.length - 1 ? 'none' : 1 }}
            >
              <div style={stepWrapStyle}>
                <div
                  style={dotStyle}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${step}: ${label}${isComplete ? ' (completed)' : isActive ? ' (current)' : ''}`}
                >
                  {isComplete && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 5l2.5 2.5L8 3"
                        stroke="var(--accent)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span style={labelStyle}>{label}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  style={{
                    ...connectorStyle,
                    backgroundColor:
                      step < currentStep
                        ? 'var(--accent)'
                        : 'var(--color-border-default)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
