'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '../components/PageHeader';
import { AnimatedPage } from '../components/AnimatedPage';

// ─── Types ──────────────────────────────────────────────

interface LeaderboardRow {
  rank: number;
  profile_id: string;
  full_name: string;
  total_points: number;
}

type Period = 'weekly' | 'all_time';

// ─── Styles ─────────────────────────────────────────────

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-md)' as any,
  padding: 24,
  border: '1px solid var(--color-border-subtle)',
};

const toggleContainerStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 0,
  backgroundColor: 'var(--color-bg-elevated)',
  borderRadius: 'var(--radius-md)' as any,
  padding: 3,
  marginBottom: 20,
};

const toggleBtnStyle: CSSProperties = {
  padding: '8px 20px',
  borderRadius: 'var(--radius-sm)' as any,
  border: 'none',
  cursor: 'pointer',
  fontSize: 'var(--text-base)' as any,
  fontWeight: 'var(--weight-medium)' as any,
  background: 'transparent',
  color: 'var(--color-text-muted)',
  transition: 'all 0.2s',
};

const toggleActiveStyle: CSSProperties = {
  ...toggleBtnStyle,
  backgroundColor: 'var(--color-blue)',
  color: 'var(--color-text-primary)',
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

const rankMedals: Record<number, string> = {
  1: '\uD83E\uDD47',
  2: '\uD83E\uDD48',
  3: '\uD83E\uDD49',
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

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [period, setPeriod] = useState<Period>('weekly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard(period);
  }, [period]);

  async function fetchLeaderboard(selectedPeriod: Period) {
    setLoading(true);
    setError(null);
    try {
      // Get gym ID (first gym for this admin)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: memberData } = await supabase
        .from('members')
        .select('gym_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!memberData?.gym_id) throw new Error('No gym found');

      let since: string | null = null;
      if (selectedPeriod === 'weekly') {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diff);
        monday.setHours(0, 0, 0, 0);
        since = monday.toISOString();
      }

      const { data: rankings, error: rpcErr } = await supabase.rpc('get_leaderboard', {
        p_gym_id: memberData.gym_id,
        p_since: since,
        p_limit: 100,
      });

      if (rpcErr) throw rpcErr;
      if (!rankings || rankings.length === 0) {
        setRows([]);
        return;
      }

      const profileIds = rankings.map((r: { profile_id: string }) => r.profile_id);
      const { data: members, error: membersErr } = await supabase
        .from('members')
        .select('user_id, display_name, avatar_url')
        .eq('gym_id', memberData.gym_id)
        .in('user_id', profileIds);
      if (membersErr) throw membersErr;

      const profileMap = new Map<string, { full_name: string }>();
      for (const m of members ?? []) {
        if (m.user_id) {
          profileMap.set(m.user_id, { full_name: m.display_name || 'Unknown' });
        }
      }

      const result: LeaderboardRow[] = rankings.map(
        (r: { profile_id: string; total_points: number }, index: number) => ({
          rank: index + 1,
          profile_id: r.profile_id,
          full_name: profileMap.get(r.profile_id)?.full_name || 'Unknown',
          total_points: Number(r.total_points),
        }),
      );

      setRows(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <div style={{ padding: 24 }}>
        <PageHeader
          title="Leaderboard"
          description="Gym member rankings by points earned"
        />

        <div style={toggleContainerStyle}>
          <button
            style={period === 'weekly' ? toggleActiveStyle : toggleBtnStyle}
            onClick={() => setPeriod('weekly')}
          >
            This Week
          </button>
          <button
            style={period === 'all_time' ? toggleActiveStyle : toggleBtnStyle}
            onClick={() => setPeriod('all_time')}
          >
            All Time
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--color-red-subtle)',
            color: 'var(--color-red-light)',
            padding: '14px 18px',
            borderRadius: 'var(--radius-sm)' as any,
            fontSize: 'var(--text-base)' as any,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Stats strip */}
        {!loading && rows.length > 0 && (() => {
          const totalPts = rows.reduce((s, r) => s + r.total_points, 0);
          const avgPts = rows.length > 0 ? Math.round(totalPts / rows.length) : 0;
          const topScore = rows.length > 0 ? rows[0].total_points : 0;
          return (
            <div style={statsStripStyle}>
              <span style={statsChipStyle}>{rows.length} participant{rows.length !== 1 ? 's' : ''}</span>
              <span style={statsChipStyle}>{totalPts.toLocaleString()} total pts</span>
              <span style={statsChipStyle}>{avgPts.toLocaleString()} avg pts</span>
              <span style={statsChipStyle}>Top: {topScore.toLocaleString()} pts</span>
            </div>
          );
        })()}

        <div style={cardStyle} className="section-glow">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div className="spinner-enhanced" />
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 60 }}>Rank</th>
                  <th style={thStyle}>Name</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.profile_id} className={`row-stagger stagger-${Math.min(i, 19)}`}>
                    <td style={{ ...tdStyle, fontWeight: 'var(--weight-bold)' as any, fontSize: 16 }}>
                      {rankMedals[row.rank] || `#${row.rank}`}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 'var(--weight-medium)' as any }}>{row.full_name}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'var(--weight-bold)' as any, color: 'var(--color-purple-light)' }}>
                      {row.total_points.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td style={tdStyle} colSpan={3}>
                      <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                        No points recorded for this period yet.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
