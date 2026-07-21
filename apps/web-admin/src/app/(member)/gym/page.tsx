'use client';

import { useRouter } from 'next/navigation';
import { useMember } from '@/lib/contexts/MemberContext';
import { Skeleton, FeedSkeleton } from '@/components/skeletons';
import { GymHeader } from './components/GymHeader';
import { LeaderboardPreview } from './components/LeaderboardPreview';
import { ChallengePreview } from './components/ChallengePreview';

export default function GymPage() {
  const router = useRouter();
  const { member, gym, loading } = useMember();

  if (loading) {
    return (
      <div style={{ padding: 'var(--page-padding-x, 16px)', paddingTop: 'var(--space-6, 24px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton height={60} radius={12} />
          <Skeleton height={120} radius={12} />
          <FeedSkeleton cards={3} />
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

      {/* Community feed moved to the dedicated /feed tab */}
      <button
        onClick={() => router.push('/feed')}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderRadius: 'var(--radius-lg, 16px)',
          backgroundColor: 'var(--color-bg-raised)',
          border: '1px solid var(--color-border-subtle)',
          cursor: 'pointer',
          animation: 'slideUpFade 0.4s ease-out 0.3s both',
        }}
      >
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          textAlign: 'left',
        }}>
          Community Feed
          <span style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--color-text-muted)',
            marginTop: 2,
          }}>
            PRs, achievements and challenges from your gym
          </span>
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent, #E0142F)', whiteSpace: 'nowrap' }}>
          View feed &rarr;
        </span>
      </button>
    </div>
  );
}
