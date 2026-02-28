'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
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
  backgroundColor: '#ffffff',
  borderRadius: 10,
  padding: 24,
  border: '1px solid rgba(0,0,0,0.06)',
};

const cardTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#555',
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
  backgroundColor: '#fafafa',
  borderBottom: '1px solid #eee',
  fontWeight: 600,
  color: '#555',
  fontSize: 12,
  textTransform: 'uppercase',
};

const tdStyle: CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #f0f0f0',
  fontSize: 14,
  color: '#333',
};

const statValueStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: '#1a1a2e',
  marginBottom: 4,
};

const statLabelStyle: CSSProperties = {
  fontSize: 13,
  color: '#999',
};

const errorStyle: CSSProperties = {
  backgroundColor: '#fdecea',
  color: '#b71c1c',
  padding: '14px 18px',
  borderRadius: 8,
  fontSize: 14,
  marginBottom: 16,
};

// ─── Component ──────────────────────────────────────────

export default function AnalyticsPage() {
  const [contextCounts, setContextCounts] = useState<ContextCount[]>([]);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [conversion, setConversion] = useState<ConversionRow | null>(null);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const since = sevenDaysAgo.toISOString();

      // Fetch AI audit logs grouped by context
      const { data: auditLogs, error: auditErr } = await supabase
        .from('ai_audit_logs')
        .select('context, created_at')
        .gte('created_at', since);

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

      // Fetch conversion: next_set shown vs applied
      const { data: events, error: eventsErr } = await supabase
        .from('app_events')
        .select('event_name')
        .in('event_name', ['ai_next_set_shown', 'ai_next_set_applied'])
        .gte('created_at', since);

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
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{row.count}</td>
                    </tr>
                  ))}
                  {contextCounts.length === 0 && (
                    <tr>
                      <td style={tdStyle} colSpan={2}>
                        <span style={{ color: '#999' }}>No AI calls recorded in the last 7 days.</span>
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
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{row.count}</td>
                    </tr>
                  ))}
                  {dailyCounts.length === 0 && (
                    <tr>
                      <td style={tdStyle} colSpan={2}>
                        <span style={{ color: '#999' }}>No data for this period.</span>
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
