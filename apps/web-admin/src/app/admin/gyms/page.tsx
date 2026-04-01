'use client';

import { useEffect, useState, useCallback, CSSProperties } from 'react';
import { MetricCard } from '@/components/owner/MetricCard';

const spinnerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 300,
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

const filterBarStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 16,
  marginBottom: 16,
  flexWrap: 'wrap',
};

const selectStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--color-bg-elevated)',
  background: 'var(--color-bg-raised)',
  color: 'var(--color-text-primary)',
  fontSize: 13,
};

const inputStyle: CSSProperties = {
  ...selectStyle,
  flex: 1,
  minWidth: 200,
};

const badgeStyle = (color: string, bg: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: bg,
  color,
});

interface GymEntry {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  tier: string;
  status: string;
  members: number;
  sessions_30d: number;
  health_score: number;
}

interface GymsData {
  gyms: GymEntry[];
  summary: Record<string, number>;
}

const tierColors: Record<string, { color: string; bg: string }> = {
  pro: { color: '#A855F7', bg: 'rgba(168,85,247,0.1)' },
  growth: { color: 'var(--color-blue)', bg: 'var(--color-blue-subtle)' },
  starter: { color: 'var(--color-text-secondary)', bg: 'var(--color-bg-elevated)' },
};

const statusColors: Record<string, { color: string; bg: string }> = {
  active: { color: 'var(--color-green)', bg: 'var(--color-green-light)' },
  trialing: { color: 'var(--color-blue)', bg: 'var(--color-blue-subtle)' },
  past_due: { color: 'var(--color-red)', bg: 'var(--color-red-light)' },
  cancelled: { color: 'var(--color-text-muted)', bg: 'var(--color-bg-elevated)' },
};

const defaultBadge = { color: 'var(--color-text-secondary)', bg: 'var(--color-bg-elevated)' };

function healthColor(score: number): string {
  if (score >= 80) return 'var(--color-green)';
  if (score >= 50) return 'var(--color-gold)';
  return 'var(--color-red)';
}

export default function AdminGymsPage() {
  const [data, setData] = useState<GymsData | null>(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(() => {
    const params = new URLSearchParams({
      status: statusFilter,
      tier: tierFilter,
      ...(search ? { search } : {}),
    });
    fetch(`/api/admin/gyms?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Failed to load gyms data.'));
  }, [statusFilter, tierFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (error) {
    return (
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Gyms</h1>
        <p style={{ color: 'var(--color-red)', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={spinnerStyle}>
        <style>{`@keyframes gspin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-red)', borderRadius: '50%', animation: 'gspin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Gyms</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: 14 }}>
        Platform gym management and health monitoring
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
        <MetricCard title="Active" value={data.summary.active ?? 0} />
        <MetricCard title="Trial" value={data.summary.trialing ?? 0} />
        <MetricCard title="Past Due" value={data.summary.past_due ?? 0} />
        <MetricCard title="Cancelled" value={data.summary.cancelled ?? 0} />
      </div>

      <div style={filterBarStyle}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past Due</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Plans</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="pro">Pro</option>
        </select>
        <input
          type="text"
          placeholder="Search gym name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ backgroundColor: 'var(--color-bg-raised)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Plan</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Members</th>
              <th style={thStyle}>Sessions (30d)</th>
              <th style={thStyle}>Health</th>
            </tr>
          </thead>
          <tbody>
            {data.gyms.map((gym) => (
              <tr key={gym.id}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{gym.name}</td>
                <td style={tdStyle}>
                  <span style={badgeStyle((tierColors[gym.tier] ?? defaultBadge).color, (tierColors[gym.tier] ?? defaultBadge).bg)}>
                    {gym.tier}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={badgeStyle((statusColors[gym.status] ?? defaultBadge).color, (statusColors[gym.status] ?? defaultBadge).bg)}>
                    {gym.status}
                  </span>
                </td>
                <td style={tdStyle}>{gym.members}</td>
                <td style={tdStyle}>{gym.sessions_30d}</td>
                <td style={tdStyle}>
                  <span style={{ color: healthColor(gym.health_score), fontWeight: 600 }}>
                    {gym.health_score}
                  </span>
                </td>
              </tr>
            ))}
            {data.gyms.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                  No gyms found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
