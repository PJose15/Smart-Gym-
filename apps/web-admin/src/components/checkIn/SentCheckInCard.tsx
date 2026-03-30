'use client';

import { formatWeekLabel } from '@/lib/checkIn/formatWeekLabel';

interface SentCheckInCardProps {
  checkIn: {
    id: string;
    week_start: string;
    final_message: string | null;
    sent_by: string | null;
    sent_at: string | null;
    member_replied: boolean;
    reply_text?: string | null;
    sessions_this_week: number;
    prs_this_week: number;
    member_id: string;
    members?: { display_name: string; avatar_url: string | null } | null;
  };
}

export function SentCheckInCard({ checkIn }: SentCheckInCardProps) {
  const memberName = checkIn.members?.display_name ?? 'Member';
  const weekLabel = formatWeekLabel(checkIn.week_start);
  const sentLabel =
    checkIn.sent_by === 'trainer'
      ? 'You wrote'
      : checkIn.sent_by === 'trainer_approved_ai'
        ? 'AI draft, you approved'
        : 'AI sent';

  return (
    <div className="rounded-lg border border-zinc-100 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-800">
            {memberName}
          </span>
          <span className="text-xs text-zinc-400">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
            {sentLabel}
          </span>
          {checkIn.member_replied && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-600">
              Replied
            </span>
          )}
        </div>
      </div>

      {checkIn.final_message && (
        <p className="text-sm text-zinc-600 line-clamp-2">
          {checkIn.final_message}
        </p>
      )}

      {checkIn.member_replied && checkIn.reply_text && (
        <div className="rounded-md bg-blue-50 p-2">
          <span className="text-xs font-medium text-blue-600">
            Member reply:
          </span>
          <p className="mt-0.5 text-sm text-blue-700">
            {checkIn.reply_text}
          </p>
        </div>
      )}
    </div>
  );
}