'use client';

import { useState, FormEvent, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const pageStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: '#0F172A',
  color: '#F1F5F9',
};

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 400,
  padding: 32,
  backgroundColor: '#1E293B',
  borderRadius: 12,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  backgroundColor: '#0F172A',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#F1F5F9',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
};

const buttonStyle: CSSProperties = {
  width: '100%',
  padding: '12px 0',
  backgroundColor: '#3B82F6',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 15,
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
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Staff Login</h1>
        <p style={{ margin: '0 0 24px', color: '#94A3B8', fontSize: 14 }}>
          Sign in with your staff email and password.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94A3B8' }}>
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
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94A3B8' }}>
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
            <p style={{ margin: 0, color: '#EF4444', fontSize: 13 }}>{error}</p>
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
