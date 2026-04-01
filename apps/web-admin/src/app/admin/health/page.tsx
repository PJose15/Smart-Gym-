'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { MetricCard } from '@/components/owner/MetricCard';

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 16,
  marginTop: 24,
};

const spinnerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 300,
};

const statusColors: Record<string, { color: string; bg: string; border: string }> = {
  healthy: { color: 'var(--color-green)', bg: 'var(--color-green-light)', border: 'rgba(99,153,34,0.3)' },
  degraded: { color: 'var(--color-gold)', bg: 'rgba(239,159,39,0.15)', border: 'rgba(239,159,39,0.3)' },
  critical: { color: 'var(--color-red)', bg: 'var(--color-red-light)', border: 'rgba(192,57,43,0.3)' },
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 16,
  fontSize: 13,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  color: 'var(--color-text-secondary)',
  fontWeight: 500,
  borderBottom: '1px solid var(--color-bg-elevated)',
  fontSize: 12,
};

const tdStyle: CSSProperties = {
  padding: '10px 12px',
  color: 'var(--color-text-primary)',
  borderBottom: '1px solid var(--color-bg-raised)',
};

interface HealthData {
  status: 'healthy' | 'degraded' | 'critical';
  db_healthy: boolean;
  db_latency_ms: number;
  sessions_today: number;
  unresolved_errors_24h: number;
  api_performance: { endpoint: string; avg_ms: number; request_count: number }[];
}

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState('');

  function fetchData() {
    fetch('/api/admin/health')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Failed to load health data.'));
  }

  useEffect(() => { fetchData(); }, []);

  if (error) {
    return (
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Platform Health</h1>
        <p style={{ color: 'var(--color-red)', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={spinnerStyle}>
        <style>{`@keyframes hspin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-red)', borderRadius: '50%', animation: 'hspin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Platform Health</h1>
        <button
          onClick={fetchData}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid var(--color-bg-elevated)',
            background: 'var(--color-bg-raised)',
            color: 'var(--color-text-primary)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>
      <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: 14 }}>
        System health monitoring
      </p>

      {/* Status banner */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 8,
        backgroundColor: statusColors[data.status]?.bg,
        border: `1px solid ${statusColors[data.status]?.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: statusColors[data.status]?.color,
        }} />
        <span style={{
          fontSize: 16,
          fontWeight: 600,
          color: statusColors[data.status]?.color,
          textTransform: 'capitalize',
        }}>
          {data.status}
        </span>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
          — All services {data.status === 'healthy' ? 'operational' : data.status === 'degraded' ? 'partially degraded' : 'experiencing issues'}
        </span>
      </div>

      <div style={gridStyle}>
        <MetricCard title="Database" value={data.db_healthy ? 'Connected' : 'Down'} subtitle={`${data.db_latency_ms}ms latency`} />
        <MetricCard title="Sessions Today" value={data.sessions_today} />
        <MetricCard
          title="Unresolved Errors (24h)"
          value={data.unresolved_errors_24h}
          subtitle={data.unresolved_errors_24h > 0 ? 'View in Errors page' : 'All clear'}
        />
      </div>

      {/* API Performance */}
      {data.api_performance.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text-primary)' }}>
            API Performance (Last Hour)
          </h2>
          <div style={{ backgroundColor: 'var(--color-bg-raised)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Endpoint</th>
                  <th style={thStyle}>Avg Response</th>
                  <th style={thStyle}>Requests</th>
                </tr>
              </thead>
              <tbody>
                {data.api_performance.map((perf) => (
                  <tr key={perf.endpoint}>
                    <td style={tdStyle}>{perf.endpoint}</td>
                    <td style={{ ...tdStyle, color: perf.avg_ms > 1000 ? 'var(--color-red)' : perf.avg_ms > 500 ? 'var(--color-gold)' : 'var(--color-green)' }}>
                      {perf.avg_ms}ms
                    </td>
                    <td style={tdStyle}>{perf.request_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
