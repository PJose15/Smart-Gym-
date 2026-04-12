'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useStaffWeightUnit } from '@/lib/contexts/StaffContext';
import { formatVolume } from '@/lib/weight';

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
  const weightUnit = useStaffWeightUnit();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  useEffect(() => {
    loadSessions(0);
  // eslint-disable-next-line
  }, [memberId]);

  async function loadSessions(p: number) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/trainer/members/${memberId}/sessions?offset=${p * limit}&limit=${limit}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error('Unexpected response');
      if (p === 0) {
        setSessions(data);
      } else {
        setSessions((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === limit);
      setPage(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Session History</h2>

      {error && (
        <div style={{
          backgroundColor: 'var(--color-red-light)',
          color: 'var(--color-red)',
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 13,
          marginBottom: 12,
        }}>
          {error}
          <button
            onClick={() => loadSessions(page)}
            style={{ marginLeft: 12, background: 'none', border: 'none', color: 'var(--color-red)', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}
          >
            Retry
          </button>
        </div>
      )}

      {sessions.length === 0 && !loading && !error ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No sessions recorded yet.</p>
      ) : sessions.length === 0 ? null : (
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
                    <td style={tdStyle}>{formatVolume(s.total_volume_lbs, weightUnit)}</td>
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
