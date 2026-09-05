'use client';

import { Fragment, useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '../../components/PageHeader';
import { AnimatedPage } from '../../components/AnimatedPage';

// ─── Types ──────────────────────────────────────────────

interface BadgeRow {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  points: number;
  required_value: number | null;
  required_unit: string | null;
  sort_order: number;
  is_active: boolean;
  member_count: number;
}

interface MemberUnlock {
  member_id: string;
  display_name: string;
  earned_at: string;
}

// ─── Styles ─────────────────────────────────────────────

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: 24,
  border: '1px solid var(--color-border-subtle)',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  backgroundColor: 'var(--color-bg-elevated)',
  borderBottom: '1px solid var(--color-border-default)',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  fontSize: 12,
  textTransform: 'uppercase',
};

const tdStyle: CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontSize: 14,
  color: 'var(--color-text-primary)',
};

const CATEGORY_EMOJI: Record<string, string> = {
  milestone: '🏆',
  performance: '💪',
  consistency: '🔥',
  explorer: '🧭',
  community: '🤝',
};

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  milestone: { bg: 'var(--color-gold-subtle)', fg: 'var(--color-gold)' },
  performance: { bg: 'var(--color-red-subtle)', fg: 'var(--color-red-light)' },
  consistency: { bg: 'var(--color-green-subtle)', fg: 'var(--color-green-light)' },
  explorer: { bg: 'var(--color-blue-subtle)', fg: 'var(--color-blue-light)' },
  community: { bg: 'var(--accent-subtle)', fg: 'var(--color-purple)' },
};

const FALLBACK_CATEGORY_COLOR = { bg: 'var(--color-bg-elevated)', fg: 'var(--color-text-muted)' };

const categoryBadgeStyle = (category: string): CSSProperties => {
  const c = CATEGORY_COLORS[category] ?? FALLBACK_CATEGORY_COLOR;
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 700,
    color: c.fg,
    backgroundColor: c.bg,
    textTransform: 'capitalize',
  };
};

const expandedRowStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
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
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-muted)',
};

// ─── Helpers ────────────────────────────────────────────

function criteriaLabel(badge: BadgeRow): string {
  if (badge.required_value == null) return '—';
  const unit = badge.required_unit ? ` ${badge.required_unit.replace(/_/g, ' ')}` : '';
  return `${badge.required_value.toLocaleString()}${unit}`;
}

// ─── Component ──────────────────────────────────────────

export default function BadgesPage() {
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberUnlock[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  useEffect(() => {
    fetchBadges();
  }, []);

  async function fetchBadges() {
    setLoading(true);
    setError(null);
    try {
      const { data: defData, error: defErr } = await supabase
        .from('achievement_definitions')
        .select('id, code, title, description, category, points, required_value, required_unit, sort_order, is_active')
        .order('sort_order');

      if (defErr) throw defErr;

      // Unlock counts grouped by achievement_code
      const { data: countData, error: countErr } = await supabase
        .from('member_achievements')
        .select('achievement_code');

      if (countErr) throw countErr;

      const countMap = new Map<string, number>();
      for (const ma of countData ?? []) {
        countMap.set(ma.achievement_code, (countMap.get(ma.achievement_code) ?? 0) + 1);
      }

      const rows: BadgeRow[] = (defData ?? []).map((b) => ({
        ...b,
        member_count: countMap.get(b.code) ?? 0,
      }));

      setBadges(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load badges');
    } finally {
      setLoading(false);
    }
  }

  async function handleExpand(code: string) {
    if (expandedCode === code) {
      setExpandedCode(null);
      setMembers([]);
      setMembersError(null);
      return;
    }

    setExpandedCode(code);
    setMembersLoading(true);
    setMembersError(null);

    try {
      const { data, error: err } = await supabase
        .from('member_achievements')
        .select('member_id, earned_at, members(display_name)')
        .eq('achievement_code', code)
        .order('earned_at', { ascending: false });

      if (err) throw err;

      setMembers(
        (data ?? []).map((ma) => ({
          member_id: ma.member_id,
          display_name: (ma.members as unknown as { display_name: string })?.display_name || 'Unknown',
          earned_at: ma.earned_at,
        })),
      );
    } catch (err) {
      setMembers([]);
      setMembersError(err instanceof Error ? err.message : 'Failed to load members');
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
            backgroundColor: 'var(--color-red-light)',
            color: 'var(--color-red)',
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
          const categories = badges.reduce<Record<string, number>>((acc, b) => {
            acc[b.category] = (acc[b.category] ?? 0) + 1;
            return acc;
          }, {});
          return (
            <div style={statsStripStyle}>
              <span style={statsChipStyle}>{badges.length} badge{badges.length !== 1 ? 's' : ''}</span>
              <span style={statsChipStyle}>{totalUnlocks} total unlock{totalUnlocks !== 1 ? 's' : ''}</span>
              {Object.entries(categories).map(([category, count]) => {
                const c = CATEGORY_COLORS[category] ?? FALLBACK_CATEGORY_COLOR;
                return (
                  <span key={category} style={{ ...statsChipStyle, backgroundColor: c.bg, color: c.fg }}>
                    {count} {category}
                  </span>
                );
              })}
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
                  <th style={{ ...thStyle, width: 110 }}>Category</th>
                  <th style={thStyle}>Criteria</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>Points</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 120 }}>Members Earned</th>
                </tr>
              </thead>
              <tbody>
                {badges.map((badge, i) => (
                  <Fragment key={badge.id}>
                    <tr
                      className={`row-stagger stagger-${Math.min(i, 19)}`}
                      onClick={() => handleExpand(badge.code)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ ...tdStyle, fontSize: 24, textAlign: 'center' }} aria-hidden="true">
                        {CATEGORY_EMOJI[badge.category] ?? '🎖️'}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        {badge.title}
                        {!badge.is_active && (
                          <span style={{
                            marginLeft: 8,
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--color-text-muted)',
                            backgroundColor: 'var(--color-bg-highest)',
                            padding: '1px 6px',
                            borderRadius: 8,
                            textTransform: 'uppercase',
                          }}>
                            Inactive
                          </span>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 400, marginTop: 2 }}>
                          {badge.description}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={categoryBadgeStyle(badge.category)}>
                          {badge.category}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>
                        {criteriaLabel(badge)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                        {badge.points.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--color-blue)' }}>
                        {badge.member_count}
                      </td>
                    </tr>
                    {expandedCode === badge.code && (
                      <tr>
                        <td colSpan={6} style={expandedRowStyle}>
                          {membersLoading ? (
                            <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>
                              Loading...
                            </div>
                          ) : membersError ? (
                            <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-red)' }}>
                              {membersError}
                            </div>
                          ) : members.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>
                              No members have earned this badge yet.
                            </div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={{ ...thStyle, backgroundColor: 'var(--color-bg-highest)' }}>Member</th>
                                  <th style={{ ...thStyle, backgroundColor: 'var(--color-bg-highest)', textAlign: 'right' }}>Earned</th>
                                </tr>
                              </thead>
                              <tbody>
                                {members.map((m) => (
                                  <tr key={m.member_id}>
                                    <td style={{ ...tdStyle, fontWeight: 500 }}>{m.display_name}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-muted)' }}>
                                      {new Date(m.earned_at).toLocaleDateString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {badges.length === 0 && (
                  <tr>
                    <td style={tdStyle} colSpan={6}>
                      <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
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
