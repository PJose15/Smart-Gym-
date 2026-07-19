'use client';

import { useEffect, useState, type CSSProperties, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { WizardProgress } from '../components/WizardProgress';

// ─── Styles ──────────────────────────────────────────────

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 12,
  padding: '32px 24px',
  textAlign: 'center',
};

const iconWrapStyle: CSSProperties = {
  marginBottom: 20,
  display: 'flex',
  justifyContent: 'center',
};

const headingStyle: CSSProperties = {
  fontSize: '1.375rem',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: '0 0 12px',
  letterSpacing: '-0.02em',
};

const bodyStyle: CSSProperties = {
  fontSize: '0.9375rem',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.6,
  margin: '0 0 28px',
};

const emailHighlightStyle: CSSProperties = {
  color: 'var(--color-text-primary)',
  fontWeight: 600,
};

const resendButtonStyle: CSSProperties = {
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
  marginBottom: 12,
};

const disabledResendStyle: CSSProperties = {
  ...resendButtonStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const sentConfirmStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-green)',
  marginBottom: 12,
  fontWeight: 500,
};

const startOverStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary)',
  marginTop: 16,
};

const startOverLinkStyle: CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'underline',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  fontSize: 'inherit',
  padding: 0,
};

const RESEND_COOLDOWN_SECONDS = 60;

function MailIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
    >
      <rect width="56" height="56" rx="28" fill="var(--accent-subtle)" />
      <path
        d="M15 20a2 2 0 0 1 2-2h22a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2V20Z"
        stroke="var(--accent)"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M15 21l13 9 13-9"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email');

  const [cooldown, setCooldown] = useState(0);
  const [sent, setSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  // Redirect to /signup if no email param
  useEffect(() => {
    if (!email) {
      router.replace('/signup');
    }
  }, [email, router]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setResendError(null);
    setSent(false);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/subscribe`,
      },
    });

    if (error) {
      setResendError('Failed to resend. Please try again in a moment.');
    } else {
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  if (!email) {
    return null; // will redirect
  }

  return (
    <>
      <WizardProgress currentStep={2} />
      <div style={cardStyle}>
        <div style={iconWrapStyle}>
          <MailIcon />
        </div>

        <h1 style={headingStyle}>Check your inbox</h1>

        <p style={bodyStyle}>
          We sent a verification link to{' '}
          <strong style={emailHighlightStyle}>{email}</strong>. Click it to
          continue to plan selection.
        </p>

        {sent && (
          <p style={sentConfirmStyle} role="status" aria-live="polite">
            Sent! Check your inbox again.
          </p>
        )}

        {resendError && (
          <p
            style={{ ...sentConfirmStyle, color: 'var(--color-red)' }}
            role="alert"
          >
            {resendError}
          </p>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          style={cooldown > 0 ? disabledResendStyle : resendButtonStyle}
          aria-label={
            cooldown > 0
              ? `Resend email (wait ${cooldown}s)`
              : 'Resend verification email'
          }
        >
          {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
        </button>

        <p style={startOverStyle}>
          Wrong email?{' '}
          <a href="/signup" style={startOverLinkStyle}>
            Start over
          </a>
        </p>
      </div>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
