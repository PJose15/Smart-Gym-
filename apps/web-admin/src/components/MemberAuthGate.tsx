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
      router.replace('/m/welcome');
    }
  }, [loading, member, router]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-dark, #0F172A)',
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
