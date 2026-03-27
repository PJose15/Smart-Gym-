'use client';

import { useState, useRef, useEffect } from 'react';
import { useScanFlowStore } from '@/lib/stores/scanFlowStore';

export function AuthPhone() {
  const { machine, goTo, setPhone, setAuthPath } = useScanFlowStore();
  const [name, setName] = useState('');
  const [phone, setPhoneLocal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    path: 'cold' | 'preloaded' | 'returning';
    member?: { display_name: string; first_name?: string | null };
  } | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // Auto-focus name input on mount
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Look up phone when 10+ digits entered
  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || !machine) {
      setLookupDone(false);
      setLookupResult(null);
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/auth/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, gym_id: machine.gym_id }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setLookupResult(data);
          setLookupDone(true);
        }
      } catch {
        // Aborted or network error — ignore
      }
    })();

    return () => controller.abort();
  }, [phone, machine]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine) return;

    setError('');
    setLoading(true);

    try {
      // Determine auth path
      const path = lookupResult?.path || 'cold';
      const displayName =
        path === 'preloaded' || path === 'returning'
          ? lookupResult?.member?.display_name || name
          : name;

      if (!displayName.trim()) {
        setError('Please enter your name');
        setLoading(false);
        return;
      }

      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10) {
        setError('Please enter a valid phone number');
        setLoading(false);
        return;
      }

      // Send OTP
      const res = await fetch('/api/auth/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          name: displayName,
          gym_id: machine.gym_id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send code');
        setLoading(false);
        return;
      }

      // Store auth state and advance to OTP screen
      setPhone(phone);
      setAuthPath(path);
      goTo('auth_otp');
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const isReturning = lookupResult?.path === 'returning';
  const isPreloaded = lookupResult?.path === 'preloaded';
  const showNameInput = !isReturning || !lookupDone;

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
        {isReturning
          ? `Welcome back${lookupResult?.member?.first_name ? `, ${lookupResult.member.first_name}` : ''}!`
          : 'Start Tracking'}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-8)',
        }}
      >
        {isReturning
          ? 'Enter your phone to verify and start logging.'
          : isPreloaded
          ? `We found your profile! Verify your phone to continue.`
          : "Enter your name and phone. We'll send a verification code."}
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Name input — hidden for returning users */}
        {showNameInput && (
          <div>
            <label
              htmlFor="auth-name"
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wider)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Your Name
            </label>
            <input
              ref={nameRef}
              id="auth-name"
              type="text"
              autoComplete="name"
              value={isPreloaded ? (lookupResult?.member?.display_name || name) : name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || isPreloaded}
              placeholder="e.g. Alex Rivera"
              style={{
                width: '100%',
                height: 'var(--input-height-gym)',
                padding: '0 var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-raised)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--text-base)',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                transition: 'border-color var(--duration-fast) var(--ease-default)',
                boxSizing: 'border-box',
                opacity: isPreloaded ? 0.7 : 1,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-blue)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-default)';
              }}
            />
          </div>
        )}

        {/* Phone input */}
        <div>
          <label
            htmlFor="auth-phone"
            style={{
              display: 'block',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-wider)',
              marginBottom: 'var(--space-1)',
            }}
          >
            Phone Number
          </label>
          <input
            ref={phoneRef}
            id="auth-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhoneLocal(e.target.value)}
            disabled={loading}
            placeholder="(787) 555-0123"
            style={{
              width: '100%',
              height: 'var(--input-height-gym)',
              padding: '0 var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--color-border-default)',
              backgroundColor: 'var(--color-bg-raised)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-base)',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              transition: 'border-color var(--duration-fast) var(--ease-default)',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-blue)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-default)';
            }}
          />
        </div>

        {/* Lookup status indicator */}
        {lookupDone && lookupResult && lookupResult.path !== 'cold' && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-green-subtle)',
              border: '1px solid color-mix(in srgb, var(--color-green) 25%, transparent)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-green-light)',
            }}
          >
            {isReturning
              ? `Welcome back, ${lookupResult.member?.first_name || lookupResult.member?.display_name}!`
              : `Account found for ${lookupResult.member?.display_name}. Verify to continue.`}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-red-subtle)',
              border: '1px solid color-mix(in srgb, var(--color-red) 25%, transparent)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-red-light)',
            }}
          >
            {error}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: 'var(--space-8)' }} />

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            height: 'var(--tap-target-lg)',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            backgroundColor: 'var(--gym-primary)',
            color: 'var(--gym-text-on-primary)',
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--weight-bold)',
            fontFamily: 'var(--font-sans)',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: `transform var(--duration-fast) var(--ease-default),
                         opacity var(--duration-fast) var(--ease-default)`,
            boxShadow: 'var(--shadow-blue)',
          }}
        >
          {loading ? 'Sending...' : 'Send Verification Code'}
        </button>
      </form>
    </div>
  );
}
