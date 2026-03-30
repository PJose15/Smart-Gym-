'use client';

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
  backgroundColor: '#0F172A',
  color: '#F1F5F9',
};

const sidebarStyle: CSSProperties = {
  width: 220,
  minHeight: '100vh',
  backgroundColor: '#0F172A',
  padding: '24px 0',
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid #1E293B',
};

const logoStyle: CSSProperties = {
  padding: '0 20px 20px',
  borderBottom: '1px solid #1E293B',
  marginBottom: 16,
};

const linkStyle: CSSProperties = {
  display: 'block',
  padding: '10px 20px',
  color: '#94A3B8',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
  transition: 'background-color 0.15s, color 0.15s',
};

const activeLinkStyle: CSSProperties = {
  ...linkStyle,
  color: '#F1F5F9',
  backgroundColor: '#1E293B',
  borderLeft: '3px solid #3B82F6',
  paddingLeft: 17,
};

const signOutStyle: CSSProperties = {
  marginTop: 'auto',
  padding: '12px 20px',
  color: '#64748B',
  fontSize: 13,
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

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={layoutStyle}>
      <aside style={sidebarStyle}>
        <div style={logoStyle}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Nexera <span style={{ color: '#3B82F6' }}>Owner</span>
          </h1>
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
