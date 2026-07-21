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

// People icon — mirrors mobile's `people-outline` Feed tab icon.
const FeedIcon = (active: boolean) => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ProgressIcon = (active: boolean) => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const ProfileIcon = (active: boolean) => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// Barbell icon for the center FAB (web has no camera, so the raised crimson
// circle opens today's workout instead of the mobile QR scanner).
const BarbellIcon = (
  <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="var(--text-on-accent, #FFFFFF)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6.5 6.5v11" />
    <path d="M17.5 6.5v11" />
    <path d="M3 9v6" />
    <path d="M21 9v6" />
    <line x1="6.5" y1="12" x2="17.5" y2="12" />
  </svg>
);

// Left/right tab pairs around the center FAB — mirrors mobile's 5-slot bar:
// HOME, FEED, [scan FAB], PROGRESS, PROFILE (apps/mobile/app/(tabs)/_layout.tsx).
const LEFT_TABS: NavTab[] = [
  { path: '/home', label: 'Home', icon: HomeIcon },
  { path: '/feed', label: 'Feed', icon: FeedIcon },
];

const RIGHT_TABS: NavTab[] = [
  { path: '/progress', label: 'Progress', icon: ProgressIcon },
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

// Raised crimson FAB — mirrors mobile's ScanFab: 56px circle floating above
// the bar, 1px accent-hover border, emissive crimson glow.
const fabWrapperStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  alignSelf: 'stretch',
};

const fabStyle: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: '50%',
  marginTop: -26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--accent, #E0142F)',
  border: '1px solid var(--accent-hover, #FF2740)',
  boxShadow: '0 4px 12px rgba(224, 20, 47, 0.45)',
  cursor: 'pointer',
  padding: 0,
};

const fabActiveStyle: CSSProperties = {
  ...fabStyle,
  backgroundColor: 'var(--accent-hover, #FF2740)',
};

interface BottomNavProps {
  unreadCheckIn?: boolean;
}

export function BottomNav({ unreadCheckIn }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) =>
    pathname === path || (pathname?.startsWith(path + '/') ?? false);

  const renderTab = (tab: NavTab) => {
    const active = isActive(tab.path);
    // Unread check-in gold dot lives on Profile (check-ins moved off the bar
    // with the Program tab — Profile is where the member reads them now).
    const showGoldDot = tab.path === '/profile' && unreadCheckIn;
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
  };

  return (
    <nav style={navStyle} role="tablist" aria-label="Main navigation">
      {LEFT_TABS.map(renderTab)}
      <div style={fabWrapperStyle}>
        <button
          role="tab"
          aria-selected={isActive('/program')}
          aria-label="Today's workout"
          onClick={() => router.push('/program')}
          style={isActive('/program') ? fabActiveStyle : fabStyle}
        >
          {BarbellIcon}
        </button>
      </div>
      {RIGHT_TABS.map(renderTab)}
    </nav>
  );
}
