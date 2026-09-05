'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { PageHeader } from '../components/PageHeader';
import { AnimatedPage } from '../components/AnimatedPage';

// ─── Types ───────────────────────────────────────────────

interface ContextCount {
  context: string;
  count: number;
}

interface DailyCount {
  date: string;
  count: number;
}

interface ConversionRow {
  shown: number;
  applied: number;
  rate: string;
}

// ─── Styles ─────────────────────────────────────────────

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
  gap: 20,
  marginBottom: 24,
};

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-md)' as any,
  padding: 24,
  border: '1px solid var(--color-border-subtle)',
};

const cardTitleStyle: CSSProperties = {
  fontSize: 'var(--text-base)' as any,
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  marginBottom: 16,
};

const tableContainerStyle: CSSProperties = {
  overflow: 'hidden',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  backgroundColor: 'var(--color-bg-elevated)',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-text-secondary)',
  fontSize: 12,
  textTransform: 'uppercase',
};

const tdStyle: CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontSize: 'var(--text-base)' as any,
  color: 'var(--color-text-primary)',
};

const statValueStyle: CSSProperties = {
  fontSize: 'var(--text-3xl)' as any,
  fontWeight: 'var(--weight-bold)' as any,
  color: 'var(--color-text-primary)',
  marginBottom: 4,
};

const statLabelStyle: CSSProperties = {
  fontSize: 'var(--text-sm)' as any,
  color: 'var(--color-text-muted)',
};

const errorStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-subtle)',
  color: 'var(--color-red-light)',
  padding: '14px 18px',
  borderRadius: 'var(--radius-sm)' as any,
  fontSize: 'var(--text-base)' as any,
  marginBottom: 16,
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

export default function AnalyticsPage() {
  const { authed } = useStaffAuth();
  const [contextCounts, setContextCounts] = useState<ContextCount[]>([]);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [conversion, setConversion] = useState<ConversionRow | null>(null);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authed) fetchAnalytics();
  }, [authed]);

  async function fetchAnalytics() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const since = sevenDaysAgo.toISOString();

      // Fetch AI audit logs grouped by context. Explicit ordering makes the
      // 500-row cap deterministic (most recent first) instead of arbitrary.
      const { data: auditLogs, error: auditErr } = await supabase
        .from('ai_audit_logs')
        .select('context, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);

      if (auditErr) throw auditErr;

      // Group by context
      const contextMap = new Map<string, number>();
      const dailyMap = new Map<string, number>();

      for (const log of auditLogs ?? []) {
        contextMap.set(log.context, (contextMap.get(log.context) ?? 0) + 1);
        const day = log.created_at?.slice(0, 10) ?? 'unknown';
        dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
      }

      const sortedContexts = Array.from(contextMap.entries())
        .map(([context, count]) => ({ context, count }))
        .sort((a, b) => b.count - a.count);

      const sortedDaily = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setContextCounts(sortedContexts);
      setDailyCounts(sortedDaily);
      setTotalEvents(auditLogs?.length ?? 0);

      // Fetch conversion: next_set shown vs applied. Ordered so the 500-row
      // cap samples the most recent events deterministically.
      const { data: events, error: eventsErr } = await supabase
        .from('app_events')
        .select('event_name')
        .in('event_name', ['ai_next_set_shown', 'ai_next_set_applied'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);

      if (eventsErr) throw eventsErr;

      const shown = (events ?? []).filter((e) => e.event_name === 'ai_next_set_shown').length;
      const applied = (events ?? []).filter((e) => e.event_name === 'ai_next_set_applied').length;
      const rate = shown > 0 ? ((applied / shown) * 100).toFixed(1) : '0.0';

      setConversion({ shown, applied, rate });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  function contextLabel(ctx: string): string {
    const labels: Record<string, string> = {
      next_set: 'Next Set Suggestion',
      summary: 'Workout Summary',
      machine_mistakes: 'Machine Mistakes',
      today_explanation: 'Today Explanation',
      alternatives: 'Alternatives',
      guardrails: 'Guardrails',
      coach_draft: 'Coach Draft',
      safety_nudge: 'Safety Nudge',
      checklist: 'Form Checklist',
      coaching: 'AI Coaching',
    };
    return labels[ctx] ?? ctx;
  }

  if (loading) {
    return (
      <AnimatedPage>
        <div style={{ padding: 24 }}>
          <PageHeader title="Analytics" description="AI feature usage over the last 7 days" />
          <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner-enhanced" /></div>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div style={{ padding: 24 }}>
        <PageHeader
          title="Analytics"
          description="AI feature usage and adoption metrics (last 7 days)"
        />

        {error && <div style={errorStyle}>{error}</div>}

        {/* Stats strip */}
        {!loading && (() => {
          const avgDaily = dailyCounts.length > 0
            ? Math.round(dailyCounts.reduce((s, d) => s + d.count, 0) / dailyCounts.length)
            : 0;
          const topFeature = contextCounts.length > 0 ? contextLabel(contextCounts[0].context) : '--';
          return (
            <div style={statsStripStyle}>
              <span style={statsChipStyle}>{totalEvents} AI call{totalEvents !== 1 ? 's' : ''} (7d)</span>
              <span style={statsChipStyle}>{contextCounts.length} feature{contextCounts.length !== 1 ? 's' : ''} used</span>
              <span style={statsChipStyle}>{avgDaily} avg calls/day</span>
              <span style={statsChipStyle}>Top: {topFeature}</span>
              {conversion && <span style={{ ...statsChipStyle, backgroundColor: parseFloat(conversion.rate) >= 50 ? 'var(--color-green-subtle)' : 'var(--color-gold-subtle)', color: parseFloat(conversion.rate) >= 50 ? 'var(--color-green-light)' : 'var(--color-gold-light)' }}>{conversion.rate}% adoption</span>}
            </div>
          );
        })()}

        {/* Summary stats */}
        <div style={gridStyle}>
          <div style={cardStyle} className="section-glow">
            <div style={statValueStyle}>{totalEvents}</div>
            <div style={statLabelStyle}>Total AI calls (7d)</div>
          </div>

          <div style={cardStyle} className="section-glow">
            <div style={statValueStyle}>{contextCounts.length}</div>
            <div style={statLabelStyle}>Features used</div>
          </div>

          {conversion && (
            <div style={cardStyle} className="section-glow">
              <div style={statValueStyle}>{conversion.rate}%</div>
              <div style={statLabelStyle}>
                Next-set adoption ({conversion.applied}/{conversion.shown})
              </div>
            </div>
          )}
        </div>

        <div style={gridStyle}>
          {/* Top features */}
          <div style={cardStyle} className="section-glow">
            <div style={cardTitleStyle}>Top Features</div>
            <div style={tableContainerStyle}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Feature</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Calls</th>
                  </tr>
                </thead>
                <tbody>
                  {contextCounts.map((row, i) => (
                    <tr key={row.context} className={`row-stagger stagger-${Math.min(i, 19)}`}>
                      <td style={tdStyle}>{contextLabel(row.context)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'var(--weight-bold)' as any }}>{row.count}</td>
                    </tr>
                  ))}
                  {contextCounts.length === 0 && (
                    <tr>
                      <td style={tdStyle} colSpan={2}>
                        <span style={{ color: 'var(--color-text-muted)' }}>No AI calls recorded in the last 7 days.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily usage */}
          <div style={cardStyle} className="section-glow">
            <div style={cardTitleStyle}>Daily Usage</div>
            <div style={tableContainerStyle}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>AI Calls</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyCounts.map((row, i) => (
                    <tr key={row.date} className={`row-stagger stagger-${Math.min(i, 19)}`}>
                      <td style={tdStyle}>
                        {new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'var(--weight-bold)' as any }}>{row.count}</td>
                    </tr>
                  ))}
                  {dailyCounts.length === 0 && (
                    <tr>
                      <td style={tdStyle} colSpan={2}>
                        <span style={{ color: 'var(--color-text-muted)' }}>No data for this period.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
