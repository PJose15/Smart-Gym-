'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { TrainerSidebar } from '@/components/TrainerSidebar';

const shellStyle: CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
  color: 'var(--color-text-primary)',
};

const mainStyle: CSSProperties = {
  flex: 1,
  padding: 'var(--space-8)',
  backgroundColor: 'var(--color-bg-base)',
  overflowY: 'auto',
};

const spinnerContainerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
};

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
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
        if (data && (data.role === 'trainer' || data.role === 'owner')) {
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
        <style>{`@keyframes tspin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 32, height: 32, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-blue)', borderRadius: '50%', animation: 'tspin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <TrainerSidebar />
      <main style={mainStyle}>{children}</main>
    </div>
  );
}
