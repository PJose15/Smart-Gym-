'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { MetricCard } from '@/components/owner/MetricCard';

const spinnerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 300,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 16,
  marginTop: 24,
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
  borderBottom: '1px solid var(--color-border-default)',
  fontSize: 12,
};

const tdStyle: CSSProperties = {
  padding: '10px 12px',
  color: 'var(--color-text-primary)',
  borderBottom: '1px solid var(--color-bg-raised)',
};

interface AICostsData {
  today_cost: number;
  daily_budget: number;
  month_total: number;
  ai_tips_today: number;
  ai_programs_today: number;
  trend: { date: string; cost: number; tips: number; programs: number }[];
}

export default function AdminAICostsPage() {
  const [data, setData] = useState<AICostsData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/ai-costs')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Failed to load AI cost data.'));
  }, []);

  if (error) {
    return (
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>AI Costs</h1>
        <p style={{ color: 'var(--color-red)', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={spinnerStyle}>
        <style>{`@keyframes cspin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-red)', borderRadius: '50%', animation: 'cspin 0.7s linear infinite' }} />
      </div>
    );
  }

  const budgetUsage = data.daily_budget > 0
    ? Math.round((data.today_cost / data.daily_budget) * 100)
    : 0;

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>AI Costs</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: 14 }}>
        AI usage monitoring and cost tracking
      </p>

      <div style={gridStyle}>
        <MetricCard
          title="Today's Cost"
          value={`$${data.today_cost.toFixed(2)}`}
          subtitle={data.daily_budget > 0 ? `${budgetUsage}% of daily budget` : 'No budget set'}
        />
        <MetricCard
          title="Daily Budget"
          value={`$${data.daily_budget.toFixed(2)}`}
          subtitle="2% of daily revenue"
        />
        <MetricCard title="Month Total" value={`$${data.month_total.toFixed(2)}`} />
        <MetricCard title="AI Tips Today" value={data.ai_tips_today} />
        <MetricCard title="AI Programs Today" value={data.ai_programs_today} />
      </div>

      {/* 30-day cost table */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text-primary)' }}>
          30-Day Cost History
        </h2>
        <div style={{ backgroundColor: 'var(--color-bg-raised)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Cost</th>
                <th style={thStyle}>Tips Generated</th>
                <th style={thStyle}>Programs Generated</th>
              </tr>
            </thead>
            <tbody>
              {data.trend.map((row) => (
                <tr key={row.date}>
                  <td style={tdStyle}>{row.date}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>${row.cost.toFixed(2)}</td>
                  <td style={tdStyle}>{row.tips}</td>
                  <td style={tdStyle}>{row.programs}</td>
                </tr>
              ))}
              {data.trend.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                    No cost data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
