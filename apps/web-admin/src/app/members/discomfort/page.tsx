'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '../../components/PageHeader';
import { AnimatedPage } from '../../components/AnimatedPage';

// ─── Types ───────────────────────────────────────────────

interface DiscomfortRow {
  gym_id: string;
  profile_id: string;
  full_name: string;
  discomfort_count_7d: number;
  unstable_count_7d: number;
  top_body_areas_7d: string[];
  last_discomfort_at: string | null;
}

// ─── Styles ─────────────────────────────────────────────

const tableContainerStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 10,
  overflow: 'hidden',
  border: '1px solid rgba(0,0,0,0.06)',
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
  fontSize: 14,
  color: '#333',
};

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  marginRight: 4,
  marginBottom: 2,
};

const countBadgeStyle = (count: number): CSSProperties => ({
  ...badgeStyle,
  backgroundColor: count >= 4 ? '#fce4e6' : count >= 2 ? '#fff8e1' : '#e8f5e9',
  color: count >= 4 ? '#c62828' : count >= 2 ? '#e65100' : '#2e7d32',
});

const bodyAreaBadgeStyle: CSSProperties = {
  ...badgeStyle,
  backgroundColor: '#e3f2fd',
  color: '#1565c0',
};

const emptyStateStyle: CSSProperties = {
  textAlign: 'center',
  padding: '48px 24px',
  color: '#999',
  fontSize: 15,
};

// ─── Component ──────────────────────────────────────────

export default function DiscomfortPage() {
  const [rows, setRows] = useState<DiscomfortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Query the feedback_discomfort_summary view
        const { data, error: fetchError } = await supabase
          .from('feedback_discomfort_summary')
          .select('*')
          .gte('discomfort_count_7d', 2)
          .order('discomfort_count_7d', { ascending: false });

        if (fetchError) throw fetchError;
        setRows((data ?? []) as DiscomfortRow[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load safety data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <AnimatedPage>
        <div style={{ padding: 24 }}>
          <PageHeader
            title="Safety Alerts"
            description="Members reporting repeated discomfort or instability"
          />
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div className="spinner-enhanced" />
          </div>
        </div>
      </AnimatedPage>
    );
  }

  if (error) {
    return (
      <AnimatedPage>
        <div style={{ padding: 24 }}>
          <PageHeader
            title="Safety Alerts"
            description="Members reporting repeated discomfort or instability"
          />
          <div className="error-shake" style={{
            backgroundColor: '#fce4e6',
            borderRadius: 10,
            padding: 16,
            color: '#c62828',
            fontSize: 14,
          }}>
            {error}
          </div>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div style={{ padding: 24 }}>
        <PageHeader
          title="Safety Alerts"
          description="Members with 2+ discomfort reports in the last 7 days"
        />

        {rows.length === 0 ? (
          <div style={tableContainerStyle}>
            <div className="empty-breathe" style={emptyStateStyle}>
              No members with repeated discomfort reports. All clear.
            </div>
          </div>
        ) : (
          <div style={tableContainerStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Member</th>
                  <th style={thStyle}>Discomfort (7d)</th>
                  <th style={thStyle}>Unstable (7d)</th>
                  <th style={thStyle}>Body Areas</th>
                  <th style={thStyle}>Last Report</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.profile_id}
                    className={`row-stagger stagger-${Math.min(i, 19)} table-row-hover`}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{row.full_name}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={countBadgeStyle(row.discomfort_count_7d)}>
                        {row.discomfort_count_7d}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={countBadgeStyle(row.unstable_count_7d)}>
                        {row.unstable_count_7d}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {(row.top_body_areas_7d ?? []).length > 0 ? (
                        row.top_body_areas_7d.map((area) => (
                          <span key={area} style={bodyAreaBadgeStyle}>
                            {area}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#999', fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {row.last_discomfort_at
                        ? new Date(row.last_discomfort_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
