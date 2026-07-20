'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CSSProperties } from 'react';

const navItems = [
  { href: '/owner/dashboard', label: 'Dashboard' },
  { href: '/owner/billing', label: 'Billing' },
  { href: '/owner/settings', label: 'Settings' },
];

const layoutStyle: CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
  color: 'var(--color-text-primary)',
};

const sidebarStyle: CSSProperties = {
  width: 220,
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
  padding: '24px 0',
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid var(--color-border-subtle)',
};

const logoStyle: CSSProperties = {
  padding: '0 20px 20px',
  borderBottom: '1px solid var(--color-border-subtle)',
  marginBottom: 16,
};

const linkStyle: CSSProperties = {
  display: 'block',
  padding: '10px 20px',
  color: 'var(--color-text-muted)',
  textDecoration: 'none',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  transition: 'background-color 0.15s, color 0.15s',
};

const activeLinkStyle: CSSProperties = {
  ...linkStyle,
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-bg-raised)',
  borderLeft: '3px solid var(--color-blue)',
  paddingLeft: 17,
};

const signOutStyle: CSSProperties = {
  marginTop: 'auto',
  padding: '12px 20px',
  color: 'var(--color-text-disabled)',
  fontSize: 'var(--text-sm)',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  textAlign: 'left',
};

const mainStyle: CSSProperties = {
  flex: 1,
  padding: 32,
  overflowY: 'auto',
};

const spinnerContainerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch('/api/auth/staff/me')
      .then((res) => {
        if (!res.ok) {
          router.replace('/staff/login');
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.role === 'owner') {
          setAuthed(true);
        } else {
          router.replace('/staff/login');
        }
      })
      .catch(() => router.replace('/staff/login'));
  }, [router]);

  if (!authed) {
    return (
      <div style={spinnerContainerStyle}>
        <style>{`@keyframes ospin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 32, height: 32, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-blue)', borderRadius: '50%', animation: 'ospin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={layoutStyle}>
      <aside style={sidebarStyle}>
        <div style={logoStyle}>
          <h1 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600, fontFamily: 'var(--font-serif)', letterSpacing: 3 }}>
            NEXERA
          </h1>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Owner
          </span>
        </div>
        <nav>
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={isActive ? activeLinkStyle : linkStyle}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => {
            fetch('/api/auth/signout', { method: 'POST' }).then(() => {
              window.location.href = '/staff/login';
            });
          }}
          style={signOutStyle}
        >
          Sign Out
        </button>
      </aside>
      <main style={mainStyle}>{children}</main>
    </div>
  );
}
