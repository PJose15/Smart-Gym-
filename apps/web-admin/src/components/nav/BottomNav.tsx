'use client';

import { usePathname, useRouter } from 'next/navigation';
import { CSSProperties } from 'react';

interface NavTab {
  path: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const ICON_SIZE = 24;
const ACTIVE_COLOR = 'var(--accent, #E0142F)';
const INACTIVE_COLOR = 'var(--color-text-muted)';

const HomeIcon = (active: boolean) => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ProgramIcon = (active: boolean) => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const ProgressIcon = (active: boolean) => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const GymIcon = (active: boolean) => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </svg>
);

const ProfileIcon = (active: boolean) => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const TABS: NavTab[] = [
  { path: '/home', label: 'Home', icon: HomeIcon },
  { path: '/program', label: 'Program', icon: ProgramIcon },
  { path: '/progress', label: 'Progress', icon: ProgressIcon },
  { path: '/gym', label: 'Gym', icon: GymIcon },
  { path: '/profile', label: 'Profile', icon: ProfileIcon },
];

const navStyle: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: 64,
  backgroundColor: 'var(--color-bg-raised, #121214)',
  borderTop: '1px solid var(--color-border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-around',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  zIndex: 50,
  maxWidth: 480,
  margin: '0 auto',
};

const tabStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  padding: '8px 0',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  flex: 1,
  fontFamily: 'var(--font-sans)',
};

interface BottomNavProps {
  unreadCheckIn?: boolean;
}

export function BottomNav({ unreadCheckIn }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav style={navStyle} role="tablist" aria-label="Main navigation">
      {TABS.map((tab) => {
        const active = pathname === tab.path || (pathname?.startsWith(tab.path + '/') ?? false);
        const showGoldDot = tab.path === '/program' && unreadCheckIn;
        return (
          <button
            key={tab.path}
            role="tab"
            aria-selected={active}
            aria-label={showGoldDot ? `${tab.label} (unread check-in)` : tab.label}
            onClick={() => router.push(tab.path)}
            style={tabStyle}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              {tab.icon(active)}
              {showGoldDot && (
                <div
                  role="presentation"
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 8,
                    height: 8,
                    background: 'var(--gold, #E8B339)',
                    borderRadius: '50%',
                    border: '1.5px solid var(--color-bg-raised, #121214)',
                  }}
                />
              )}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: active ? 600 : 500,
              color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
              lineHeight: 1,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {tab.label}
            </span>
            {active && (
              <div style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                backgroundColor: ACTIVE_COLOR,
                marginTop: 1,
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
