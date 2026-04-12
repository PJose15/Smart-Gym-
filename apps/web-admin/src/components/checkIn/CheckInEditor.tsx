'use client';

import { useState } from 'react';
import type { CheckInWeekData } from '@nexera/types';
import { DataRow } from './DataRow';
import { TrendRow } from './TrendRow';
import {
  convertFromLbs,
  formatVolume,
  formatWeight,
  type WeightUnit,
} from '@/lib/weight';

interface CheckInEditorProps {
  aiDraft: string;
  weekData: CheckInWeekData;
  /**
   * Target member's preferred weight unit. Quoted weights in the data panel
   * render in this unit so the recipient sees numbers in their own scale —
   * this is independent of the staff's gym-configured unit.
   */
  memberWeightUnit?: WeightUnit;
  writeOwn?: boolean;
  onSend: (message: string, wroteOwn: boolean) => Promise<void>;
  onCancel: () => void;
}

export function CheckInEditor({
  aiDraft,
  weekData,
  memberWeightUnit = 'lbs',
  writeOwn = false,
  onSend,
  onCancel,
}: CheckInEditorProps) {
  const unit = memberWeightUnit;
  const [message, setMessage] = useState(writeOwn ? '' : aiDraft);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await onSend(message.trim(), writeOwn || message.trim() !== aiDraft);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full gap-4">
      {/* LEFT: Data panel */}
      <div className="w-80 shrink-0 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-zinc-800">
            {weekData.member_first_name}&apos;s week
          </span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-400">
            weights in {unit}
          </span>
        </div>

        {/* This week at a glance */}
        <div>
          <DataRow
            label="Sessions"
            value={`${weekData.sessions_this_week}${
              weekData.sessions_scheduled
                ? ` of ${weekData.sessions_scheduled} scheduled`
                : ''
            }`}
          />
          <DataRow
            label="Volume"
            value={formatVolume(weekData.total_volume_lbs, unit)}
          />
          <DataRow
            label="PRs"
            value={weekData.prs_this_week}
            highlight={weekData.prs_this_week > 0}
          />
          <DataRow
            label="Streak"
            value={`${weekData.current_streak} days`}
          />
          <DataRow
            label="Avg RPE"
            value={weekData.avg_rpe ?? 'Not logged'}
          />
        </div>

        {/* vs last week */}
        <div>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            vs last week
          </span>
          <TrendRow
            label="Sessions"
            current={weekData.sessions_this_week}
            previous={weekData.sessions_last_week}
          />
          <TrendRow
            label="Volume"
            current={weekData.total_volume_lbs}
            previous={weekData.volume_last_week}
            format={v => formatVolume(v, unit)}
          />
        </div>

        {/* PRs this week */}
        {weekData.pr_details.length > 0 && (
          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
              PRs this week
            </span>
            {weekData.pr_details.map((pr, i) => {
              const improvement = convertFromLbs(pr.improvement_lbs, unit);
              const improvementLabel =
                unit === 'kg' && improvement < 10
                  ? improvement.toFixed(1)
                  : Math.round(improvement).toLocaleString();
              return (
                <div key={i} className="flex items-center justify-between py-0.5">
                  <span className="text-sm text-zinc-600">{pr.machine_name}</span>
                  <span className="text-sm font-medium text-zinc-800">
                    {formatWeight(pr.weight_lbs, unit)}{' '}
                    <span className="text-emerald-600">
                      +{improvementLabel}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Readiness */}
        {weekData.avg_readiness_score !== null && (
          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
              Readiness this week
            </span>
            <DataRow
              label="Avg score"
              value={weekData.avg_readiness_score}
            />
            <DataRow
              label="Dominant zone"
              value={weekData.dominant_readiness_zone ?? 'N/A'}
            />
          </div>
        )}

        {/* Muscle map summary */}
        <div>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            Muscle focus
          </span>
          {weekData.most_trained_muscles.length > 0 && (
            <DataRow
              label="Most trained"
              value={weekData.most_trained_muscles.join(', ')}
            />
          )}
          {weekData.undertrained_muscles.length > 0 && (
            <DataRow
              label="Needs attention"
              value={weekData.undertrained_muscles.join(', ')}
            />
          )}
          <DataRow
            label="Push/pull balance"
            value={`${weekData.push_pull_balance}%`}
            highlight={
              weekData.push_pull_balance < 40 ||
              weekData.push_pull_balance > 60
            }
          />
        </div>

        {/* Injuries */}
        {weekData.injuries_or_limitations && (
          <div className="rounded-md bg-amber-50 p-2">
            <span className="text-xs font-medium text-amber-700">
              Limitations on file
            </span>
            <p className="mt-0.5 text-sm text-amber-600">
              {weekData.injuries_or_limitations}
            </p>
          </div>
        )}
      </div>

      {/* RIGHT: Message editor */}
      <div className="flex flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <span className="block text-sm font-semibold text-zinc-800">
              {writeOwn ? 'Write check-in' : 'Edit AI draft'}
            </span>
            <span className="text-xs text-zinc-500">
              To: {weekData.member_first_name}
            </span>
          </div>
        </div>

        {/* Format reminder */}
        <div className="mb-2 rounded-md bg-violet-50 px-3 py-1.5">
          <span className="text-xs text-violet-600">
            <span className="font-medium">Three-part format:</span> What they
            did · What it means · What comes next
          </span>
        </div>

        <textarea
          className="flex-1 resize-none rounded-lg border border-zinc-200 p-3 text-sm text-zinc-800 placeholder-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={
            writeOwn
              ? `${weekData.member_first_name}, write your three-part check-in here...`
              : 'Edit the AI draft above or write your own...'
          }
          rows={12}
        />

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            {message.length} characters
            {message.length > 500 && (
              <span className="text-amber-500">
                {' '}&mdash; consider trimming for impact
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSend}
              disabled={!message.trim() || sending}
            >
              {sending
                ? 'Sending...'
                : `Send to ${weekData.member_first_name}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
