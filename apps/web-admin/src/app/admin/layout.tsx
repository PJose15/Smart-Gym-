'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const shellStyle: CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
  color: 'var(--color-text-primary)',
};

const sidebarStyle: CSSProperties = {
  width: 240,
  backgroundColor: 'var(--color-bg-raised)',
  padding: '24px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  borderRight: '1px solid var(--color-border-default)',
};

const mainStyle: CSSProperties = {
  flex: 1,
  padding: 32,
  backgroundColor: 'var(--color-bg-base)',
  overflowY: 'auto',
};

const spinnerContainerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
};

const notFoundStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
  color: 'var(--color-text-muted)',
  fontSize: 18,
};

const navItemBase: CSSProperties = {
  display: 'block',
  padding: '10px 14px',
  borderRadius: 8,
  color: 'var(--color-text-secondary)',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  width: '100%',
  textAlign: 'left',
};

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin/overview', label: 'Overview' },
      { href: '/admin/health', label: 'Health' },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/admin/gyms', label: 'Gyms' },
      { href: '/admin/billing', label: 'Billing' },
      { href: '/admin/members', label: 'Members' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/admin/ai-costs', label: 'AI Costs' },
      { href: '/admin/errors', label: 'Errors' },
      { href: '/admin/agents', label: 'Agents' },
    ],
  },
  {
    label: 'Config',
    items: [
      { href: '/admin/feature-flags', label: 'Feature Flags' },
    ],
  },
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
          <h1 style={{ fontSize: 48, margin: '0 0 8px', color: 'var(--color-bg-elevated)' }}>404</h1>
          <p style={{ margin: 0 }}>Page not found</p>
        </div>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div style={spinnerContainerStyle}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-red)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
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
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>Nexera</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-red)', marginLeft: 6 }}>Admin</span>
        </div>

        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} style={{ marginTop: gi > 0 ? 16 : 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 14px 6px' }}>
              {group.label}
            </div>
            {group.items.map((item) => {
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
                    backgroundColor: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}

        <div style={{ flex: 1 }} />

        <button
          onClick={handleSignOut}
          style={{
            ...navItemBase,
            color: 'var(--color-red)',
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
