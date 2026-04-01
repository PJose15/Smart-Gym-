'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { AnimatedPage } from '../../components/AnimatedPage';
import { PageHeader } from '../../components/PageHeader';
import type { Franchise, FranchiseGym } from '@nexera/types';

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
        <p style={{ color: 'var(--color-text-muted)', marginTop: 16 }}>Loading...</p>
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
            <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green-light)' }}>{franchiseGymIds.size} in franchise</span>
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
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{gym.name}</span>
                    <button
                      onClick={() => handleToggleGym(gym.gym_id)}
                      disabled={isSaving}
                      style={{
                        ...toggleBtnStyle,
                        backgroundColor: inFranchise ? 'var(--color-green)' : 'var(--color-bg-highest)',
                        opacity: isSaving ? 0.6 : 1,
                      }}
                    >
                      <span style={{
                        ...toggleKnobStyle,
                        transform: inFranchise ? 'translateX(20px)' : 'translateX(0)',
                      }} />
                    </button>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginLeft: 8 }}>
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

/* -- Styles --------------------------------------------------------- */

const backLinkStyle: CSSProperties = {
  display: 'inline-block', marginBottom: 16, fontSize: 'var(--text-sm)',
  color: 'var(--color-blue)', textDecoration: 'none', fontWeight: 600,
};

const sectionStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)', borderRadius: 'var(--radius-md)', padding: 24,
  border: '1px solid var(--color-border-subtle)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 0, marginBottom: 12,
};

const descStyle: CSSProperties = {
  fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 16,
};

const nameRowStyle: CSSProperties = {
  display: 'flex', gap: 12, alignItems: 'center',
};

const textInputStyle: CSSProperties = {
  padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-default)',
  fontSize: 'var(--text-sm)', flex: 1, maxWidth: 400,
  backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)',
};

const saveBtnStyle: CSSProperties = {
  padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
  backgroundColor: 'var(--color-blue)', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)',
  fontWeight: 600, cursor: 'pointer',
};

const gymRowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 0', borderBottom: '1px solid var(--color-border-subtle)',
};

const toggleBtnStyle: CSSProperties = {
  width: 44, height: 24, borderRadius: 'var(--radius-full)', border: 'none',
  cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s',
  padding: 0, marginLeft: 'auto',
};

const toggleKnobStyle: CSSProperties = {
  display: 'block', width: 20, height: 20, borderRadius: 'var(--radius-full)',
  backgroundColor: 'var(--color-text-primary)', position: 'absolute', top: 2, left: 2,
  transition: 'transform 0.2s', boxShadow: 'var(--shadow-sm)',
};

const centeredStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)', borderRadius: 'var(--radius-md)', padding: 40,
  textAlign: 'center', border: '1px solid var(--color-border-subtle)',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
};

const spinnerStyle: CSSProperties = {
  width: 32, height: 32, border: '3px solid var(--color-border-default)',
  borderTopColor: 'var(--color-blue)', borderRadius: '50%',
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-subtle)', border: '1px solid var(--color-red)',
  borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16,
  color: 'var(--color-red-light)', fontSize: 'var(--text-sm)',
};

const emptyStyle: CSSProperties = {
  color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 20,
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
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)',
};
