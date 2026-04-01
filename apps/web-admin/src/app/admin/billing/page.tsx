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

const badgeStyle = (color: string, bg: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: bg,
  color,
});

interface BillingData {
  mrr: number;
  arr: number;
  arpu: number;
  trials_this_month: number;
  past_due_count: number;
  revenue_by_plan: { tier: string; name: string; count: number; mrr: number }[];
  by_status: Record<string, number>;
  mrr_trend: { date: string; mrr: number }[];
  last_month_mrr: number;
  at_risk: { gym_id: string; tier: string; reason: string; trial_ends_at?: string }[];
}

export default function AdminBillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/billing')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Failed to load billing data.'));
  }, []);

  if (error) {
    return (
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Billing & Revenue</h1>
        <p style={{ color: 'var(--color-red)', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={spinnerStyle}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-red)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  const mrrChange = data.last_month_mrr > 0
    ? Math.round(((data.mrr - data.last_month_mrr) / data.last_month_mrr) * 100)
    : 0;

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Billing & Revenue</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: 14 }}>
        Revenue metrics and subscription health
      </p>

      <div style={gridStyle}>
        <MetricCard title="MRR" value={`$${data.mrr.toLocaleString()}`} change={mrrChange} />
        <MetricCard title="ARR" value={`$${data.arr.toLocaleString()}`} />
        <MetricCard title="ARPU" value={`$${data.arpu}`} />
        <MetricCard title="Trials" value={data.trials_this_month} />
        <MetricCard title="Past Due" value={data.past_due_count} subtitle={data.past_due_count > 0 ? 'Action needed' : 'All clear'} />
      </div>

      {/* Revenue by Plan */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text-primary)' }}>
          Revenue by Plan
        </h2>
        <div style={{ backgroundColor: 'var(--color-bg-raised)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Plan</th>
                <th style={thStyle}>Active Subscriptions</th>
                <th style={thStyle}>MRR Contribution</th>
              </tr>
            </thead>
            <tbody>
              {data.revenue_by_plan.map((plan) => (
                <tr key={plan.tier}>
                  <td style={tdStyle}>
                    <span style={badgeStyle(
                      plan.tier === 'pro' ? '#A855F7' : plan.tier === 'growth' ? 'var(--color-blue)' : 'var(--color-text-secondary)',
                      plan.tier === 'pro' ? 'rgba(168,85,247,0.1)' : plan.tier === 'growth' ? 'var(--color-blue-subtle)' : 'var(--color-bg-elevated)'
                    )}>
                      {plan.name}
                    </span>
                  </td>
                  <td style={tdStyle}>{plan.count}</td>
                  <td style={tdStyle}>${plan.mrr.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* At Risk */}
      {data.at_risk.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--color-gold)' }}>
            At Risk ({data.at_risk.length})
          </h2>
          <div style={{ backgroundColor: 'var(--color-bg-raised)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Gym ID</th>
                  <th style={thStyle}>Tier</th>
                  <th style={thStyle}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.at_risk.map((risk, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{risk.gym_id.slice(0, 8)}...</td>
                    <td style={tdStyle}>
                      <span style={badgeStyle('var(--color-text-secondary)', 'var(--color-bg-elevated)')}>{risk.tier}</span>
                    </td>
                    <td style={{ ...tdStyle, color: risk.reason === 'past_due' ? 'var(--color-red)' : 'var(--color-gold)' }}>
                      {risk.reason === 'past_due' ? 'Payment past due' : 'Trial ending soon'}
                    </td>
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
