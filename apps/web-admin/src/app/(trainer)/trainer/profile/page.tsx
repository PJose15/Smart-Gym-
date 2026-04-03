'use client';

import { useEffect, useState, CSSProperties } from 'react';

interface TrainerProfile {
  name: string;
  email: string;
  role: string;
  gym_name: string;
  gym_id: string;
  assigned_members_count: number;
  created_at: string;
}

const headerStyle: CSSProperties = {
  margin: '0 0 var(--space-6)',
  fontSize: 'var(--text-xl)',
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  letterSpacing: 'var(--tracking-tight)',
};

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--card-padding-lg)',
  marginBottom: 'var(--space-5)',
  border: '1px solid var(--color-border-subtle)',
  maxWidth: 560,
};

const labelStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--tracking-wider)',
  marginBottom: 'var(--space-1)',
  fontFamily: 'var(--font-sans)',
};

const valueStyle: CSSProperties = {
  fontSize: 'var(--text-base)',
  color: 'var(--color-text-primary)',
  marginBottom: 'var(--space-4)',
  fontFamily: 'var(--font-sans)',
};

const statCardStyle: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  backgroundColor: 'var(--color-bg-elevated)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4) var(--space-6)',
  border: '1px solid var(--color-border-subtle)',
};

export default function TrainerProfilePage() {
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/staff/me')
      .then((r) => {
        if (!r.ok) throw new Error('Unauthorized');
        return r.json();
      })
      .then((data) => {
        setProfile({
          name: data.name || data.email?.split('@')[0] || 'Trainer',
          email: data.email || '',
          role: data.role || 'trainer',
          gym_name: data.gym_name || 'Unknown Gym',
          gym_id: data.gym_id || '',
          assigned_members_count: data.assigned_members_count ?? 0,
          created_at: data.created_at || '',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>;
  if (!profile) return <p style={{ color: 'var(--color-red-light)' }}>Failed to load profile.</p>;

  const joinDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div>
      <h1 style={headerStyle}>Profile</h1>

      <div style={cardStyle}>
        <div style={labelStyle}>Name</div>
        <div style={valueStyle}>{profile.name}</div>

        <div style={labelStyle}>Email</div>
        <div style={valueStyle}>{profile.email}</div>

        <div style={labelStyle}>Role</div>
        <div style={valueStyle} data-testid="trainer-role">
          {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
        </div>

        <div style={labelStyle}>Gym</div>
        <div style={valueStyle}>{profile.gym_name}</div>

        {joinDate && (
          <>
            <div style={labelStyle}>Member Since</div>
            <div style={valueStyle}>{joinDate}</div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
        <div style={statCardStyle}>
          <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--color-blue)' }}>
            {profile.assigned_members_count}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            Assigned Members
          </span>
        </div>
      </div>
    </div>
  );
}
