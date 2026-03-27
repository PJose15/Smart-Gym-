'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/app/sidebar';
import { AuthGate } from '@/components/AuthGate';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  // /m/* routes → mobile scan flow (dark, full-bleed, no sidebar, no auth)
  if (pathname?.startsWith('/m/') || pathname === '/m') {
    return <>{children}</>;
  }

  // /auth/* routes → centered card, no sidebar (AuthGate handles bypass)
  // Everything else → sidebar + AuthGate (existing admin behavior)
  return (
    <AuthGate>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '32px', backgroundColor: '#f5f5f5' }}>
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
