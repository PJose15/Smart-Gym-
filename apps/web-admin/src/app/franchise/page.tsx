'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { AnimatedPage } from '../components/AnimatedPage';
import { StatCard } from '../components/StatCard';
import type { Franchise, FranchiseGymOverview, FranchiseTotals } from '@smartgym/types';

interface OwnedGym {
  gym_id: string;
  gyms: { id: string; name: string };
}

export default function FranchisePage() {
  const [franchise, setFranchise] = useState<Franchise | null>(null);
  const [totals, setTotals] = useState<FranchiseTotals | null>(null);
  const [gymOverviews, setGymOverviews] = useState<FranchiseGymOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create franchise form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [ownedGyms, setOwnedGyms] = useState<OwnedGym[]>([]);
  const [selectedGyms, setSelectedGyms] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // Check for existing franchise
      const { data: franchiseData } = await supabase
        .from('franchises')
        .select('*')
        .eq('owner_profile_id', user.id)
        .limit(1)
        .maybeSingle();

      if (franchiseData) {
        setFranchise(franchiseData as Franchise);

        // Fetch overview and totals
        const [overviewRes, totalsRes] = await Promise.all([
          supabase.rpc('get_franchise_overview', { p_franchise_id: franchiseData.id }),
          supabase.rpc('get_franchise_totals', { p_franchise_id: franchiseData.id }),
        ]);

        if (overviewRes.error) throw overviewRes.error;
        if (totalsRes.error) throw totalsRes.error;

        setGymOverviews((overviewRes.data ?? []) as FranchiseGymOverview[]);
        const totalsArr = totalsRes.data as FranchiseTotals[] | null;
        if (totalsArr && totalsArr.length > 0) {
          setTotals(totalsArr[0]);
        }
      } else {
        // No franchise — load owned gyms for creation form
        setShowCreate(true);
        const { data: gymsData } = await supabase
          .from('gym_members')
          .select('gym_id, gyms(id, name)')
          .eq('profile_id', user.id)
          .eq('role', 'owner');

        setOwnedGyms((gymsData ?? []) as unknown as OwnedGym[]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load franchise data');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create franchise
      const { data: newFranchise, error: createErr } = await supabase
        .from('franchises')
        .insert({ name: newName.trim(), owner_profile_id: user.id })
        .select()
        .single();

      if (createErr) throw createErr;

      // Add selected gyms
      if (selectedGyms.size > 0) {
        const rows = Array.from(selectedGyms).map((gymId) => ({
          franchise_id: newFranchise.id,
          gym_id: gymId,
        }));

        const { error: addErr } = await supabase
          .from('franchise_gyms')
          .insert(rows);

        if (addErr) throw addErr;
      }

      setShowCreate(false);
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create franchise');
    } finally {
      setCreating(false);
    }
  }

  function toggleGym(gymId: string) {
    setSelectedGyms((prev) => {
      const next = new Set(prev);
      if (next.has(gymId)) next.delete(gymId);
      else next.add(gymId);
      return next;
    });
  }

  if (loading) {
    return (
      <div style={centeredStyle}>
        <div style={spinnerStyle} className="spinner-enhanced" />
        <p style={{ color: '#999', marginTop: 16 }}>Loading franchise data...</p>
      </div>
    );
  }

  // Create franchise form
  if (showCreate) {
    return (
      <AnimatedPage>
        <div>
          <div style={headerStyle}>
            <h1 style={titleStyleH} className="title-animate">Franchise</h1>
            <p style={subtitleStyle} className="subtitle-animate">
              Create a franchise to aggregate analytics across multiple gyms.
            </p>
          </div>

          {error && (
            <div style={errorBannerStyle} className="error-shake">
              <span>{error}</span>
            </div>
          )}

          <div style={sectionStyle} className="section-glow">
            <h2 style={sectionTitleStyle}>Create Franchise</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Franchise Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Gym Chain"
                style={textInputStyle}
              />
            </div>

            {ownedGyms.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Select Gyms</label>
                {ownedGyms.map((og) => (
                  <label key={og.gym_id} style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      checked={selectedGyms.has(og.gym_id)}
                      onChange={() => toggleGym(og.gym_id)}
                    />
                    <span style={{ marginLeft: 8 }}>{og.gyms.name}</span>
                  </label>
                ))}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              style={{
                ...createBtnStyle,
                opacity: creating || !newName.trim() ? 0.5 : 1,
              }}
            >
              {creating ? 'Creating...' : 'Create Franchise'}
            </button>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  // Franchise dashboard
  return (
    <AnimatedPage>
      <div>
        <div style={headerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={titleStyleH} className="title-animate">
                {franchise?.name ?? 'Franchise'}
              </h1>
              <p style={subtitleStyle} className="subtitle-animate">
                Multi-gym franchise overview and comparison.
              </p>
            </div>
            <Link href="/franchise/manage" style={manageLinkStyle}>
              Manage Gyms
            </Link>
          </div>
        </div>

        {error && (
          <div style={errorBannerStyle} className="error-shake">
            <span>{error}</span>
          </div>
        )}

        {/* Stat Cards */}
        {totals && (
          <div style={gridStyle}>
            <StatCard title="Total Gyms" value={totals.total_gyms} index={0} />
            <StatCard title="Total Members" value={totals.total_members} index={1} />
            <StatCard title="Workouts (7d)" value={totals.total_workouts_7d} index={2} />
            <StatCard title="Active Members (7d)" value={totals.total_active_members_7d} index={3} />
          </div>
        )}

        {/* Comparison Table */}
        <div style={sectionStyle} className="section-glow">
          <h2 style={sectionTitleStyle}>Gym Comparison</h2>

          {gymOverviews.length === 0 ? (
            <p style={emptyStyle}>No gyms in this franchise yet. <Link href="/franchise/manage" style={{ color: '#4361ee' }}>Add gyms</Link></p>
          ) : (
            <div style={tableContainerStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Gym Name</th>
                    <th style={thStyle}>Members</th>
                    <th style={thStyle}>Machines</th>
                    <th style={thStyle}>Workouts (7d)</th>
                    <th style={thStyle}>Workouts (30d)</th>
                    <th style={thStyle}>Active (7d)</th>
                  </tr>
                </thead>
                <tbody>
                  {gymOverviews.map((g, i) => (
                    <tr key={g.gym_id} className={`row-stagger stagger-${i} table-row-hover`}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{g.gym_name}</span>
                      </td>
                      <td style={tdStyle}>{g.total_members}</td>
                      <td style={tdStyle}>{g.total_machines}</td>
                      <td style={tdStyle}>{g.workouts_7d}</td>
                      <td style={tdStyle}>{g.workouts_30d}</td>
                      <td style={tdStyle}>{g.active_members_7d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Comparison Bar Chart */}
        {gymOverviews.length > 0 && (
          <div style={{ ...sectionStyle, marginTop: 24 }} className="section-glow">
            <h2 style={sectionTitleStyle}>Workouts (7d) by Gym</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gymOverviews}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="gym_name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="workouts_7d" fill="#4361ee" radius={[4, 4, 0, 0]} name="Workouts (7d)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const headerStyle: CSSProperties = { marginBottom: 32 };

const titleStyleH: CSSProperties = {
  fontSize: 28, fontWeight: 700, marginTop: 0, marginBottom: 8, color: '#1a1a2e',
};

const subtitleStyle: CSSProperties = { color: '#666', marginTop: 0, marginBottom: 0 };

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 16,
  marginBottom: 24,
};

const sectionStyle: CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: 10, padding: 24,
  border: '1px solid rgba(0,0,0,0.06)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 20, fontWeight: 600, marginTop: 0, marginBottom: 16, color: '#1a1a2e',
};

const tableContainerStyle: CSSProperties = { overflowX: 'auto' };

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };

const thStyle: CSSProperties = {
  textAlign: 'left', padding: '12px 16px', borderBottom: '2px solid #eee',
  fontSize: 13, fontWeight: 600, color: '#666', textTransform: 'uppercase',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle',
};

const manageLinkStyle: CSSProperties = {
  padding: '8px 16px', borderRadius: 6, backgroundColor: '#f0f0f0',
  color: '#333', fontSize: 13, fontWeight: 600, textDecoration: 'none',
};

const labelStyle: CSSProperties = {
  display: 'block', fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 6,
};

const textInputStyle: CSSProperties = {
  width: '100%', maxWidth: 400, padding: '10px 14px', borderRadius: 8,
  border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box',
};

const checkboxRowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '8px 0',
  fontSize: 14, color: '#333', cursor: 'pointer',
};

const createBtnStyle: CSSProperties = {
  padding: '10px 24px', borderRadius: 8, border: 'none',
  backgroundColor: '#4361ee', color: '#fff', fontSize: 14,
  fontWeight: 600, cursor: 'pointer',
};

const centeredStyle: CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: 10, padding: 40,
  textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
};

const spinnerStyle: CSSProperties = {
  width: 32, height: 32, border: '3px solid #e0e0e0',
  borderTopColor: '#4fc3f7', borderRadius: '50%',
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: '#fef2f2', border: '1px solid #fecaca',
  borderRadius: 8, padding: '12px 16px', marginBottom: 16,
  color: '#dc2626', fontSize: 14,
};

const emptyStyle: CSSProperties = {
  color: '#999', fontSize: 14, textAlign: 'center', padding: 20,
};
