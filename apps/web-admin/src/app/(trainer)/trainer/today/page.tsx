'use client';

import { useEffect, useState, CSSProperties } from 'react';
import type { TrainerTodayData, AttentionItem, TrainingNowMember, TodaySessionSummary, RecentPR } from '@nexera/types';

const headerStyle: CSSProperties = { margin: '0 0 var(--space-6)', fontSize: 'var(--text-xl)', fontWeight: 500, fontFamily: 'var(--font-sans)', letterSpacing: 'var(--tracking-tight)' };

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--card-padding-lg)',
  marginBottom: 'var(--space-5)',
  border: '1px solid var(--color-border-subtle)',
};

const sectionTitle: CSSProperties = { margin: '0 0 var(--space-3)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)' };

const badgeColors: Record<string, string> = {
  at_risk: 'var(--color-red)',
  injury_report: 'var(--color-amber)',
  program_ending: 'var(--color-gold)',
  new_member: 'var(--color-green)',
};

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' };
const thStyle: CSSProperties = { textAlign: 'left', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-border-default)', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' };
const tdStyle: CSSProperties = { padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' };

export default function TrainerTodayPage() {
  const [data, setData] = useState<TrainerTodayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trainer/today')
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>;
  if (!data) return <p style={{ color: 'var(--color-red-light)' }}>Failed to load today data.</p>;

  return (
    <div>
      <h1 style={headerStyle}>Today</h1>

      {data.attention_items.length > 0 && (
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Needs Attention</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {data.attention_items.map((item: AttentionItem, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  backgroundColor: badgeColors[item.type] ?? 'var(--color-blue)',
                  color: '#fff',
                }}>
                  {item.type.replace('_', ' ')}
                </span>
                <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{item.member_name}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{item.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={sectionTitle}>Training Now ({data.members_training_now.length})</h2>
        {data.members_training_now.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>No members currently training.</p>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {data.members_training_now.map((m: TrainingNowMember) => (
              <div key={m.member_id} style={{ backgroundColor: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', minWidth: 140, border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{m.member_name}</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{m.exercises_count} exercises</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={sectionTitle}>Today&apos;s Sessions ({data.todays_sessions.length})</h2>
        {data.todays_sessions.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>No sessions today yet.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Member</th>
                <th style={thStyle}>Started</th>
                <th style={thStyle}>Exercises</th>
                <th style={thStyle}>Sets</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.todays_sessions.map((s: TodaySessionSummary) => (
                <tr key={s.session_id}>
                  <td style={tdStyle}>{s.member_name}</td>
                  <td style={tdStyle}>{new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={tdStyle}>{s.exercises_count}</td>
                  <td style={tdStyle}>{s.total_sets}</td>
                  <td style={tdStyle}>
                    <span style={{ color: s.finished_at ? 'var(--color-green-light)' : 'var(--color-gold-light)', fontSize: 'var(--text-xs)' }}>
                      {s.finished_at ? 'Done' : 'In Progress'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.recent_prs.length > 0 && (
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Recent PRs</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {data.recent_prs.map((pr: RecentPR, i: number) => (
              <div key={i} style={{ fontSize: 'var(--text-sm)' }}>
                <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{pr.member_name}</span>
                {' — '}
                <span style={{ color: 'var(--color-gold-light)' }}>{pr.exercise_name}</span>
                {' '}
                <span style={{ color: 'var(--color-text-muted)' }}>{pr.value} ({pr.pr_type})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
