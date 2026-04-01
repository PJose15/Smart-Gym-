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
  borderRadius: 12,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  backgroundColor: 'var(--color-bg-base)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  color: 'var(--color-text-primary)',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
};

const buttonStyle: CSSProperties = {
  width: '100%',
  padding: '12px 0',
  backgroundColor: 'var(--color-red)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};

export default function AdminLoginPage() {
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

      // Verify super_admin role
      const res = await fetch('/api/admin/me');
      if (!res.ok) {
        setError('Access denied.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      router.push('/admin/overview');
    } catch {
      setError('An unexpected error occurred.');
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Nexera Admin</h1>
        <p style={{ margin: '0 0 24px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
          Sign in with your admin credentials.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@nexera.io"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
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
            <p style={{ margin: 0, color: 'var(--color-red)', fontSize: 13 }}>{error}</p>
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
