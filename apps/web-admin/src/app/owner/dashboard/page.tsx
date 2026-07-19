'use client';

import { useEffect, useState, useRef, CSSProperties } from 'react';
import { MetricCard } from '@/components/owner/MetricCard';
import { PeakHoursGrid } from '@/components/owner/PeakHoursGrid';
import { LiveActivityStrip } from '@/components/owner/LiveActivityStrip';
import { AtRiskList } from '@/components/owner/AtRiskList';
import { SessionsHourlyChart } from '@/components/owner/SessionsHourlyChart';
import { SetupChecklist } from '@/components/owner/SetupChecklist';
import { TrialCountdownBanner } from '@/components/owner/TrialCountdownBanner';
import type { OwnerDashboardMetrics, MachinePerformance, PeakHourCell, ActivityFeedItem } from '@nexera/types';
import type { OnboardingStatusResponse } from '@/app/api/owner/onboarding-status/types';

const sectionTitle: CSSProperties = { margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--color-text-secondary)' };
const cardStyle: CSSProperties = { backgroundColor: 'var(--color-bg-raised)', borderRadius: 10, padding: 20, marginBottom: 20 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle: CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--color-bg-elevated)', color: 'var(--color-text-muted)', fontWeight: 500 };
const tdStyle: CSSProperties = { padding: '8px 12px', borderBottom: '1px solid var(--color-bg-raised)' };

interface DashboardData {
  metrics: OwnerDashboardMetrics;
  machine_performance: MachinePerformance[];
  peak_hours: PeakHourCell[];
  activity: ActivityFeedItem[];
}

export default function OwnerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatusResponse | null>(null);
  const mountedRef = useRef(true);

  // One-shot fetch for onboarding status (checklist + trial)
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/owner/onboarding-status', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<OnboardingStatusResponse>;
      })
      .then((status) => {
        if (mountedRef.current) setOnboardingStatus(status);
      })
      .catch((err) => {
        if ((err as { name?: string }).name !== 'AbortError') {
          console.error('[OwnerDashboard] onboarding-status fetch failed:', err);
        }
      });
    return () => controller.abort();
  }, []);

  // Initial load + poll every 30 s for metrics
  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();

    async function fetchDashboard() {
      try {
        const res = await fetch('/api/owner/dashboard', { signal: controller.signal });
        if (!mountedRef.current) return;
        if (!res.ok) {
          setRefreshError(`Failed to refresh (HTTP ${res.status})`);
          setLoading(false);
          return;
        }
        const dashboard = await res.json();
        if (mountedRef.current) {
          setData((prev) => ({ ...dashboard, activity: prev?.activity ?? [] }));
          setRefreshError(null);
          setLoading(false);
        }
      } catch (err) {
        if (mountedRef.current && (err as { name?: string }).name !== 'AbortError') {
          setRefreshError('Failed to refresh (network error)');
          setLoading(false);
        }
      }
    }

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30_000);

    return () => {
      mountedRef.current = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  if (loading) return <p style={{ color: 'var(--color-text-secondary)' }}>Loading dashboard...</p>;
  if (!data) return (
    <div>
      <p style={{ color: 'var(--color-red)', marginBottom: 12 }}>Failed to load dashboard{refreshError ? `: ${refreshError}` : '.'}</p>
      <button
        onClick={() => window.location.reload()}
        style={{ padding: '8px 16px', backgroundColor: 'var(--color-blue)', color: 'var(--color-text-primary)', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        Retry
      </button>
    </div>
  );

  const { metrics, machine_performance, peak_hours, activity } = data;

  return (
    <div style={{ maxWidth: 1100, color: 'var(--color-text-primary)' }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>Owner Dashboard</h1>

      {refreshError && (
        <div style={{
          backgroundColor: 'var(--color-gold)22',
          color: 'var(--color-gold)',
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 13,
          marginBottom: 16,
          border: '1px solid var(--color-gold)44',
        }}>
          {refreshError} — showing last loaded data.
        </div>
      )}

      {/* Trial countdown banner — shown while trialing */}
      {onboardingStatus?.trial.is_trialing && onboardingStatus.trial.days_remaining !== null && (
        <TrialCountdownBanner daysRemaining={onboardingStatus.trial.days_remaining} />
      )}

      {/* Setup checklist — collapses when all 3 steps complete */}
      {onboardingStatus && (
        <SetupChecklist checklist={onboardingStatus.checklist} />
      )}

      {/* Live Activity Ticker */}
      <div style={{ marginBottom: 20 }}>
        <LiveActivityStrip />
      </div>

      {/* Metric Cards — flash on increase */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <MetricCard title="Total Members" value={metrics.total_members} subtitle={`${metrics.active_members_7d} active this week`} flashOnIncrease />
        <MetricCard title="Workouts This Week" value={metrics.workouts_this_week} change={metrics.workouts_change_pct} flashOnIncrease />
        <MetricCard title="Machines" value={metrics.total_machines} subtitle={`${metrics.machines_needing_maintenance} need maintenance`} />
      </div>

      {/* Sessions Today — hourly chart */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Sessions Today</h2>
        <SessionsHourlyChart />
      </div>

      {/* At-Risk Members */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>At-Risk Members</h2>
        <AtRiskList />
      </div>

      {/* Machine Performance */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Machine Performance (7 days)</h2>
        {machine_performance.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>No usage data yet.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Machine</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Sessions</th>
                <th style={thStyle}>Unique Users</th>
              </tr>
            </thead>
            <tbody>
              {machine_performance.map((m) => (
                <tr key={m.machine_id}>
                  <td style={tdStyle}>{m.machine_name}</td>
                  <td style={tdStyle}>{m.equipment_type}</td>
                  <td style={tdStyle}>{m.sessions_7d}</td>
                  <td style={tdStyle}>{m.unique_users_7d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Peak Hours */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Peak Hours (Last 30 Days)</h2>
        <PeakHoursGrid data={peak_hours} />
      </div>

      {/* Activity Feed */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Recent Activity</h2>
        {activity.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>No recent activity.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activity.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-bg-base)' }}>
                <div>
                  <span style={{ fontSize: 13 }}>{item.description}</span>
                  {item.actor_name && <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}> — {item.actor_name}</span>}
                </div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 11, flexShrink: 0 }}>
                  {new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
