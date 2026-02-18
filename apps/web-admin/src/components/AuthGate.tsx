'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { CSSProperties } from 'react';

const spinnerContainerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: '#f5f5f5',
};

const spinnerStyle: CSSProperties = {
  width: 40,
  height: 40,
  border: '4px solid #e0e0e0',
  borderTopColor: '#4fc3f7',
  borderRadius: '50%',
  animation: 'authgate-spin 0.8s linear infinite',
};

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  // Skip auth check for /auth routes to prevent redirect loop
  const isAuthRoute = pathname?.startsWith('/auth');

  useEffect(() => {
    if (isAuthRoute) {
      setChecking(false);
      return;
    }

    async function checkAuth() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace('/auth');
        return;
      }
      setUser(data.user);
      setChecking(false);
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        router.replace('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, isAuthRoute]);

  // Auth routes bypass the gate entirely
  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div style={spinnerContainerStyle}>
        <style>{`@keyframes authgate-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={spinnerStyle} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
