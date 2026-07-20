'use client';

import { useEffect, useState, CSSProperties } from 'react';

interface ProgramSummary {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_weeks: number;
  sessions_per_week: number;
  week_number: number;
  sessions_completed: number;
  sessions_total: number;
  on_track: boolean;
  generated_by: string;
  trainer_approved: boolean;
}

interface AvailableProgram {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  duration_weeks: number;
  sessions_per_week: number;
}

interface ProgramData {
  program: ProgramSummary | null;
  available_programs: AvailableProgram[];
}

export function MemberProgramTab({ memberId }: { memberId: string }) {
  const [data, setData] = useState<ProgramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/trainer/members/${memberId}/program`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((d: ProgramData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load program data.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [memberId]);

  const handleApprove = async () => {
    if (!data?.program) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/trainer/members/${memberId}/program/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: data.program.id }),
      });
      if (!res.ok) throw new Error();
      fetchData();
    } catch {
      setError('Failed to approve program.');
    } finally {
      setApproving(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedProgramId) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/trainer/members/${memberId}/program/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: selectedProgramId }),
      });
      if (!res.ok) throw new Error();
      setShowAssign(false);
      setSelectedProgramId('');
      fetchData();
    } catch {
      setError('Failed to assign program.');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return <p style={{ color: 'var(--color-text-secondary)' }}>Loading program...</p>;
  }

  if (error) {
    return (
      <div style={cardStyle}>
        <p style={{ color: 'var(--color-red)', fontSize: 13, margin: 0 }}>{error}</p>
        <button onClick={fetchData} style={btnSecondary}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  // No active program — show assign UI
  if (!data.program || showAssign) {
    return (
      <div style={cardStyle}>
        <p style={{ ...labelStyle, marginBottom: 12 }}>
          {showAssign ? 'Assign Different Program' : 'No active program'}
        </p>

        {data.available_programs.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
            No programs available. Create a program in the Programs section first.
          </p>
        ) : (
          <>
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Select a program...</option>
              {data.available_programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.duration_weeks}wk, {p.sessions_per_week}x/week
                  {p.goal ? ` (${p.goal})` : ''}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={handleAssign}
                disabled={!selectedProgramId || assigning}
                style={{
                  ...btnPrimary,
                  opacity: !selectedProgramId || assigning ? 0.5 : 1,
                }}
              >
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
              {showAssign && (
                <button onClick={() => setShowAssign(false)} style={btnSecondary}>
                  Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Active program display
  const prog = data.program;
  const progressPct = prog.sessions_total > 0
    ? Math.round((prog.sessions_completed / prog.sessions_total) * 100)
    : 0;

  return (
    <div>
      <div style={cardStyle}>
        {/* Title + badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{prog.title}</h3>
            {prog.goal && (
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12, textTransform: 'capitalize' }}>
                {prog.goal}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <span style={prog.generated_by === 'ai' ? badgeAi : badgeTrainer}>
              {prog.generated_by === 'ai' ? 'AI' : 'Trainer'}
            </span>
            {prog.trainer_approved && (
              <span style={badgeApproved}>Approved</span>
            )}
          </div>
        </div>

        {/* Week + status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Week {prog.week_number} of {prog.duration_weeks}
          </span>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 12,
            backgroundColor: prog.on_track
              ? 'var(--color-green-surface, rgba(34,197,94,0.12))'
              : 'var(--color-amber-surface, rgba(245,158,11,0.12))',
            color: prog.on_track
              ? 'var(--color-green, #22c55e)'
              : 'var(--color-amber, #f59e0b)',
          }}>
            {prog.on_track ? 'On Track' : 'Behind'}
          </span>
        </div>

        {/* Progress bar */}
        <div style={progressTrackStyle}>
          <div style={{ ...progressFillStyle, width: `${progressPct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
          <span>{prog.sessions_completed} / {prog.sessions_total} sessions</span>
          <span>{progressPct}%</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {!prog.trainer_approved && prog.generated_by === 'ai' && (
            <button
              onClick={handleApprove}
              disabled={approving}
              style={{ ...btnPrimary, opacity: approving ? 0.5 : 1 }}
            >
              {approving ? 'Approving...' : 'Approve Program'}
            </button>
          )}
          <button onClick={() => setShowAssign(true)} style={btnSecondary}>
            Assign Different
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: 20,
  marginBottom: 16,
};

const labelStyle: CSSProperties = {
  color: 'var(--color-text-secondary)',
  fontSize: 14,
  margin: 0,
  fontWeight: 600,
};

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--color-border-subtle, rgba(255,255,255,0.04))',
  backgroundColor: 'var(--color-bg-base)',
  color: 'var(--color-text-primary)',
  fontSize: 13,
};

const btnPrimary: CSSProperties = {
  backgroundColor: 'var(--color-blue, #3b82f6)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSecondary: CSSProperties = {
  backgroundColor: 'transparent',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border-subtle, rgba(255,255,255,0.04))',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const badgeAi: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 12,
  backgroundColor: 'var(--color-blue-surface, rgba(59,130,246,0.12))',
  color: 'var(--color-blue, #3b82f6)',
};

const badgeTrainer: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 12,
  backgroundColor: 'var(--color-purple-surface, rgba(139,92,246,0.12))',
  color: 'var(--color-purple, #8b5cf6)',
};

const badgeApproved: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 12,
  backgroundColor: 'var(--color-green-surface, rgba(34,197,94,0.12))',
  color: 'var(--color-green, #22c55e)',
};

const progressTrackStyle: CSSProperties = {
  height: 6,
  borderRadius: 3,
  backgroundColor: 'var(--color-border, rgba(255,255,255,0.08))',
  overflow: 'hidden',
};

const progressFillStyle: CSSProperties = {
  height: '100%',
  borderRadius: 3,
  backgroundColor: 'var(--color-blue, #3b82f6)',
  transition: 'width 0.3s ease',
};
