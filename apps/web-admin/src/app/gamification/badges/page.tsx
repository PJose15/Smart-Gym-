'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '../../components/PageHeader';
import { AnimatedPage } from '../../components/AnimatedPage';

// ─── Types ──────────────────────────────────────────────

interface BadgeRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_emoji: string;
  criteria_type: string;
  criteria_value: number;
  rarity: string;
  sort_order: number;
  member_count: number;
}

interface MemberUnlock {
  profile_id: string;
  full_name: string;
  unlocked_at: string;
}

// ─── Styles ─────────────────────────────────────────────

const cardStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 10,
  padding: 24,
  border: '1px solid rgba(0,0,0,0.06)',
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

const RARITY_COLORS: Record<string, string> = {
  common: '#6c757d',
  rare: '#4361ee',
  epic: '#7b2ff7',
  legendary: '#ff6b35',
};

const rarityBadgeStyle = (rarity: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 700,
  color: RARITY_COLORS[rarity] ?? '#666',
  backgroundColor: (RARITY_COLORS[rarity] ?? '#666') + '18',
  textTransform: 'capitalize',
});

const expandedRowStyle: CSSProperties = {
  backgroundColor: '#fafafa',
  padding: '12px 16px',
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
  borderRadius: 14,
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: '#f0f0f0',
  color: '#555',
};

// ─── Component ──────────────────────────────────────────

export default function BadgesPage() {
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberUnlock[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    fetchBadges();
  }, []);

  async function fetchBadges() {
    setLoading(true);
    setError(null);
    try {
      const { data: badgeData, error: badgeErr } = await supabase
        .from('badges')
        .select('*')
        .order('sort_order');

      if (badgeErr) throw badgeErr;

      // Get member counts per badge
      const { data: countData, error: countErr } = await supabase
        .from('member_badges')
        .select('badge_id');

      if (countErr) throw countErr;

      const countMap = new Map<string, number>();
      for (const mb of countData ?? []) {
        countMap.set(mb.badge_id, (countMap.get(mb.badge_id) ?? 0) + 1);
      }

      const rows: BadgeRow[] = (badgeData ?? []).map((b) => ({
        ...b,
        member_count: countMap.get(b.id) ?? 0,
      }));

      setBadges(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load badges');
    } finally {
      setLoading(false);
    }
  }

  async function handleExpand(badgeId: string) {
    if (expandedId === badgeId) {
      setExpandedId(null);
      setMembers([]);
      return;
    }

    setExpandedId(badgeId);
    setMembersLoading(true);

    try {
      const { data, error: err } = await supabase
        .from('member_badges')
        .select('profile_id, unlocked_at, profiles(full_name)')
        .eq('badge_id', badgeId)
        .order('unlocked_at', { ascending: false });

      if (err) throw err;

      setMembers(
        (data ?? []).map((mb) => ({
          profile_id: mb.profile_id,
          full_name: (mb.profiles as unknown as { full_name: string })?.full_name || 'Unknown',
          unlocked_at: mb.unlocked_at,
        })),
      );
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <div style={{ padding: 24 }}>
        <PageHeader
          title="Badges"
          description="Achievement badges earned by gym members"
        />

        {error && (
          <div style={{
            backgroundColor: '#fdecea',
            color: '#b71c1c',
            padding: '14px 18px',
            borderRadius: 8,
            fontSize: 14,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Stats strip */}
        {!loading && badges.length > 0 && (() => {
          const totalUnlocks = badges.reduce((s, b) => s + b.member_count, 0);
          const rarities = badges.reduce<Record<string, number>>((acc, b) => {
            acc[b.rarity] = (acc[b.rarity] ?? 0) + 1;
            return acc;
          }, {});
          return (
            <div style={statsStripStyle}>
              <span style={statsChipStyle}>{badges.length} badge{badges.length !== 1 ? 's' : ''}</span>
              <span style={statsChipStyle}>{totalUnlocks} total unlock{totalUnlocks !== 1 ? 's' : ''}</span>
              {Object.entries(rarities).map(([rarity, count]) => (
                <span key={rarity} style={{ ...statsChipStyle, backgroundColor: (RARITY_COLORS[rarity] ?? '#666') + '18', color: RARITY_COLORS[rarity] ?? '#666' }}>
                  {count} {rarity}
                </span>
              ))}
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
                  <th style={{ ...thStyle, width: 50 }}>Icon</th>
                  <th style={thStyle}>Name</th>
                  <th style={{ ...thStyle, width: 100 }}>Rarity</th>
                  <th style={thStyle}>Criteria</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 120 }}>Members Earned</th>
                </tr>
              </thead>
              <tbody>
                {badges.map((badge, i) => (
                  <>
                    <tr
                      key={badge.id}
                      className={`row-stagger stagger-${Math.min(i, 19)}`}
                      onClick={() => handleExpand(badge.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ ...tdStyle, fontSize: 24, textAlign: 'center' }}>
                        {badge.icon_emoji}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        {badge.name}
                        <div style={{ fontSize: 12, color: '#888', fontWeight: 400, marginTop: 2 }}>
                          {badge.description}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={rarityBadgeStyle(badge.rarity)}>
                          {badge.rarity}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: '#666' }}>
                        {badge.criteria_type.replace(/_/g, ' ')} ({badge.criteria_value.toLocaleString()})
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#3a0ca3' }}>
                        {badge.member_count}
                      </td>
                    </tr>
                    {expandedId === badge.id && (
                      <tr key={`${badge.id}-expanded`}>
                        <td colSpan={5} style={expandedRowStyle}>
                          {membersLoading ? (
                            <div style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                              Loading...
                            </div>
                          ) : members.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 16, color: '#999' }}>
                              No members have earned this badge yet.
                            </div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={{ ...thStyle, backgroundColor: '#f0f0f0' }}>Member</th>
                                  <th style={{ ...thStyle, backgroundColor: '#f0f0f0', textAlign: 'right' }}>Unlocked</th>
                                </tr>
                              </thead>
                              <tbody>
                                {members.map((m) => (
                                  <tr key={m.profile_id}>
                                    <td style={{ ...tdStyle, fontWeight: 500 }}>{m.full_name}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', color: '#888' }}>
                                      {new Date(m.unlocked_at).toLocaleDateString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {badges.length === 0 && (
                  <tr>
                    <td style={tdStyle} colSpan={5}>
                      <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
                        No badges configured yet.
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
