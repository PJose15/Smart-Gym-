'use client';

import { CSSProperties } from 'react';
import { TrainerSidebar } from '@/components/TrainerSidebar';
import { StaffProvider } from '@/lib/contexts/StaffContext';

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
  return (
    <StaffProvider
      allowedRoles={['trainer', 'owner']}
      fallback={
        <div style={spinnerContainerStyle}>
          <style>{`@keyframes tspin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ width: 32, height: 32, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-blue)', borderRadius: '50%', animation: 'tspin 0.7s linear infinite' }} />
        </div>
      }
    >
      <div style={shellStyle}>
        <TrainerSidebar />
        <main style={mainStyle}>{children}</main>
      </div>
    </StaffProvider>
  );
}
