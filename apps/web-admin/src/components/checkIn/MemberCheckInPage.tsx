'use client';

import { useEffect, useState } from 'react';
import type { CheckInRecord } from '@nexera/types';
import { CheckInMessage } from './CheckInMessage';
import { CheckInReplySection } from './CheckInReplySection';
import { PastCheckInRow } from './PastCheckInRow';
import { NexeraCoachAvatar } from './NexeraCoachAvatar';
import { CheckInSkeleton } from './CheckInSkeleton';
import { useUnreadCheckIn } from '@/hooks/useUnreadCheckIn';

interface MemberCheckInPageProps {
  memberId: string;
  gymName?: string;
}

export function MemberCheckInPage({ memberId, gymName }: MemberCheckInPageProps) {
  const [latest, setLatest] = useState<CheckInRecord | null>(null);
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasUnread, checkInId: unreadId, markRead } = useUnreadCheckIn(memberId);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/member/${memberId}/check-ins`);
        if (res.ok) {
          const data = await res.json();
          setLatest(data.latest ?? null);
          setHistory(data.history ?? []);
        } else {
          console.error('Failed to load check-ins:', res.status);
          setError('Failed to load check-ins.');
        }
      } catch (err) {
        console.error('Failed to load check-ins:', err);
        setError('Failed to load check-ins.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [memberId]);

  if (loading) return <CheckInSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <span className="text-sm text-red-600">{error}</span>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {latest ? (
        <>
          <CheckInMessage
            checkIn={latest}
            trainerName={
              latest.trainer_id
                ? ((latest.week_data_snapshot as unknown as Record<string, unknown>)?.trainer_name as string) ?? 'Your Trainer'
                : null
            }
            gymName={gymName}
            isUnread={hasUnread && unreadId === latest.id}
            onMarkRead={markRead}
          />

          <CheckInReplySection
            checkInId={latest.id}
            memberId={memberId}
            hasTrainer={!!latest.trainer_id}
            existingReply={latest.reply_text}
          />
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <NexeraCoachAvatar size="xlarge" faded />
          <span className="text-lg font-semibold text-zinc-700">
            Your first check-in is coming
          </span>
          <span className="max-w-xs text-sm text-zinc-500">
            After your first full week of training, your Nexera Coach will send
            you a personalized weekly review every Sunday.
          </span>
        </div>
      )}

      {history.length > 1 && (
        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            Previous check-ins
          </span>
          <div className="space-y-2">
            {history.slice(1).map(checkIn => (
              <PastCheckInRow key={checkIn.id} checkIn={checkIn} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
