'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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

const accessDeniedStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: '#f5f5f5',
  gap: 16,
};

// Session check interval: 5 minutes
const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

interface AuthGateProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export function AuthGate({ children, requiredRoles }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Skip auth check for /auth routes to prevent redirect loop
  const isAuthRoute = pathname?.startsWith('/auth');

  const handleSignOut = useCallback(() => {
    setUser(null);
    setUserRole(null);
    router.replace('/auth');
  }, [router]);

  useEffect(() => {
    if (isAuthRoute) {
      setChecking(false);
      return;
    }

    async function checkAuth() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        handleSignOut();
        return;
      }
      setUser(data.user);

      // Issue 19: Check user role if requiredRoles specified
      if (requiredRoles && requiredRoles.length > 0) {
        const { data: membership } = await supabase
          .from('gym_members')
          .select('role')
          .eq('profile_id', data.user.id)
          .limit(1)
          .maybeSingle();
        setUserRole(membership?.role ?? null);
      }

      setChecking(false);
    }

    checkAuth();

    // Issue 14: Handle session events including token refresh errors
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        handleSignOut();
      }
      if (event === 'TOKEN_REFRESHED') {
        // Session refreshed successfully — update user
        supabase.auth.getUser().then(({ data }) => {
          if (data.user) setUser(data.user);
        });
      }
    });

    // Periodic session check to catch expired tokens proactively
    intervalRef.current = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        handleSignOut();
      }
    }, SESSION_CHECK_INTERVAL_MS);

    return () => {
      subscription.unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router, isAuthRoute, handleSignOut, requiredRoles]);

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

  // Issue 19: Role-based access check
  if (requiredRoles && requiredRoles.length > 0 && (!userRole || !requiredRoles.includes(userRole))) {
    return (
      <div style={accessDeniedStyle}>
        <h2 style={{ margin: 0, color: '#333' }}>Access Denied</h2>
        <p style={{ margin: 0, color: '#666', fontSize: 15 }}>
          You don&apos;t have permission to access this page.
        </p>
        <button
          onClick={() => router.push('/')}
          style={{ padding: '10px 24px', backgroundColor: '#4fc3f7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
