'use client';

import { useState, CSSProperties, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const containerStyle: CSSProperties = {
  width: '100%',
  maxWidth: 400,
  backgroundColor: '#ffffff',
  borderRadius: 14,
  padding: '40px 36px',
  border: '1px solid rgba(79, 195, 247, 0.1)',
};

const logoStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  margin: 0,
  textAlign: 'center',
  color: '#1a1a2e',
  letterSpacing: '0.5px',
};

const logoAccentStyle: CSSProperties = {
  color: '#4fc3f7',
};

const subtitleStyle: CSSProperties = {
  textAlign: 'center',
  color: '#888',
  fontSize: 14,
  margin: '8px 0 32px',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#1a1a2e',
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 15,
  border: '1px solid #ddd',
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const buttonStyle: CSSProperties = {
  width: '100%',
  padding: '12px',
  fontSize: 15,
  fontWeight: 600,
  color: '#ffffff',
  backgroundColor: '#4fc3f7',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  marginTop: 8,
};

const buttonDisabledStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#b0b0b0',
  cursor: 'not-allowed',
};

const errorStyle: CSSProperties = {
  backgroundColor: '#fdecea',
  color: '#b71c1c',
  padding: '10px 14px',
  borderRadius: 6,
  fontSize: 14,
  marginBottom: 16,
};

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.replace('/');
  }

  return (
    <div style={containerStyle} className="auth-card-enter">
      <h1 style={logoStyle}>
        Smart<span style={logoAccentStyle}>Gym</span>
      </h1>
      <p style={subtitleStyle}>Admin Panel</p>

      {error && <div style={errorStyle} className="error-shake">{error}</div>}

      <form onSubmit={handleSubmit}>
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
            placeholder="admin@smartgym.com"
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
            placeholder="Enter your password"
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={loading ? buttonDisabledStyle : buttonStyle}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p style={footerStyle}>SmartGym Admin v0.1.0</p>
    </div>
  );
}

const footerStyle: CSSProperties = {
  textAlign: 'center',
  color: '#bbb',
  fontSize: 12,
  marginTop: 24,
  marginBottom: 0,
};
