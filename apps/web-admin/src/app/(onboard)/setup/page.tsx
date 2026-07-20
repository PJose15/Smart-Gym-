'use client';

import { useState, useEffect, useCallback, type CSSProperties, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { WizardProgress } from '../components/WizardProgress';
import { MachineForm, type MachineFormValues } from '@/components/machines/MachineForm';

// ─── Types ───────────────────────────────────────────────

type WizardStep = 'machine-form' | 'creating' | 'qr-ready';

interface OnboardStatus {
  gym_id: string;
  gym_name: string;
  billing: {
    has_subscription: boolean;
    status?: string;
  };
}

interface CreatedMachine {
  id: string;
  name: string;
  qr_slug: string;
}

// ─── Styles ──────────────────────────────────────────────

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 12,
  padding: '28px 24px 32px',
};

const headingStyle: CSSProperties = {
  fontSize: '1.375rem',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: '0 0 4px',
  letterSpacing: '-0.02em',
};

const subStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary)',
  margin: '0 0 24px',
};

const successBannerStyle: CSSProperties = {
  backgroundColor: 'var(--color-green-light, rgba(16, 185, 129, 0.12))',
  border: '1px solid var(--color-green, #10b981)',
  borderRadius: 8,
  padding: '12px 14px',
  marginBottom: 20,
  fontSize: '0.875rem',
  color: 'var(--color-green, #10b981)',
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const dismissButtonStyle: CSSProperties = {
  marginLeft: 'auto',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-text-muted)',
  fontSize: '1rem',
  padding: '0 2px',
  lineHeight: 1,
};

const spinnerWrapStyle: CSSProperties = {
  textAlign: 'center',
  padding: '48px 0',
};

const spinnerStyle: CSSProperties = {
  display: 'inline-block',
  width: 40,
  height: 40,
  border: '3px solid var(--color-border-default)',
  borderTopColor: 'var(--accent)',
  borderRadius: '50%',
  animation: 'spin 0.7s linear infinite',
};

const spinnerLabelStyle: CSSProperties = {
  marginTop: 16,
  fontSize: '0.9375rem',
  color: 'var(--color-text-secondary)',
};

const successPanelStyle: CSSProperties = {
  textAlign: 'center',
};

const successIconStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: 16,
};

const successHeadingStyle: CSSProperties = {
  fontSize: '1.375rem',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: '0 0 8px',
  letterSpacing: '-0.02em',
};

const successSubStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary)',
  margin: '0 0 20px',
};

const scanUrlBlockStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-base)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  padding: '12px 14px',
  marginBottom: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const scanUrlTextStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '0.8125rem',
  color: 'var(--color-text-primary)',
  flex: 1,
  overflowWrap: 'anywhere' as const,
  textAlign: 'left',
};

const copyButtonStyle: CSSProperties = {
  flexShrink: 0,
  padding: '5px 10px',
  backgroundColor: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 6,
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  whiteSpace: 'nowrap',
};

const primaryButtonStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '12px',
  backgroundColor: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '-0.01em',
  textDecoration: 'none',
  textAlign: 'center',
  marginBottom: 12,
};

const secondaryButtonStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '11px 12px',
  backgroundColor: 'transparent',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  fontSize: '0.9375rem',
  fontWeight: 500,
  cursor: 'pointer',
  textDecoration: 'none',
  textAlign: 'center',
  marginBottom: 10,
};

const tertiaryLinkStyle: CSSProperties = {
  display: 'block',
  textAlign: 'center',
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary)',
  textDecoration: 'none',
  marginBottom: 16,
};

const addAnotherStyle: CSSProperties = {
  display: 'block',
  textAlign: 'center',
  fontSize: '0.8125rem',
  color: 'var(--accent)',
  textDecoration: 'underline',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  padding: 0,
  marginTop: 4,
};

const skipLinkStyle: CSSProperties = {
  display: 'block',
  textAlign: 'center',
  fontSize: '0.8125rem',
  color: 'var(--color-text-muted)',
  textDecoration: 'none',
  marginTop: 20,
};

const signInCardStyle: CSSProperties = {
  ...cardStyle,
  textAlign: 'center',
  padding: '40px 24px',
};

const signInHeadingStyle: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: '0 0 8px',
};

const signInSubStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary)',
  margin: '0 0 20px',
};

const signInLinkStyle: CSSProperties = {
  display: 'inline-block',
  padding: '11px 24px',
  backgroundColor: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'none',
};

// ─── CheckIcon ───────────────────────────────────────────

function CheckCircleIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <rect width="56" height="56" rx="28" fill="var(--accent-subtle, rgba(224,20,47,0.12))" />
      <path
        d="M18 28l7 7 13-14"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── SetupWizardContent ──────────────────────────────────

function SetupWizardContent() {
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get('checkout') === 'success';

  const [step, setStep] = useState<WizardStep>('machine-form');
  const [gymName, setGymName] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [machine, setMachine] = useState<CreatedMachine | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(checkoutSuccess);
  const [copied, setCopied] = useState(false);

  // Fetch onboard status on mount to verify auth + get gym name
  useEffect(() => {
    let cancelled = false;
    fetch('/api/onboard/status')
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setAuthError(true);
          return;
        }
        if (res.ok) {
          const body = await res.json() as OnboardStatus;
          setGymName(body.gym_name);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const handleMachineSubmit = useCallback(async (values: MachineFormValues) => {
    setFormError(null);
    setSubmitting(true);
    setStep('creating');

    try {
      const res = await fetch('/api/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (res.status === 201) {
        const body = await res.json() as CreatedMachine;
        setMachine(body);
        setStep('qr-ready');
      } else {
        let msg = 'Failed to create machine. Please try again.';
        try {
          const errBody = await res.json() as { error?: string };
          if (errBody.error) msg = errBody.error;
        } catch {
          // ignore parse error
        }
        setFormError(msg);
        setStep('machine-form');
      }
    } catch {
      setFormError('Network error. Please check your connection and try again.');
      setStep('machine-form');
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handleCopy = useCallback(() => {
    if (!machine) return;
    const scanUrl = `${window.location.origin}/m/${machine.qr_slug}`;
    navigator.clipboard.writeText(scanUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback: select text
    });
  }, [machine]);

  const handleAddAnother = useCallback(() => {
    setMachine(null);
    setFormError(null);
    setStep('machine-form');
  }, []);

  // ── Auth error state ──
  if (authError) {
    return (
      <div style={signInCardStyle} data-testid="sign-in-prompt">
        <h1 style={signInHeadingStyle}>Sign in to continue</h1>
        <p style={signInSubStyle}>
          Please sign in to your Nexera account to finish setting up your gym.
        </p>
        <a href="/staff/login?next=/setup" style={signInLinkStyle}>
          Sign in
        </a>
      </div>
    );
  }

  // ── Spinner while creating ──
  if (step === 'creating') {
    return (
      <>
        <WizardProgress currentStep={4} />
        <div style={cardStyle}>
          <div style={spinnerWrapStyle}>
            {/* Inline keyframes via style tag not available in RSC — spinner via border animation */}
            <div
              style={spinnerStyle}
              role="status"
              aria-label="Creating machine..."
            />
            <p style={spinnerLabelStyle}>Creating your machine…</p>
          </div>
        </div>
      </>
    );
  }

  // ── QR-ready success state ──
  if (step === 'qr-ready' && machine) {
    const scanUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/m/${machine.qr_slug}`;

    return (
      <>
        <WizardProgress currentStep={4} />
        <div style={cardStyle}>
          {bannerVisible && (
            <div style={successBannerStyle} role="status">
              Subscription active — your 30-day trial has started
              <button
                style={dismissButtonStyle}
                onClick={() => setBannerVisible(false)}
                aria-label="Dismiss subscription banner"
              >
                ×
              </button>
            </div>
          )}

          <div style={successPanelStyle}>
            <div style={successIconStyle}>
              <CheckCircleIcon />
            </div>

            <h1 style={successHeadingStyle} data-testid="machine-name">
              {machine.name} is live!
            </h1>
            <p style={successSubStyle}>
              Members can scan the QR code below to start a guided workout session.
            </p>

            <div style={scanUrlBlockStyle}>
              <code style={scanUrlTextStyle} data-testid="scan-url">
                {scanUrl}
              </code>
              <button
                style={copyButtonStyle}
                onClick={handleCopy}
                aria-label="Copy scan URL"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <a
              href="/api/machines/qr-pdf"
              download
              style={primaryButtonStyle}
              data-testid="qr-pdf-link"
            >
              Download printable QR PDF
            </a>

            <a href="/setup/import" style={secondaryButtonStyle} data-testid="import-link">
              Import your members →
            </a>

            <a href="/owner/dashboard" style={tertiaryLinkStyle}>
              Go to my dashboard
            </a>

            <button
              style={addAnotherStyle}
              onClick={handleAddAnother}
              data-testid="add-another"
            >
              Add another machine
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Step A: Machine form ──
  return (
    <>
      <WizardProgress currentStep={4} />
      <div style={cardStyle}>
        {bannerVisible && (
          <div style={successBannerStyle} role="status">
            Subscription active — your 30-day trial has started
            <button
              style={dismissButtonStyle}
              onClick={() => setBannerVisible(false)}
              aria-label="Dismiss subscription banner"
            >
              ×
            </button>
          </div>
        )}

        <h1 style={headingStyle}>Add your first machine</h1>
        <p style={subStyle}>
          Name it like your members would say it — &ldquo;Lat Pulldown&rdquo;, &ldquo;Leg Press&rdquo;
        </p>

        <MachineForm
          minimal
          submitLabel="Create machine & QR code"
          submitting={submitting}
          error={formError}
          onSubmit={handleMachineSubmit}
        />

        <a href="/setup/import" style={skipLinkStyle} data-testid="skip-link">
          Skip for now
        </a>
      </div>
      {gymName && (
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 12 }}>
          Setting up <strong>{gymName}</strong>
        </p>
      )}
    </>
  );
}

// ─── Page export (Suspense-wrapped for useSearchParams) ──

export default function SetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupWizardContent />
    </Suspense>
  );
}
