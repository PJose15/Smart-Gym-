'use client';

import { useMember } from '@/lib/contexts/MemberContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface MemberAuthGateProps {
  children: React.ReactNode;
}

export function MemberAuthGate({ children }: MemberAuthGateProps) {
  const { member, loading } = useMember();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !member) {
      // Signed-out (or expired) members go to the sign-in page — /m/welcome
      // is the scan-flow landing for non-members and has no login path.
      router.replace('/auth');
    }
  }, [loading, member, router]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-base)',
      }}>
        <div
          className="skeleton"
          style={{ width: 40, height: 40, borderRadius: '50%' }}
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!member) return null;

  return <>{children}</>;
}
