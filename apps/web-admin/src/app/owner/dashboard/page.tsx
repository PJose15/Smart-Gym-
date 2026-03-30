'use client';

import { useEffect, useState, useRef, CSSProperties } from 'react';
import { MetricCard } from '@/components/owner/MetricCard';
import { PeakHoursGrid } from '@/components/owner/PeakHoursGrid';
import { LiveActivityStrip } from '@/components/owner/LiveActivityStrip';
import { AtRiskList } from '@/components/owner/AtRiskList';
import { SessionsHourlyChart } from '@/components/owner/SessionsHourlyChart';
import type { OwnerDashboardMetrics, MachinePerformance, PeakHourCell, ActivityFeedItem } from '@nexera/types';

const sectionTitle: CSSProperties = { margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#94A3B8' };
const cardStyle: CSSProperties = { backgroundColor: '#1E293B', borderRadius: 10, padding: 20, marginBottom: 20 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle: CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #334155', color: '#64748B', fontWeight: 500 };
const tdStyle: CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #1E293B' };

interface DashboardData {
  metrics: OwnerDashboardMetrics;
  machine_performance: MachinePerformance[];
  peak_hours: PeakHourCell[];
  activity: ActivityFeedItem[];
}

export default function OwnerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Initial load + poll every 30 s for metrics
  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();

    async function fetchDashboard() {
      try {
        const res = await fetch('/api/owner/dashboard', { signal: controller.signal });
        if (!res.ok || !mountedRef.current) {
          if (mountedRef.current) setLoading(false);
          return;
        }
        const dashboard = await res.json();
        if (mountedRef.current) {
          setData((prev) => ({ ...dashboard, activity: prev?.activity ?? [] }));
          setLoading(false);
        }
      } catch {
        if (mountedRef.current) setLoading(false);
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

  if (loading) return <p style={{ color: '#94A3B8' }}>Loading dashboard...</p>;
  if (!data) return <p style={{ color: '#EF4444' }}>Failed to load dashboard.</p>;

  const { metrics, machine_performance, peak_hours, activity } = data;

  return (
    <div style={{ maxWidth: 1100, color: '#F1F5F9' }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>Owner Dashboard</h1>

      {/* Live Activity Ticker */}
      <div style={{ marginBottom: 20 }}>
        <LiveActivityStrip />
      </div>

      {/* Metric Cards — flash on increase */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <MetricCard title="Total Members" value={metrics.total_members} subtitle={`${metrics.active_members_7d} active this week`} flashOnIncrease />
        <MetricCard title="Workouts This Week" value={metrics.workouts_this_week} change={metrics.workouts_change_pct} flashOnIncrease />
        <MetricCard title="Machines" value={metrics.total_machines} subtitle={`${metrics.machines_needing_maintenance} need maintenance`} />
        <MetricCard title="Revenue" value="Coming Soon" placeholder />
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
          <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>No usage data yet.</p>
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
          <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>No recent activity.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activity.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #0F172A' }}>
                <div>
                  <span style={{ fontSize: 13 }}>{item.description}</span>
                  {item.actor_name && <span style={{ color: '#94A3B8', fontSize: 12 }}> — {item.actor_name}</span>}
                </div>
                <span style={{ color: '#64748B', fontSize: 11, flexShrink: 0 }}>
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
