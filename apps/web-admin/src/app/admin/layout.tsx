'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const shellStyle: CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: '#0F172A',
  color: '#F1F5F9',
};

const sidebarStyle: CSSProperties = {
  width: 240,
  backgroundColor: '#1E293B',
  padding: '24px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  borderRight: '1px solid #334155',
};

const mainStyle: CSSProperties = {
  flex: 1,
  padding: 32,
  backgroundColor: '#111827',
  overflowY: 'auto',
};

const spinnerContainerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: '#0F172A',
};

const notFoundStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: '#0F172A',
  color: '#64748B',
  fontSize: 18,
};

const navItemBase: CSSProperties = {
  display: 'block',
  padding: '10px 14px',
  borderRadius: 8,
  color: '#94A3B8',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  width: '100%',
  textAlign: 'left',
};

const NAV_ITEMS = [
  { href: '/admin/overview', label: 'Overview' },
  { href: '/admin/feature-flags', label: 'Feature Flags' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<'loading' | 'authed' | 'not_found'>('loading');

  // Login page renders without auth guard
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setState('authed');
      return;
    }

    let cancelled = false;

    fetch('/api/admin/me')
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState('not_found');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data?.role === 'super_admin') {
          setState('authed');
        } else {
          setState('not_found');
        }
      })
      .catch(() => {
        if (!cancelled) setState('not_found');
      });

    return () => { cancelled = true; };
  }, [isLoginPage]);

  if (state === 'not_found') {
    return (
      <div style={notFoundStyle}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 48, margin: '0 0 8px', color: '#334155' }}>404</h1>
          <p style={{ margin: 0 }}>Page not found</p>
        </div>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div style={spinnerContainerStyle}>
        <style>{`@keyframes adminspin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 32, height: 32, border: '3px solid #334155', borderTopColor: '#DC2626', borderRadius: '50%', animation: 'adminspin 0.7s linear infinite' }} />
      </div>
    );
  }

  // Login page: just render children (no sidebar)
  if (isLoginPage) {
    return <>{children}</>;
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Sign out failed — redirect to login anyway
    }
    router.push('/admin/login');
  }

  return (
    <div style={shellStyle}>
      <nav style={sidebarStyle}>
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>Nexera</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#DC2626', marginLeft: 6 }}>Admin</span>
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                router.push(item.href);
              }}
              style={{
                ...navItemBase,
                backgroundColor: isActive ? '#334155' : 'transparent',
                color: isActive ? '#F1F5F9' : '#94A3B8',
              }}
            >
              {item.label}
            </a>
          );
        })}

        <div style={{ flex: 1 }} />

        <button
          onClick={handleSignOut}
          style={{
            ...navItemBase,
            color: '#EF4444',
            marginTop: 8,
          }}
        >
          Sign Out
        </button>
      </nav>

      <main style={mainStyle}>{children}</main>
    </div>
  );
}
