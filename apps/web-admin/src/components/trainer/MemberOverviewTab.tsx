'use client';

import { useEffect, useState, CSSProperties } from 'react';

interface MemberDetail {
  member_name: string;
  avatar_url: string | null;
  email: string;
  joined_at: string;
  last_session_date: string | null;
  current_streak: number;
  smartgym_score: number;
  total_sessions: number;
  total_volume_lbs: number;
  goal: string | null;
  experience: string | null;
  body_metrics: { weight_lbs: number | null; body_fat_pct: number | null } | null;
  top_machines: Array<{ machine_name: string; sessions: number }>;
}

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: 20,
  marginBottom: 16,
};

const statGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 12,
};

const statCard: CSSProperties = {
  backgroundColor: 'var(--color-bg-base)',
  borderRadius: 8,
  padding: '12px 14px',
};

export function MemberOverviewTab({ memberId }: { memberId: string }) {
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/trainer/members/${memberId}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load member details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  if (loading) return <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>;
  if (error || !data) return (
    <div>
      <p style={{ color: 'var(--color-red)', marginBottom: 12 }}>
        {error ? `Failed to load member details: ${error}` : 'Failed to load member details.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ padding: '8px 16px', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
      >
        Retry
      </button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', backgroundColor: 'var(--color-bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, flexShrink: 0,
        }}>
          {data.avatar_url ? (
            <img src={data.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            data.member_name.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{data.member_name}</h2>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{data.email}</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
            Joined {new Date(data.joined_at).toLocaleDateString()}
            {data.goal && ` · Goal: ${data.goal}`}
            {data.experience && ` · ${data.experience}`}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={statGrid}>
        <div style={statCard}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 4 }}>Total Sessions</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{data.total_sessions}</div>
        </div>
        <div style={statCard}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 4 }}>Current Streak</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{data.current_streak}d</div>
        </div>
        <div style={statCard}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 4 }}>Score</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{data.smartgym_score}</div>
        </div>
        <div style={statCard}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 4 }}>Total Volume</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{data.total_volume_lbs.toLocaleString()} lbs</div>
        </div>
        {data.body_metrics?.weight_lbs && (
          <div style={statCard}>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 4 }}>Body Weight</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{data.body_metrics.weight_lbs} lbs</div>
          </div>
        )}
        <div style={statCard}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 4 }}>Last Session</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {data.last_session_date ? new Date(data.last_session_date).toLocaleDateString() : 'Never'}
          </div>
        </div>
      </div>

      {/* Top Machines */}
      {data.top_machines.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Top Machines</h3>
          {data.top_machines.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < data.top_machines.length - 1 ? '1px solid var(--color-border-subtle)' : 'none', fontSize: 13 }}>
              <span>{m.machine_name}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{m.sessions} sessions</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
