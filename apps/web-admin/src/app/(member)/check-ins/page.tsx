'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useMember } from '@/lib/contexts/MemberContext';
import { useUnreadCheckIn } from '@/hooks/useUnreadCheckIn';
import { formatWeekLabel } from '@/lib/checkIn/formatWeekLabel';
import { formatVolume } from '@/lib/weight';
import { NexeraCoachAvatar } from '@/components/checkIn/NexeraCoachAvatar';

// ─── Types (match GET /api/member/[memberId]/check-ins) ─────────

interface CheckInItem {
  id: string;
  week_start: string;
  week_end: string;
  final_message: string | null;
  sent_by: string | null;
  sent_at: string | null;
  member_replied: boolean;
  reply_text: string | null;
  sessions_this_week: number;
  total_volume_lbs: number;
  prs_this_week: number;
  current_streak: number;
  trainer_id: string | null;
}

// ─── Shared styles (Stitch Red-Luxury tokens) ───────────────────

const featuredCard: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-xl, 22px)',
  padding: 20,
};

const standardCard: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-lg, 16px)',
  padding: '14px 16px',
};

const monoStat: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  fontSize: 18,
  lineHeight: 1,
  color: 'var(--color-text-primary)',
};

const statLabel: CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-muted)',
  marginTop: 4,
};

function StatCell({ value, label, gold }: { value: string | number; label: string; gold?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      <span style={{ ...monoStat, color: gold ? 'var(--gold, #E8B339)' : 'var(--color-text-primary)' }}>
        {value}
      </span>
      <span style={statLabel}>{label}</span>
    </div>
  );
}

// ─── Reply box (wired to existing reply API) ────────────────────

function ReplyBox({
  checkInId,
  memberId,
  hasTrainer,
  existingReply,
}: {
  checkInId: string;
  memberId: string;
  hasTrainer: boolean;
  existingReply: string | null;
}) {
  const [reply, setReply] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingReply || submitted) {
    return (
      <div
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: 12,
          marginTop: 4,
        }}
      >
        <p style={{ fontSize: 12, color: 'var(--gold, #E8B339)', margin: 0, fontWeight: 600 }}>
          {hasTrainer ? 'Reply sent to your trainer' : 'Reply logged for your AI coach'}
        </p>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '6px 0 0', fontStyle: 'italic' }}>
          {existingReply || reply}
        </p>
      </div>
    );
  }

  async function handleSubmit() {
    if (!reply.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/member/${memberId}/check-ins/${checkInId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_text: reply.trim() }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError('Failed to send reply. Please try again.');
      }
    } catch {
      setError('Failed to send reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12, marginTop: 4 }}>
      <label
        htmlFor="checkin-reply"
        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}
      >
        {hasTrainer ? 'Reply to your trainer' : 'How did this week feel? (Optional)'}
      </label>
      <textarea
        id="checkin-reply"
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={hasTrainer ? 'Tell your trainer how the week went...' : 'Any thoughts on your training this week?'}
        style={{
          width: '100%',
          backgroundColor: 'var(--color-bg-base)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md, 12px)',
          padding: 12,
          fontSize: 14,
          color: 'var(--color-text-primary)',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
      {error && <p style={{ fontSize: 12, color: 'var(--accent, #E0142F)', margin: '6px 0 0' }}>{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={!reply.trim() || submitting}
        style={{
          marginTop: 8,
          backgroundColor: 'var(--accent, #E0142F)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-full, 9999px)',
          padding: '10px 22px',
          fontSize: 13,
          fontWeight: 700,
          cursor: !reply.trim() || submitting ? 'default' : 'pointer',
          opacity: !reply.trim() || submitting ? 0.5 : 1,
          boxShadow: !reply.trim() || submitting ? 'none' : '0 0 16px var(--accent-glow, rgba(224,20,47,0.28))',
        }}
      >
        {submitting ? 'Sending...' : 'Send reply'}
      </button>
    </div>
  );
}

// ─── Featured (latest) check-in card ────────────────────────────

const MARK_READ_DELAY = 3000;

function LatestCheckInCard({
  checkIn,
  memberId,
  gymName,
  volumeLabel,
  isUnread,
  onMarkRead,
}: {
  checkIn: CheckInItem;
  memberId: string;
  gymName?: string;
  volumeLabel: string;
  isUnread: boolean;
  onMarkRead: () => void;
}) {
  const [firstView, setFirstView] = useState(isUnread);

  // Sync if parent clears unread externally
  useEffect(() => {
    if (!isUnread) setFirstView(false);
  }, [isUnread]);

  // Auto mark-read ritual after 3s on screen
  useEffect(() => {
    if (!firstView) return;
    const t = setTimeout(() => {
      onMarkRead();
      setFirstView(false);
    }, MARK_READ_DELAY);
    return () => clearTimeout(t);
  }, [firstView, onMarkRead]);

  const hasTrainer = !!checkIn.trainer_id;

  return (
    <div
      className={`check-in-card${firstView ? ' unread' : ''}`}
      style={{ ...featuredCard, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      {/* Sender row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <NexeraCoachAvatar size="large" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {hasTrainer ? 'Your Trainer' : 'Your Nexera Coach'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {formatWeekLabel(checkIn.week_start)}
            {gymName ? ` · ${gymName}` : ''}
          </span>
        </div>
        {firstView && <span className="new-pill">NEW</span>}
      </div>

      {/* Stats strip — mono numerals */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          backgroundColor: 'var(--color-bg-base)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md, 12px)',
          padding: '12px 8px',
        }}
      >
        <StatCell value={checkIn.sessions_this_week} label="Sessions" />
        <StatCell value={volumeLabel} label="Volume" />
        <StatCell value={checkIn.prs_this_week} label="PRs" gold={checkIn.prs_this_week > 0} />
        <StatCell value={`${checkIn.current_streak}d`} label="Streak" />
      </div>

      {/* Message body */}
      <p
        style={{
          whiteSpace: 'pre-line',
          fontSize: 14,
          lineHeight: 1.65,
          color: 'var(--color-text-primary)',
          margin: 0,
        }}
      >
        {checkIn.final_message}
      </p>

      <ReplyBox
        checkInId={checkIn.id}
        memberId={memberId}
        hasTrainer={hasTrainer}
        existingReply={checkIn.reply_text}
      />
    </div>
  );
}

// ─── Past check-in row (tap to expand) ──────────────────────────

function PastCheckInCard({ checkIn, volumeLabel }: { checkIn: CheckInItem; volumeLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = checkIn.final_message
    ? checkIn.final_message.slice(0, 90) + (checkIn.final_message.length > 90 ? '…' : '')
    : 'Check-in';

  return (
    <button
      onClick={() => setExpanded((e) => !e)}
      aria-expanded={expanded}
      style={{
        ...standardCard,
        display: 'block',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {formatWeekLabel(checkIn.week_start)}
        </span>
        {checkIn.member_replied && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--gold, #E8B339)',
              background: 'var(--gold-glow, rgba(232,179,57,0.25))',
              borderRadius: 'var(--radius-full, 9999px)',
              padding: '2px 8px',
            }}
          >
            Replied
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-muted)' }}>
          {checkIn.sessions_this_week}s
          {checkIn.prs_this_week > 0 && (
            <span style={{ color: 'var(--gold, #E8B339)' }}> · {checkIn.prs_this_week}PR</span>
          )}
        </span>
      </div>

      {expanded ? (
        <>
          <p style={{ whiteSpace: 'pre-line', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)', margin: '10px 0 0' }}>
            {checkIn.final_message}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <StatCell value={checkIn.sessions_this_week} label="Sessions" />
            <StatCell value={volumeLabel} label="Volume" />
            <StatCell value={checkIn.prs_this_week} label="PRs" gold={checkIn.prs_this_week > 0} />
            <StatCell value={`${checkIn.current_streak}d`} label="Streak" />
          </div>
          {checkIn.reply_text && (
            <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--color-text-secondary)', margin: '12px 0 0' }}>
              You replied: {checkIn.reply_text}
            </p>
          )}
        </>
      ) : (
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            margin: '4px 0 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {preview}
        </p>
      )}
    </button>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────

function CheckInsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, paddingTop: 24 }}>
      <div style={{ width: 160, height: 28, borderRadius: 6, backgroundColor: 'var(--color-bg-elevated)' }} />
      <div style={{ height: 260, borderRadius: 22, backgroundColor: 'var(--color-bg-elevated)' }} />
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 64, borderRadius: 16, backgroundColor: 'var(--color-bg-elevated)' }} />
      ))}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function CheckInsPage() {
  const { member, gym, weightUnit, loading: memberLoading } = useMember();
  const [latest, setLatest] = useState<CheckInItem | null>(null);
  const [history, setHistory] = useState<CheckInItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { hasUnread, checkInId: unreadId, markRead } = useUnreadCheckIn(member?.id ?? '');

  useEffect(() => {
    if (!member) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/member/${member.id}/check-ins`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setLatest(data.latest ?? null);
        setHistory(data.history ?? []);
      } catch {
        setError('Failed to load your check-ins. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [member?.id, retryCount]);

  if (memberLoading || loading) return <CheckInsSkeleton />;

  if (error) {
    return (
      <div style={{ padding: 16, textAlign: 'center', paddingTop: 60 }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16 }}>{error}</p>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
          style={{
            backgroundColor: 'var(--accent, #E0142F)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-full, 9999px)',
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // History minus the latest (latest is featured above)
  const pastCheckIns = history.filter((c) => c.id !== latest?.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, paddingTop: 24 }}>
      {/* Hero header — serif */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1.15,
            margin: 0,
            color: 'var(--color-text-primary)',
          }}
        >
          Weekly Check-Ins
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
          Your weekly reviews{gym?.name ? ` from ${gym.name}` : ''}
        </p>
      </div>

      {latest ? (
        <LatestCheckInCard
          checkIn={latest}
          memberId={member?.id ?? ''}
          gymName={gym?.name}
          volumeLabel={formatVolume(latest.total_volume_lbs, weightUnit)}
          isUnread={hasUnread && unreadId === latest.id}
          onMarkRead={markRead}
        />
      ) : (
        <div style={{ ...featuredCard, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 20px', textAlign: 'center' }}>
          <NexeraCoachAvatar size="xlarge" faded />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Your first check-in is coming
          </span>
          <span style={{ maxWidth: 280, fontSize: 13, color: 'var(--color-text-muted)' }}>
            After your first full week of training, your Nexera Coach will send you a personalized weekly review every Sunday.
          </span>
        </div>
      )}

      {pastCheckIns.length > 0 && (
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-text-muted)',
              margin: '0 0 8px',
            }}
          >
            Previous check-ins
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pastCheckIns.map((c) => (
              <PastCheckInCard key={c.id} checkIn={c} volumeLabel={formatVolume(c.total_volume_lbs, weightUnit)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
