'use client';

import { useEffect, useState, CSSProperties } from 'react';

interface SessionRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  exercises_count: number;
  total_sets: number;
  total_volume_lbs: number;
  duration_minutes: number;
}

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle: CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--color-border-default)', color: 'var(--color-text-muted)', fontWeight: 500 };
const tdStyle: CSSProperties = { padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)' };

export function MemberSessionsTab({ memberId }: { memberId: string }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  useEffect(() => {
    loadSessions(0);
  // eslint-disable-next-line
  }, [memberId]);

  function loadSessions(p: number) {
    setLoading(true);
    fetch(`/api/trainer/members/${memberId}/sessions?offset=${p * limit}&limit=${limit}`)
      .then((r) => r.json())
      .then((data) => {
        if (p === 0) {
          setSessions(data);
        } else {
          setSessions((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === limit);
        setPage(p);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Session History</h2>

      {sessions.length === 0 && !loading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No sessions recorded yet.</p>
      ) : (
        <>
          <div style={{ backgroundColor: 'var(--color-bg-raised)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Exercises</th>
                  <th style={thStyle}>Sets</th>
                  <th style={thStyle}>Volume</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td style={tdStyle}>{new Date(s.started_at).toLocaleDateString()}</td>
                    <td style={tdStyle}>{s.duration_minutes > 0 ? `${s.duration_minutes}m` : '—'}</td>
                    <td style={tdStyle}>{s.exercises_count}</td>
                    <td style={tdStyle}>{s.total_sets}</td>
                    <td style={tdStyle}>{s.total_volume_lbs.toLocaleString()} lbs</td>
                    <td style={tdStyle}>
                      <span style={{ color: s.finished_at ? 'var(--color-green)' : 'var(--color-gold)', fontSize: 12 }}>
                        {s.finished_at ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <button
              onClick={() => loadSessions(page + 1)}
              disabled={loading}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                backgroundColor: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
