'use client';

import { useState, useEffect } from 'react';
import { useScanFlowStore } from '@/lib/stores/scanFlowStore';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const GOAL_LABELS: Record<string, string> = {
  'muscle-gain': 'Build Muscle',
  'strength': 'Get Stronger',
  'weight-loss': 'Lose Weight',
  'general-fitness': 'General Fitness',
};

export function WelcomeMoment() {
  const {
    member,
    machine,
    selectedGoal,
    selectedExperience,
    goTo,
    setMember,
  } = useScanFlowStore();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [animateIn, setAnimateIn] = useState(false);

  // Trigger entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
  }, []);

  // Save onboarding data on mount
  useEffect(() => {
    if (!member || !selectedGoal || !selectedExperience || saved) return;

    setSaving(true);
    (async () => {
      try {
        const res = await fetch('/api/members/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_id: member.id,
            gym_id: member.gym_id,
            primary_goal: selectedGoal,
            experience_level: selectedExperience,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to save profile');
          setSaving(false);
          return;
        }

        // Update member in store with new data
        setMember({
          ...member,
          primary_goal: selectedGoal,
          experience_level: selectedExperience,
          onboarding_status: 'active',
        });

        setSaved(true);
        setSaving(false);
      } catch {
        setError('Network error. Your progress is saved locally.');
        setSaving(false);
      }
    })();
  }, [member, selectedGoal, selectedExperience, saved, setMember]);

  const displayName = member?.display_name || 'Member';
  const initials = getInitials(displayName);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--page-padding-x)',
        textAlign: 'center',
      }}
    >
      {/* Initials avatar */}
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-6)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-bold)',
          color: 'white',
          boxShadow: 'var(--shadow-blue)',
          transform: animateIn ? 'scale(1)' : 'scale(0.5)',
          opacity: animateIn ? 1 : 0,
          transition: `transform 0.5s var(--ease-spring), opacity 0.3s var(--ease-out)`,
        }}
      >
        {initials}
      </div>

      {/* Welcome text */}
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-2)',
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? 'translateY(0)' : 'translateY(16px)',
          transition: `all 0.4s var(--ease-out) 0.2s`,
        }}
      >
        Welcome, {member?.first_name || displayName}!
      </h2>

      {/* Goal confirmation */}
      {selectedGoal && (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
            marginBottom: 'var(--space-4)',
            opacity: animateIn ? 1 : 0,
            transition: `opacity 0.4s var(--ease-out) 0.35s`,
          }}
        >
          Goal: <span style={{ color: 'var(--color-blue)' }}>{GOAL_LABELS[selectedGoal] || selectedGoal}</span>
        </p>
      )}

      {/* Machine context */}
      {machine && (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
            opacity: animateIn ? 1 : 0,
            transition: `opacity 0.4s var(--ease-out) 0.45s`,
          }}
        >
          Ready to log on <span style={{ color: 'var(--color-text-secondary)' }}>{machine.name}</span>
        </p>
      )}

      {/* Saving indicator */}
      {saving && (
        <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Setting up your profile...
        </p>
      )}

      {/* Error */}
      {error && (
        <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-red)' }}>
          {error}
        </p>
      )}

      {/* Spacer */}
      <div style={{ flex: 1, minHeight: 'var(--space-10)' }} />

      {/* CTA */}
      <button
        onClick={() => goTo('logging')}
        disabled={saving}
        style={{
          width: '100%',
          height: 'var(--tap-target-lg)',
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          backgroundColor: 'var(--gym-primary)',
          color: 'var(--gym-text-on-primary)',
          fontSize: 'var(--text-md)',
          fontWeight: 'var(--weight-bold)',
          fontFamily: 'var(--font-sans)',
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.7 : animateIn ? 1 : 0,
          transition: `opacity 0.4s var(--ease-out) 0.55s, transform var(--duration-fast) var(--ease-default)`,
          boxShadow: 'var(--shadow-blue)',
        }}
      >
        {saving ? 'Setting up...' : "Let's Go!"}
      </button>
    </div>
  );
}
