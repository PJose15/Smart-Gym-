'use client';

import { useEffect, useState, CSSProperties } from 'react';
import styles from './page.module.css';
import { StatCard } from './components/StatCard';
import { supabase } from '@/lib/supabase';

interface DashboardMetrics {
  totalMachines: number | null;
  activePrograms: number | null;
  members: number | null;
  sessionsToday: number | null;
}

interface RecentWorkout {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  profiles: { email: string; full_name: string } | null;
}

const sectionHeadingStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  color: '#1a1a2e',
  marginTop: 40,
  marginBottom: 16,
};

const tableContainerStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  overflow: 'hidden',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  backgroundColor: '#fafafa',
  borderBottom: '1px solid #eee',
  fontWeight: 600,
  color: '#555',
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #f0f0f0',
  color: '#333',
};

const statusBadgeBase: CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
};

const errorBoxStyle: CSSProperties = {
  backgroundColor: '#fdecea',
  color: '#b71c1c',
  padding: '14px 18px',
  borderRadius: 8,
  fontSize: 14,
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
  border: '4px solid #e0e0e0',
  borderTopColor: '#4fc3f7',
  borderRadius: '50%',
  animation: 'dashboard-spin 0.8s linear infinite',
};

function getStatusBadgeStyle(status: string): CSSProperties {
  if (status === 'completed') {
    return { ...statusBadgeBase, backgroundColor: '#e8f5e9', color: '#2e7d32' };
  }
  if (status === 'in_progress') {
    return { ...statusBadgeBase, backgroundColor: '#e3f2fd', color: '#1565c0' };
  }
  return { ...statusBadgeBase, backgroundColor: '#fff3e0', color: '#e65100' };
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
        <style>{`@keyframes dashboard-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={loadingContainerStyle}>
          <div style={spinnerStyle} />
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
        <div style={errorBoxStyle}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.description}>
        Overview of gym operations, usage statistics, and key metrics.
      </p>

      <div className={styles.grid}>
        <StatCard title="Total Machines" value={metrics.totalMachines ?? 0} change={12} trend="up" />
        <StatCard title="Active Programs" value={metrics.activePrograms ?? 0} change={-3} trend="down" />
        <StatCard title="Members" value={metrics.members ?? 0} change={8} trend="up" />
        <StatCard title="Sessions Today" value={metrics.sessionsToday ?? 0} change={15} trend="up" />
      </div>

      <h2 style={sectionHeadingStyle}>Recent Workouts</h2>
      <div style={tableContainerStyle}>
        {recentWorkouts.length === 0 ? (
          <p style={{ padding: 24, textAlign: 'center', color: '#999', fontSize: 14 }}>
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
              {recentWorkouts.map((w) => (
                <tr key={w.id}>
                  <td style={tdStyle}>{w.profiles?.full_name ?? 'Unknown'}</td>
                  <td style={tdStyle}>{w.profiles?.email ?? '--'}</td>
                  <td style={tdStyle}>
                    <span style={getStatusBadgeStyle(w.status)}>{w.status}</span>
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
  );
}
