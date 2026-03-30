'use client';

import { formatWeekLabel } from '@/lib/checkIn/formatWeekLabel';

interface PastCheckInRowProps {
  checkIn: {
    id: string;
    week_start: string;
    week_end: string;
    final_message: string | null;
    sent_by: string | null;
    sent_at: string | null;
    member_replied: boolean;
    sessions_this_week: number;
    prs_this_week: number;
  };
  onSelect?: (id: string) => void;
}

export function PastCheckInRow({ checkIn, onSelect }: PastCheckInRowProps) {
  const weekLabel = formatWeekLabel(checkIn.week_start);
  const preview = checkIn.final_message
    ? checkIn.final_message.slice(0, 80) + (checkIn.final_message.length > 80 ? '...' : '')
    : 'Check-in';

  return (
    <button
      className="flex w-full items-center gap-3 rounded-lg border border-zinc-100 bg-white p-3 text-left hover:bg-zinc-50"
      onClick={() => onSelect?.(checkIn.id)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-800">
            {weekLabel}
          </span>
          {checkIn.member_replied && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-600">
              Replied
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-zinc-500">{preview}</p>
      </div>
      <div className="flex gap-2 text-xs text-zinc-400">
        <span>{checkIn.sessions_this_week}s</span>
        {checkIn.prs_this_week > 0 && (
          <span className="text-amber-500">
            {checkIn.prs_this_week} PR{checkIn.prs_this_week > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  );
}