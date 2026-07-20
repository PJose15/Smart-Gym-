'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CSSProperties } from 'react';

const navItems = [
  { href: '/trainer/today', label: 'Today' },
  { href: '/trainer/members', label: 'Members' },
  { href: '/trainer/messages', label: 'Messages' },
  { href: '/trainer/profile', label: 'Profile' },
];

const sidebarStyle: CSSProperties = {
  width: 220,
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
  color: 'var(--color-text-primary)',
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
  color: 'var(--color-text-secondary)',
  textDecoration: 'none',
  fontSize: 14,
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
  color: 'var(--color-text-muted)',
  fontSize: 13,
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  textAlign: 'left',
};

export function TrainerSidebar() {
  const pathname = usePathname();

  return (
    <aside style={sidebarStyle}>
      <div style={logoStyle}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-serif)', letterSpacing: 3 }}>
          NEXERA
        </h1>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Trainer
        </span>
      </div>
      <nav>
        {navItems.map((item) => {
          const isActive = item.href === '/trainer/today'
            ? pathname === '/trainer/today'
            : pathname?.startsWith(item.href);

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
  );
}
