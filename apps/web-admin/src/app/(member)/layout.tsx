'use client';

import { MemberProvider, useMember } from '@/lib/contexts/MemberContext';
import { MemberAuthGate } from '@/components/MemberAuthGate';
import { BottomNav } from '@/components/nav/BottomNav';
import { CelebrationManager } from '@/components/celebrations';
import { useUnreadCheckIn } from '@/hooks/useUnreadCheckIn';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';
import { CSSProperties, useEffect, useRef } from 'react';

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

/**
 * Registers a web-push subscription once the member is authenticated.
 * Side-effect only (no UI). Non-intrusive: it only auto-subscribes when the
 * user has ALREADY granted notification permission — it never forces a prompt
 * on page load. No-ops when push is unsupported or NEXT_PUBLIC_VAPID_PUBLIC_KEY
 * is unset (subscribe() guards on the key). The `subscribe` call itself will
 * re-request permission if needed; gating on 'granted' here keeps it quiet.
 */
function PushSubscriptionMount({ memberId, gymId }: { memberId: string; gymId: string }) {
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (!isSupported || isSubscribed || !memberId || !gymId) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    attempted.current = true;
    void subscribe(memberId, gymId).catch(() => {
      // Non-critical — allow a later retry if the effect re-runs.
      attempted.current = false;
    });
  }, [isSupported, isSubscribed, memberId, gymId, subscribe]);

  return null;
}

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
      {member && (
        <PushSubscriptionMount memberId={member.id} gymId={member.gym_id} />
      )}
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
