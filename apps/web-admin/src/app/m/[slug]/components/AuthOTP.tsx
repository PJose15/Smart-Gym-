'use client';

import { useState, useEffect } from 'react';
import { useScanFlowStore } from '@/lib/stores/scanFlowStore';
import { OTPInput } from './OTPInput';

export function AuthOTP() {
  const { machine, phone, authPath, goTo, setMember } = useScanFlowStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const isDev = process.env.NEXT_PUBLIC_DEV_OTP === 'true';

  // Dev mode: auto-fill code
  useEffect(() => {
    if (isDev) {
      const timer = setTimeout(() => {
        setCode('123456');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isDev]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleVerify = async (verifyCode: string) => {
    if (!machine || !phone || loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          code: verifyCode,
          gym_id: machine.gym_id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        setCode('');
        setLoading(false);
        return;
      }

      // Store member data
      setMember(data.member);

      // Route based on auth path and onboarding status
      if (authPath === 'returning' && data.member.onboarding_status === 'active') {
        // Returning user — skip onboarding, go straight to logging
        goTo('logging');
      } else {
        // Cold or preloaded — go through onboarding
        goTo('onboard_goal');
      }
    } catch {
      setError('Network error. Please try again.');
      setCode('');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!machine || !phone || resendCooldown > 0) return;

    try {
      await fetch('/api/auth/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          name: 'Resend',
          gym_id: machine.gym_id,
        }),
      });
      setResendCooldown(30);
      setError('');
    } catch {
      setError('Failed to resend code');
    }
  };

  // Mask phone for display
  const maskedPhone = phone
    ? phone.replace(/(\+\d)(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4')
    : '';

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
      {/* Back button */}
      <button
        onClick={() => goTo('auth_phone')}
        disabled={loading}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
          cursor: 'pointer',
          padding: 0,
          marginBottom: 'var(--space-6)',
          fontFamily: 'var(--font-sans)',
          textAlign: 'left',
        }}
      >
        ← Change number
      </button>

      {/* Header */}
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        Enter Code
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-8)',
        }}
      >
        We sent a 6-digit code to{' '}
        <span style={{ color: 'var(--color-text-secondary)' }}>
          {maskedPhone}
        </span>
      </p>

      {/* Dev mode indicator */}
      {isDev && (
        <div
          style={{
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-gold-subtle)',
            border: '1px solid color-mix(in srgb, var(--color-gold) 25%, transparent)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-gold)',
            marginBottom: 'var(--space-4)',
            textAlign: 'center',
          }}
        >
          Dev mode — code auto-filled: 123456
        </div>
      )}

      {/* OTP Input */}
      <OTPInput
        value={code}
        onChange={setCode}
        onComplete={handleVerify}
        disabled={loading}
      />

      {/* Error message */}
      {error && (
        <div
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-red-subtle)',
            border: '1px solid color-mix(in srgb, var(--color-red) 25%, transparent)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-red-light)',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div
          style={{
            marginTop: 'var(--space-4)',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Verifying...
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Resend */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
        {resendCooldown > 0 ? (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-muted)',
            }}
          >
            Resend in {resendCooldown}s
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-blue)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              padding: 'var(--space-2)',
            }}
          >
            Didn&apos;t receive a code? Resend
          </button>
        )}
      </div>
    </div>
  );
}
