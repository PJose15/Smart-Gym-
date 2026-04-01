'use client';

import { useState, FormEvent, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const pageStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
  color: 'var(--color-text-primary)',
};

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 400,
  padding: 32,
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-lg)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  backgroundColor: 'var(--color-bg-base)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--text-base)',
  outline: 'none',
  boxSizing: 'border-box',
};

const buttonStyle: CSSProperties = {
  width: '100%',
  padding: '12px 0',
  backgroundColor: 'var(--color-blue)',
  color: 'var(--color-text-primary)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-base)',
  fontWeight: 600,
  cursor: 'pointer',
};

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Check role to determine redirect
      const res = await fetch('/api/auth/staff/me');
      if (!res.ok) {
        setError('Account does not have staff access.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.role === 'owner') {
        router.push('/owner/dashboard');
      } else {
        router.push('/trainer/today');
      }
    } catch {
      setError('An unexpected error occurred.');
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: '0 0 8px', fontSize: 'var(--text-xl)', fontWeight: 600 }}>Staff Login</h1>
        <p style={{ margin: '0 0 24px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Sign in with your staff email and password.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trainer@gym.com"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <p style={{ margin: 0, color: 'var(--color-red-light)', fontSize: 'var(--text-sm)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
