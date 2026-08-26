'use client';

import { useState, CSSProperties, FormEvent } from 'react';

const containerStyle: CSSProperties = {
  width: '100%',
  maxWidth: 400,
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-lg)',
  padding: '40px 36px',
  border: '1px solid var(--color-border-subtle)',
};

const logoStyle: CSSProperties = {
  fontSize: 'var(--text-2xl)',
  fontWeight: 600,
  margin: 0,
  textAlign: 'center',
  color: 'var(--color-text-primary)',
  letterSpacing: 3,
  fontFamily: 'var(--font-serif)',
};

const subtitleStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-sm)',
  margin: '8px 0 32px',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 'var(--text-base)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-sm)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-primary)',
};

const buttonStyle: CSSProperties = {
  width: '100%',
  padding: '12px',
  fontSize: 'var(--text-base)',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-blue)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  marginTop: 8,
};

const buttonDisabledStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: 'var(--color-text-disabled)',
  cursor: 'not-allowed',
};

const errorStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-subtle)',
  color: 'var(--color-red-light)',
  padding: '10px 14px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-sm)',
  marginBottom: 16,
};

const toggleStyle: CSSProperties = {
  textAlign: 'center',
  marginTop: 20,
  fontSize: 'var(--text-sm)',
  color: 'var(--color-text-secondary)',
};

const toggleLinkStyle: CSSProperties = {
  color: 'var(--color-blue)',
  fontWeight: 600,
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  fontSize: 'var(--text-sm)',
  textDecoration: 'underline',
  padding: 0,
};

const footerStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--color-text-disabled)',
  fontSize: 'var(--text-xs)',
  marginTop: 24,
  marginBottom: 0,
};

type Mode = 'phone' | 'email';
type PhoneStep = 'enter' | 'code';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('phone');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Phone sign-in
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('enter');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  // Email sign-in (staff / owners)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPhoneStep('enter');
    setCode('');
  }

  // ── Phone: request a sign-in code ─────────────────────────────
  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "We couldn't send a code. Make sure you're registered at your gym.");
        setLoading(false);
        return;
      }
      setPhoneStep('code');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Phone: verify code → session cookie → member home ─────────
  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'Invalid code. Please try again.');
        setCode('');
        setLoading(false);
        return;
      }
      // Cookie session is set by the response; full nav so MemberContext hydrates.
      window.location.href = '/home';
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  // ── Email: staff / owner sign-in ──────────────────────────────
  async function handleEmailSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/member/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'Sign in failed.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      // Members land on /home; staff/owner accounts (no member row) on the dashboard.
      window.location.href = data.member_id ? '/home' : '/';
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  const maskedPhone = phone.replace(/(\+?\d{0,2})(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4');

  return (
    <div style={containerStyle} className="auth-card-enter">
      <h1 style={logoStyle}>NEXERA</h1>
      <p style={subtitleStyle}>Sign in</p>

      {error && <div style={errorStyle} className="error-shake">{error}</div>}

      {mode === 'phone' ? (
        phoneStep === 'enter' ? (
          <form onSubmit={handleSendCode}>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle} htmlFor="phone">Phone number</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
                className="input-animate"
                placeholder="+1 (787) 555-1234"
                required
                autoComplete="tel"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={loading ? buttonDisabledStyle : buttonStyle}>
              {loading ? 'Sending code...' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
            <p style={{ ...subtitleStyle, margin: '0 0 20px' }}>
              We sent a 6-digit code to{' '}
              <span style={{ color: 'var(--color-text-secondary)' }}>{maskedPhone}</span>
            </p>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle} htmlFor="code">Verification code</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={inputStyle}
                className="input-animate"
                placeholder="123456"
                required
                autoComplete="one-time-code"
                maxLength={6}
              />
            </div>
            <button type="submit" disabled={loading || code.length !== 6} className="btn-primary" style={loading || code.length !== 6 ? buttonDisabledStyle : buttonStyle}>
              {loading ? 'Verifying...' : 'Verify & sign in'}
            </button>
            <div style={toggleStyle}>
              <button type="button" style={toggleLinkStyle} onClick={() => { setPhoneStep('enter'); setCode(''); setError(null); }}>
                ← Use a different number
              </button>
            </div>
          </form>
        )
      ) : (
        <form onSubmit={handleEmailSignIn}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              className="input-animate"
              placeholder="you@gym.com"
              required
              autoComplete="email"
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              className="input-animate"
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={loading ? buttonDisabledStyle : buttonStyle}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      )}

      <div style={toggleStyle}>
        {mode === 'phone' ? (
          <>
            Staff or gym owner?{' '}
            <button type="button" style={toggleLinkStyle} onClick={() => switchMode('email')}>
              Sign in with email
            </button>
          </>
        ) : (
          <>
            Member?{' '}
            <button type="button" style={toggleLinkStyle} onClick={() => switchMode('phone')}>
              Sign in with phone
            </button>
          </>
        )}
      </div>

      <p style={footerStyle}>Nexera v0.1.0</p>
    </div>
  );
}
