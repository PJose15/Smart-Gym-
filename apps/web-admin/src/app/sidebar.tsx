'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CSSProperties } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/machines', label: 'Machines' },
  { href: '/programs', label: 'Programs' },
  { href: '/members', label: 'Members' },
  { href: '/settings', label: 'Settings' },
];

const sidebarStyle: CSSProperties = {
  width: 240,
  minHeight: '100vh',
  backgroundColor: '#1a1a2e',
  color: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  padding: 0,
};

const logoContainerStyle: CSSProperties = {
  padding: '24px 20px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
};

const logoStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  margin: 0,
  letterSpacing: '0.5px',
};

const logoAccentStyle: CSSProperties = {
  color: '#4fc3f7',
};

const navStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '16px 0',
  gap: 2,
};

function getLinkStyle(isActive: boolean): CSSProperties {
  return {
    display: 'block',
    padding: '12px 20px',
    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
    backgroundColor: isActive ? 'rgba(79, 195, 247, 0.15)' : 'transparent',
    borderLeft: isActive ? '3px solid #4fc3f7' : '3px solid transparent',
    textDecoration: 'none',
    fontSize: 15,
    fontWeight: isActive ? 600 : 400,
    transition: 'background-color 0.15s, color 0.15s',
  };
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={sidebarStyle}>
      <div style={logoContainerStyle}>
        <h1 style={logoStyle}>
          Smart<span style={logoAccentStyle}>Gym</span>
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          Admin Panel
        </p>
      </div>
      <nav style={navStyle}>
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href} style={getLinkStyle(isActive)}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
