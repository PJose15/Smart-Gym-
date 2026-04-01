'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { MetricCard } from '@/components/owner/MetricCard';
import type { PlatformOverviewData } from '@nexera/types';

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

const healthColors: Record<string, string> = {
  healthy: 'var(--color-green)',
  degraded: 'var(--color-gold)',
  down: 'var(--color-red)',
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<PlatformOverviewData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/overview')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Failed to load overview data.'));
  }, []);

  if (error) {
    return (
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Platform Overview</h1>
        <p style={{ color: 'var(--color-red)', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={spinnerStyle}>
        <style>{`@keyframes ospin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-red)', borderRadius: '50%', animation: 'ospin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Platform Overview</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: 14 }}>
        Real-time platform metrics
      </p>

      <div style={gridStyle}>
        <MetricCard title="Active Gyms" value={data.active_gyms} />
        <MetricCard title="Total Members" value={data.total_members.toLocaleString()} />
        <MetricCard title="Sessions Today" value={data.sessions_today} />
        <MetricCard title="MRR" value={`$${data.mrr_usd.toLocaleString()}`} />
        <MetricCard title="OpenAI Costs (30d)" value={`$${data.openai_cost_30d.toFixed(2)}`} />
        <MetricCard title="New Registrations (7d)" value={data.new_registrations_7d} />
        <div style={{
          backgroundColor: 'var(--color-bg-raised)',
          borderRadius: 10,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 500 }}>Health Status</div>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: healthColors[data.health_status] ?? 'var(--color-text-primary)',
            textTransform: 'capitalize',
          }}>
            {data.health_status}
          </div>
        </div>
      </div>
    </div>
  );
}
