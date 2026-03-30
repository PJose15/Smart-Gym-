'use client';

import { formatWeekLabel } from '@/lib/checkIn/formatWeekLabel';

interface PendingCheckInCardProps {
  checkIn: {
    id: string;
    ai_draft: string;
    week_start: string;
    sessions_this_week: number;
    prs_this_week: number;
    member_id: string;
    members?: { display_name: string; avatar_url: string | null } | null;
  };
  onApprove: () => void;
  onEdit: () => void;
  onWriteOwn: () => void;
}

export function PendingCheckInCard({
  checkIn,
  onApprove,
  onEdit,
  onWriteOwn,
}: PendingCheckInCardProps) {
  const memberName = checkIn.members?.display_name ?? 'Member';
  const avatarUrl = checkIn.members?.avatar_url;
  const weekLabel = formatWeekLabel(checkIn.week_start);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
      {/* Member header */}
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={memberName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-600">
            {memberName[0]}
          </div>
        )}
        <div className="flex-1">
          <span className="block text-sm font-semibold text-zinc-900">
            {memberName}
          </span>
          <span className="text-xs text-zinc-500">{weekLabel}</span>
        </div>
        <div className="flex gap-3 text-xs text-zinc-500">
          <span>{checkIn.sessions_this_week} sessions</span>
          <span>{checkIn.prs_this_week} PRs</span>
        </div>
      </div>

      {/* AI draft preview */}
      <div className="rounded-md bg-zinc-50 p-3">
        <div className="mb-1 flex items-center gap-1">
          <svg className="h-3 w-3 text-violet-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z" />
          </svg>
          <span className="text-xs font-medium text-violet-600">AI draft</span>
        </div>
        <p className="whitespace-pre-line text-sm text-zinc-700 leading-relaxed">
          {checkIn.ai_draft}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={onApprove}
        >
          Send as-is
        </button>
        <button
          className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          onClick={onEdit}
        >
          Edit and send
        </button>
        <button
          className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          onClick={onWriteOwn}
        >
          Write my own
        </button>
      </div>
    </div>
  );
}