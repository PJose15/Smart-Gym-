'use client';

import { MemberProvider, useMember } from '@/lib/contexts/MemberContext';
import { MemberAuthGate } from '@/components/MemberAuthGate';
import { BottomNav } from '@/components/nav/BottomNav';
import { CelebrationManager } from '@/components/celebrations';
import { useUnreadCheckIn } from '@/hooks/useUnreadCheckIn';
import { CSSProperties, useEffect } from 'react';

const shellStyle: CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
  color: 'var(--color-text-primary)',
  position: 'relative',
};

const mainStyle: CSSProperties = {
  paddingBottom: 80, // BottomNav height + safe margin
};

/** Inner shell that can use MemberContext hooks */
function MemberShell({ children }: { children: React.ReactNode }) {
  const { member } = useMember();
  const { hasUnread } = useUnreadCheckIn(member?.id ?? '');

  return (
    <div style={shellStyle}>
      <main style={mainStyle}>
        {children}
      </main>
      <BottomNav unreadCheckIn={hasUnread} />
      <CelebrationManager />
    </div>
  );
}

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <MemberProvider>
      <MemberAuthGate>
        <MemberShell>{children}</MemberShell>
      </MemberAuthGate>
    </MemberProvider>
  );
}
