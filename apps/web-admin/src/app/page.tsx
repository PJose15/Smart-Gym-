'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { StatCard } from './components/StatCard';
import { AnimatedPage } from './components/AnimatedPage';
import { supabase } from '@/lib/supabase';

interface DashboardMetrics {
  totalMachines: number | null;
  activePrograms: number | null;
  members: number | null;
  sessionsToday: number | null;
}

const quickActionStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
  marginBottom: 'var(--space-6)',
};

const quickActionBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-4)',
  backgroundColor: 'var(--color-blue-subtle)',
  color: 'var(--color-blue-light)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  textDecoration: 'none',
  border: '1px solid rgba(59, 139, 212, 0.2)',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), transform var(--duration-instant)',
  minHeight: 'var(--tap-target-min)',
  fontFamily: 'var(--font-sans)',
};

const timestampStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--color-text-muted)',
  textAlign: 'right',
  marginBottom: 'var(--space-2)',
  fontFamily: 'var(--font-sans)',
};

const activeWorkoutsBannerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  backgroundColor: 'var(--color-blue-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-4)',
  marginBottom: 'var(--space-5)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  color: 'var(--color-blue-light)',
  border: '1px solid rgba(59, 139, 212, 0.15)',
  fontFamily: 'var(--font-sans)',
};

const activeDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 'var(--radius-full)',
  backgroundColor: 'var(--color-blue)',
};

interface RecentWorkout {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  profiles: { email: string; full_name: string } | null;
}

const sectionHeadingStyle: CSSProperties = {
  fontSize: 'var(--text-lg)',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginTop: 'var(--space-10)',
  marginBottom: 'var(--space-4)',
  fontFamily: 'var(--font-sans)',
  letterSpacing: 'var(--tracking-tight)',
};

const tableContainerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
  border: '1px solid var(--color-border-subtle)',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-sans)',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-3) var(--space-4)',
  backgroundColor: 'var(--color-bg-elevated)',
  borderBottom: '1px solid var(--color-border-default)',
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-xs)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--tracking-wider)',
};

const tdStyle: CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--color-border-subtle)',
  color: 'var(--color-text-secondary)',
};

const statusBadgeBase: CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--text-xs)',
  fontWeight: 500,
};

const errorBoxStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-subtle)',
  color: 'var(--color-red-light)',
  padding: 'var(--space-4) var(--space-5)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  border: '1px solid rgba(192, 57, 43, 0.2)',
  fontFamily: 'var(--font-sans)',
};

const loadingContainerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '60px 0',
};

const spinnerStyle: CSSProperties = {
  width: 36,
  height: 36,
  border: '4px solid var(--color-bg-elevated)',
  borderTopColor: 'var(--color-blue)',
  borderRadius: '50%',
};

function getStatusBadgeStyle(status: string): CSSProperties {
  if (status === 'completed') {
    return { ...statusBadgeBase, backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green-light)' };
  }
  if (status === 'in_progress') {
    return { ...statusBadgeBase, backgroundColor: 'var(--color-blue-subtle)', color: 'var(--color-blue-light)' };
  }
  return { ...statusBadgeBase, backgroundColor: 'var(--color-gold-subtle)', color: 'var(--color-gold-light)' };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalMachines: null,
    activePrograms: null,
    members: null,
    sessionsToday: null,
  });
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [activeWorkouts, setActiveWorkouts] = useState(0);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayISO = todayStart.toISOString();

        const [machinesRes, programsRes, membersRes, sessionsRes, workoutsRes] =
          await Promise.all([
            supabase
              .from('machines')
              .select('id', { count: 'exact', head: true }),
            supabase
              .from('programs')
              .select('id', { count: 'exact', head: true }),
            supabase
              .from('gym_members')
              .select('id', { count: 'exact', head: true }),
            supabase
              .from('workouts')
              .select('id', { count: 'exact', head: true })
              .gte('started_at', todayISO),
            supabase
              .from('workouts')
              .select('id, status, started_at, finished_at, profiles(email, full_name)')
              .order('started_at', { ascending: false })
              .limit(5),
          ]);

        const firstError =
          machinesRes.error ||
          programsRes.error ||
          membersRes.error ||
          sessionsRes.error ||
          workoutsRes.error;

        if (firstError) {
          setError(firstError.message);
          setLoading(false);
          return;
        }

        setMetrics({
          totalMachines: machinesRes.count ?? 0,
          activePrograms: programsRes.count ?? 0,
          members: membersRes.count ?? 0,
          sessionsToday: sessionsRes.count ?? 0,
        });

        setRecentWorkouts(
          (workoutsRes.data as unknown as RecentWorkout[]) ?? []
        );

        // Count active (in_progress) workouts
        const activeCount = ((workoutsRes.data ?? []) as unknown as RecentWorkout[])
          .filter(w => w.status === 'in_progress').length;
        setActiveWorkouts(activeCount);

        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.description}>
          Overview of gym operations, usage statistics, and key metrics.
        </p>
        <div style={loadingContainerStyle}>
          <div style={spinnerStyle} className="spinner-enhanced" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.description}>
          Overview of gym operations, usage statistics, and key metrics.
        </p>
        <div style={errorBoxStyle} className="error-shake">{error}</div>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div className={styles.container}>
        <h1 className={`${styles.title} title-animate`}>Dashboard</h1>
        <p className={`${styles.description} subtitle-animate`}>
          Overview of gym operations, usage statistics, and key metrics.
        </p>

        {/* Last Updated */}
        {lastUpdated && (
          <p style={timestampStyle}>Updated at {lastUpdated}</p>
        )}

        {/* Quick Actions */}
        <div style={quickActionStyle}>
          <Link href="/machines" style={quickActionBtnStyle}>Machines</Link>
          <Link href="/programs/create" style={quickActionBtnStyle}>+ New Program</Link>
          <Link href="/members" style={quickActionBtnStyle}>Members</Link>
          <Link href="/analytics" style={quickActionBtnStyle}>Analytics</Link>
        </div>

        {/* Active Workouts Banner */}
        {activeWorkouts > 0 && (
          <div style={activeWorkoutsBannerStyle} className="status-pulse">
            <div style={activeDotStyle} />
            {activeWorkouts} workout{activeWorkouts !== 1 ? 's' : ''} in progress right now
          </div>
        )}

        <div className={styles.grid}>
          <StatCard title="Total Machines" value={metrics.totalMachines ?? 0} change={12} trend="up" index={0} />
          <StatCard title="Active Programs" value={metrics.activePrograms ?? 0} change={-3} trend="down" index={1} />
          <StatCard title="Members" value={metrics.members ?? 0} change={8} trend="up" index={2} />
          <StatCard title="Sessions Today" value={metrics.sessionsToday ?? 0} change={15} trend="up" index={3} />
        </div>

        <h2 style={sectionHeadingStyle} className="title-animate">Recent Workouts</h2>
        <div style={tableContainerStyle} className="section-glow">
          {recentWorkouts.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }} className="empty-breathe">
              No workouts recorded yet.
            </p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Member</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Started</th>
                  <th style={thStyle}>Finished</th>
                </tr>
              </thead>
              <tbody>
                {recentWorkouts.map((w, i) => (
                  <tr key={w.id} className={`row-stagger stagger-${i} table-row-hover`}>
                    <td style={tdStyle}>{w.profiles?.full_name ?? 'Unknown'}</td>
                    <td style={tdStyle}>{w.profiles?.email ?? '--'}</td>
                    <td style={tdStyle}>
                      <span
                        style={getStatusBadgeStyle(w.status)}
                        className={w.status === 'in_progress' ? 'status-pulse' : ''}
                      >
                        {w.status}
                      </span>
                    </td>
                    <td style={tdStyle}>{formatDate(w.started_at)}</td>
                    <td style={tdStyle}>{w.finished_at ? formatDate(w.finished_at) : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
