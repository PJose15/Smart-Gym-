'use client';

import { useEffect, useState } from 'react';
import { useMember } from '@/lib/contexts/MemberContext';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import type { DNAResult } from '@nexera/types';

export default function ProfilePage() {
  const { member, loading: memberLoading } = useMember();
  const [dna, setDna] = useState<DNAResult | null>(null);
  const [dnaLoading, setDnaLoading] = useState(false);

  useEffect(() => {
    if (!member) return;
    setDnaLoading(true);
    fetch(`/api/member/${member.id}/dna`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.dna) setDna(d.dna); })
      .catch(() => {})
      .finally(() => setDnaLoading(false));
  }, [member?.id]);

  if (memberLoading) {
    return (
      <div style={{ padding: 'var(--page-padding-x, 16px)', paddingTop: 'var(--space-6, 24px)' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Loading...</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div style={{ padding: 'var(--page-padding-x, 16px)', paddingTop: 'var(--space-6, 24px)' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Not signed in.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--page-padding-x, 16px)', paddingTop: 'var(--space-6, 24px)' }}>
      {/* Profile header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <MemberAvatar
          src={member.avatar_url}
          name={member.display_name}
          size="xlarge"
          dna={dnaLoading ? undefined : dna}
        />

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 'var(--text-xl, 20px)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            {member.display_name}
          </h1>
          {dna?.archetype && !dna.is_building && (
            <p style={{ color: dna.archetype.color, fontSize: 13, margin: '4px 0 0', fontWeight: 600 }}>
              {dna.archetype.name}
            </p>
          )}
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: '4px 0 0' }}>
            Score: {member.smartgym_score} · Streak: {member.current_streak}d
          </p>
        </div>
      </div>

      {/* Placeholder for future profile sections */}
      <div style={{ marginTop: 32 }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Your settings and activity will appear here.
        </p>
      </div>
    </div>
  );
}
