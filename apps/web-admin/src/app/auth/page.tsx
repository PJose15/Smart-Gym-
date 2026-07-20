'use client';

import { useState, CSSProperties, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

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

const successStyle: CSSProperties = {
  backgroundColor: 'var(--color-green-subtle)',
  color: 'var(--color-green-light)',
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

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name || email.split('@')[0] },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Try to sign in immediately (works if email confirmation is disabled)
      const { error: autoSignIn } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (autoSignIn) {
        setSuccess('Account created! Check your email to confirm, then sign in.');
        setMode('signin');
        setLoading(false);
        return;
      }

      window.location.href = '/';
      return;
    }

    // Server-side sign-in sets the cookie session that member API routes
    // read — a client-side (localStorage) session never reaches them.
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
    // Members land on the member home; accounts without a member row
    // (staff signing in here by mistake) go to the root dashboard.
    window.location.href = data.member_id ? '/home' : '/';
  }

  return (
    <div style={containerStyle} className="auth-card-enter">
      <h1 style={logoStyle}>
        NEXERA
      </h1>
      <p style={subtitleStyle}>
        {mode === 'signin' ? 'Admin Panel' : 'Create Account'}
      </p>

      {error && <div style={errorStyle} className="error-shake">{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <form onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="name">
              Display Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              className="input-animate"
              placeholder="Pedro"
              autoComplete="name"
            />
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            className="input-animate"
            placeholder="admin@nexera.com"
            required
            autoComplete="email"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            className="input-animate"
            placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter your password'}
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={loading ? buttonDisabledStyle : buttonStyle}
        >
          {loading
            ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
            : (mode === 'signin' ? 'Sign In' : 'Create Account')}
        </button>
      </form>

      <div style={toggleStyle}>
        {mode === 'signin' ? (
          <>
            No account?{' '}
            <button
              type="button"
              style={toggleLinkStyle}
              onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
            >
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              style={toggleLinkStyle}
              onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
            >
              Sign in
            </button>
          </>
        )}
      </div>

      <p style={footerStyle}>Nexera Admin v0.1.0</p>
    </div>
  );
}

const footerStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--color-text-disabled)',
  fontSize: 'var(--text-xs)',
  marginTop: 24,
  marginBottom: 0,
};
