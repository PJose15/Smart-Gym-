'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { AnimatedPage } from '../../components/AnimatedPage';
import { PageHeader } from '../../components/PageHeader';
import type { Franchise, FranchiseGym } from '@smartgym/types';

interface OwnedGym {
  gym_id: string;
  name: string;
}

export default function FranchiseManagePage() {
  const [franchise, setFranchise] = useState<Franchise | null>(null);
  const [ownedGyms, setOwnedGyms] = useState<OwnedGym[]>([]);
  const [franchiseGymIds, setFranchiseGymIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get franchise
      const { data: franchiseData } = await supabase
        .from('franchises')
        .select('*')
        .eq('owner_profile_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!franchiseData) {
        setError('No franchise found. Create one from the Franchise page.');
        setLoading(false);
        return;
      }

      setFranchise(franchiseData as Franchise);
      setEditName(franchiseData.name);

      // Get franchise gyms
      const { data: fgData } = await supabase
        .from('franchise_gyms')
        .select('gym_id')
        .eq('franchise_id', franchiseData.id);

      const fgIds = new Set((fgData ?? []).map((fg: { gym_id: string }) => fg.gym_id));
      setFranchiseGymIds(fgIds);

      // Get all gyms user owns
      const { data: memberData } = await supabase
        .from('gym_members')
        .select('gym_id, gyms(id, name)')
        .eq('profile_id', user.id)
        .eq('role', 'owner');

      const gyms: OwnedGym[] = (memberData ?? []).map((m: unknown) => {
        const row = m as { gym_id: string; gyms: { id: string; name: string } };
        return { gym_id: row.gym_id, name: row.gyms.name };
      });

      setOwnedGyms(gyms);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleGym(gymId: string) {
    if (!franchise) return;
    setSaving(gymId);
    setError(null);

    try {
      if (franchiseGymIds.has(gymId)) {
        // Remove from franchise
        const { error: delErr } = await supabase
          .from('franchise_gyms')
          .delete()
          .eq('franchise_id', franchise.id)
          .eq('gym_id', gymId);

        if (delErr) throw delErr;

        setFranchiseGymIds((prev) => {
          const next = new Set(prev);
          next.delete(gymId);
          return next;
        });
      } else {
        // Add to franchise
        const { error: addErr } = await supabase
          .from('franchise_gyms')
          .insert({ franchise_id: franchise.id, gym_id: gymId });

        if (addErr) throw addErr;

        setFranchiseGymIds((prev) => new Set(prev).add(gymId));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update gym');
    } finally {
      setSaving(null);
    }
  }

  async function handleUpdateName() {
    if (!franchise || !editName.trim()) return;
    setSavingName(true);
    setError(null);

    try {
      const { error: updateErr } = await supabase
        .from('franchises')
        .update({ name: editName.trim(), updated_at: new Date().toISOString() })
        .eq('id', franchise.id);

      if (updateErr) throw updateErr;
      setFranchise((prev) => prev ? { ...prev, name: editName.trim() } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  }

  if (loading) {
    return (
      <div style={centeredStyle}>
        <div style={spinnerStyle} className="spinner-enhanced" />
        <p style={{ color: '#999', marginTop: 16 }}>Loading...</p>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div>
        <Link href="/franchise" style={backLinkStyle}>
          &larr; Back to Franchise
        </Link>

        <PageHeader
          title="Manage Franchise"
          description="Edit franchise name and manage gym membership."
        />

        {error && (
          <div style={errorBannerStyle} className="error-shake">
            <span>{error}</span>
          </div>
        )}

        {/* Stats strip */}
        {ownedGyms.length > 0 && (
          <div style={statsStripStyle}>
            <span style={statsChipStyle}>{ownedGyms.length} owned gym{ownedGyms.length !== 1 ? 's' : ''}</span>
            <span style={{ ...statsChipStyle, backgroundColor: '#e8f5e9', color: '#2e7d32' }}>{franchiseGymIds.size} in franchise</span>
            <span style={statsChipStyle}>{ownedGyms.length - franchiseGymIds.size} not added</span>
          </div>
        )}

        {/* Edit Name */}
        <div style={sectionStyle} className="section-glow">
          <h3 style={sectionTitleStyle}>Franchise Name</h3>
          <div style={nameRowStyle}>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={textInputStyle}
            />
            <button
              onClick={handleUpdateName}
              disabled={savingName || editName.trim() === franchise?.name}
              style={{
                ...saveBtnStyle,
                opacity: savingName || editName.trim() === franchise?.name ? 0.5 : 1,
              }}
            >
              {savingName ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Gym List */}
        <div style={{ ...sectionStyle, marginTop: 16 }} className="section-glow">
          <h3 style={sectionTitleStyle}>Your Gyms</h3>
          <p style={descStyle}>
            Toggle gyms to add or remove them from your franchise.
          </p>

          {ownedGyms.length === 0 ? (
            <p style={emptyStyle}>You don&apos;t own any gyms yet.</p>
          ) : (
            <div>
              {ownedGyms.map((gym) => {
                const inFranchise = franchiseGymIds.has(gym.gym_id);
                const isSaving = saving === gym.gym_id;

                return (
                  <div key={gym.gym_id} style={gymRowStyle} className="table-row-hover">
                    <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{gym.name}</span>
                    <button
                      onClick={() => handleToggleGym(gym.gym_id)}
                      disabled={isSaving}
                      style={{
                        ...toggleBtnStyle,
                        backgroundColor: inFranchise ? '#2a9d8f' : '#dee2e6',
                        opacity: isSaving ? 0.6 : 1,
                      }}
                    >
                      <span style={{
                        ...toggleKnobStyle,
                        transform: inFranchise ? 'translateX(20px)' : 'translateX(0)',
                      }} />
                    </button>
                    <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
                      {inFranchise ? 'In franchise' : 'Not added'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const backLinkStyle: CSSProperties = {
  display: 'inline-block', marginBottom: 16, fontSize: 14,
  color: '#4361ee', textDecoration: 'none', fontWeight: 600,
};

const sectionStyle: CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: 10, padding: 24,
  border: '1px solid rgba(0,0,0,0.06)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 16, fontWeight: 600, color: '#333', marginTop: 0, marginBottom: 12,
};

const descStyle: CSSProperties = {
  fontSize: 14, color: '#666', marginTop: 0, marginBottom: 16,
};

const nameRowStyle: CSSProperties = {
  display: 'flex', gap: 12, alignItems: 'center',
};

const textInputStyle: CSSProperties = {
  padding: '8px 14px', borderRadius: 6, border: '1px solid #ddd',
  fontSize: 14, flex: 1, maxWidth: 400,
};

const saveBtnStyle: CSSProperties = {
  padding: '8px 16px', borderRadius: 6, border: 'none',
  backgroundColor: '#4361ee', color: '#fff', fontSize: 13,
  fontWeight: 600, cursor: 'pointer',
};

const gymRowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 0', borderBottom: '1px solid #f0f0f0',
};

const toggleBtnStyle: CSSProperties = {
  width: 44, height: 24, borderRadius: 12, border: 'none',
  cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s',
  padding: 0, marginLeft: 'auto',
};

const toggleKnobStyle: CSSProperties = {
  display: 'block', width: 20, height: 20, borderRadius: 10,
  backgroundColor: '#ffffff', position: 'absolute', top: 2, left: 2,
  transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
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
