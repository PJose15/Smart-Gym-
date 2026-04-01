'use client';

import { useMember } from '@/lib/contexts/MemberContext';
import { GymHeader } from './components/GymHeader';
import { LeaderboardPreview } from './components/LeaderboardPreview';
import { ChallengePreview } from './components/ChallengePreview';
import { FeedList } from './components/FeedList';

export default function GymPage() {
  const { member, gym, loading } = useMember();

  if (loading) {
    return (
      <div style={{ padding: 'var(--page-padding-x, 16px)', paddingTop: 'var(--space-6, 24px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: i === 1 ? 60 : 120,
                backgroundColor: 'var(--color-bg-raised)',
                borderRadius: 12,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!member || !gym) {
    return (
      <div style={{ padding: 16, textAlign: 'center', paddingTop: 60 }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Unable to load gym info.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--page-padding-x, 16px)', paddingTop: 'var(--space-6, 24px)', paddingBottom: 100 }}>
      <GymHeader
        gymName={gym.name}
        logoUrl={gym.logo_url}
      />

      <LeaderboardPreview
        memberId={member.id}
        gymId={gym.id}
      />

      <ChallengePreview
        memberId={member.id}
        gymId={gym.id}
      />

      <FeedList
        memberId={member.id}
        gymId={gym.id}
      />
    </div>
  );
}
