'use client';

import { useState } from 'react';

interface CheckInReplySectionProps {
  checkInId: string;
  memberId: string;
  hasTrainer: boolean;
  existingReply?: string | null;
}

export function CheckInReplySection({
  checkInId,
  memberId,
  hasTrainer,
  existingReply,
}: CheckInReplySectionProps) {
  const [reply, setReply] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingReply || submitted) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3">
        <svg
          className="mt-0.5 h-4 w-4 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          role="img"
          aria-label="Reply sent"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <div>
          <span className="text-sm text-emerald-700">
            {hasTrainer
              ? 'Your reply was sent to your trainer.'
              : 'Your reply was logged. Your AI coach will consider it next week.'}
          </span>
          {(existingReply || reply) && (
            <p className="mt-1 text-sm text-emerald-600 italic">
              {existingReply || reply}
            </p>
          )}
        </div>
      </div>
    );
  }

  async function handleSubmit() {
    if (!reply.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/member/${memberId}/check-ins/${checkInId}/reply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reply_text: reply.trim() }),
        }
      );
      if (res.ok) {
        setSubmitted(true);
      } else {
        console.error('Failed to send reply:', res.status);
        setError('Failed to send reply. Please try again.');
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
      setError('Failed to send reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-zinc-600">
        {hasTrainer
          ? 'Reply to your trainer:'
          : 'How did this week feel? (Optional)'}
      </span>
      <textarea
        className="w-full rounded-lg border border-zinc-200 p-3 text-sm text-zinc-800 placeholder-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        value={reply}
        onChange={e => setReply(e.target.value)}
        placeholder={
          hasTrainer
            ? 'Tell your trainer how the week went...'
            : 'Any thoughts on your training this week?'
        }
        rows={3}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <button
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        onClick={handleSubmit}
        disabled={!reply.trim() || submitting}
      >
        {submitting ? 'Sending...' : 'Send reply'}
      </button>
    </div>
  );
}
