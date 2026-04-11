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
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-md)' as any,
  overflow: 'hidden',
  border: '1px solid var(--color-border-subtle)',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  backgroundColor: 'var(--color-bg-elevated)',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-text-secondary)',
  fontSize: 'var(--text-sm)' as any,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontSize: 'var(--text-base)' as any,
  color: 'var(--color-text-primary)',
};

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 'var(--weight-medium)' as any,
  marginRight: 4,
  marginBottom: 2,
};

const countBadgeStyle = (count: number): CSSProperties => ({
  ...badgeStyle,
  backgroundColor: count >= 4 ? 'var(--color-red-subtle)' : count >= 2 ? 'var(--color-gold-subtle)' : 'var(--color-green-subtle)',
  color: count >= 4 ? 'var(--color-red-light)' : count >= 2 ? 'var(--color-gold-light)' : 'var(--color-green-light)',
});

const bodyAreaBadgeStyle: CSSProperties = {
  ...badgeStyle,
  backgroundColor: 'var(--color-blue-subtle)',
  color: 'var(--color-blue-light)',
};

const emptyStateStyle: CSSProperties = {
  textAlign: 'center',
  padding: '48px 24px',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-base)' as any,
};

const statsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const statsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 'var(--radius-lg)' as any,
  fontSize: 12,
  fontWeight: 'var(--weight-medium)' as any,
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)',
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
          .select(
            'gym_id, profile_id, full_name, discomfort_count_7d, unstable_count_7d, top_body_areas_7d, last_discomfort_at'
          )
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
            backgroundColor: 'var(--color-red-subtle)',
            borderRadius: 'var(--radius-md)' as any,
            padding: 16,
            color: 'var(--color-red-light)',
            fontSize: 'var(--text-base)' as any,
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

        {/* Stats strip */}
        {rows.length > 0 && (() => {
          const totalDiscomfort = rows.reduce((s, r) => s + r.discomfort_count_7d, 0);
          const totalUnstable = rows.reduce((s, r) => s + r.unstable_count_7d, 0);
          const allAreas = new Set(rows.flatMap((r) => r.top_body_areas_7d ?? []));
          const highRisk = rows.filter((r) => r.discomfort_count_7d >= 4).length;
          return (
            <div style={statsStripStyle}>
              <span style={statsChipStyle}>{rows.length} member{rows.length !== 1 ? 's' : ''} flagged</span>
              <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-red-subtle)', color: 'var(--color-red-light)' }}>{totalDiscomfort} discomfort reports</span>
              <span style={statsChipStyle}>{totalUnstable} instability reports</span>
              <span style={statsChipStyle}>{allAreas.size} body area{allAreas.size !== 1 ? 's' : ''} affected</span>
              {highRisk > 0 && <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-red-subtle)', color: 'var(--color-red-light)' }}>{highRisk} high-risk (4+)</span>}
            </div>
          );
        })()}

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
                      <span style={{ fontWeight: 'var(--weight-medium)' as any }}>{row.full_name}</span>
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
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' as any }}>--</span>
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
                        : '--'}
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
