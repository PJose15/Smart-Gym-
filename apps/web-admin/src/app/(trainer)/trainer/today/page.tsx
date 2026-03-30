'use client';

import { useEffect, useState, CSSProperties } from 'react';
import type { TrainerTodayData, AttentionItem, TrainingNowMember, TodaySessionSummary, RecentPR } from '@nexera/types';

const headerStyle: CSSProperties = { margin: '0 0 24px', fontSize: 22, fontWeight: 700 };

const cardStyle: CSSProperties = {
  backgroundColor: '#1E293B',
  borderRadius: 10,
  padding: 20,
  marginBottom: 20,
};

const sectionTitle: CSSProperties = { margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#94A3B8' };

const badgeColors: Record<string, string> = {
  at_risk: '#EF4444',
  injury_report: '#F97316',
  program_ending: '#EAB308',
  new_member: '#22C55E',
};

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle: CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #334155', color: '#64748B', fontWeight: 500 };
const tdStyle: CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #1E293B' };

export default function TrainerTodayPage() {
  const [data, setData] = useState<TrainerTodayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trainer/today')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: '#94A3B8' }}>Loading...</p>;
  if (!data) return <p style={{ color: '#EF4444' }}>Failed to load today data.</p>;

  return (
    <div>
      <h1 style={headerStyle}>Today</h1>

      {/* Attention Items */}
      {data.attention_items.length > 0 && (
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Needs Attention</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.attention_items.map((item: AttentionItem, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: badgeColors[item.type] ?? '#3B82F6',
                  color: '#fff',
                }}>
                  {item.type.replace('_', ' ')}
                </span>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{item.member_name}</span>
                <span style={{ color: '#94A3B8', fontSize: 12 }}>{item.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members Training Now */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Training Now ({data.members_training_now.length})</h2>
        {data.members_training_now.length === 0 ? (
          <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>No members currently training.</p>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {data.members_training_now.map((m: TrainingNowMember) => (
              <div key={m.member_id} style={{ backgroundColor: '#0F172A', borderRadius: 8, padding: '10px 14px', minWidth: 140 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.member_name}</div>
                <div style={{ color: '#94A3B8', fontSize: 12 }}>{m.exercises_count} exercises</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Sessions */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Today&apos;s Sessions ({data.todays_sessions.length})</h2>
        {data.todays_sessions.length === 0 ? (
          <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>No sessions today yet.</p>
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
                    <span style={{ color: s.finished_at ? '#22C55E' : '#EAB308', fontSize: 12 }}>
                      {s.finished_at ? 'Done' : 'In Progress'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent PRs */}
      {data.recent_prs.length > 0 && (
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Recent PRs</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.recent_prs.map((pr: RecentPR, i: number) => (
              <div key={i} style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{pr.member_name}</span>
                {' — '}
                <span style={{ color: '#EAB308' }}>{pr.exercise_name}</span>
                {' '}
                <span style={{ color: '#94A3B8' }}>{pr.value} ({pr.pr_type})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
