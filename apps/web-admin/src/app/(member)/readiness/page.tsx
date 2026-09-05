'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useMember } from '@/lib/contexts/MemberContext';
import { BackButton } from '@/components/nav/BackButton';
import type { ReadinessResult, ReadinessZone } from '@nexera/types';

// ─── Zone tokens (Stitch Red-Luxury) ────────────────────────────

const ZONE_TOKEN: Record<ReadinessZone, string> = {
  peak: 'var(--readiness-peak, #00C896)',
  ready: 'var(--readiness-ready, #E0142F)',
  moderate: 'var(--readiness-moderate, #FFB020)',
  rest: 'var(--readiness-rest, #FF7A90)',
};

const ZONE_LABEL: Record<ReadinessZone, string> = {
  peak: 'Peak',
  ready: 'Ready',
  moderate: 'Moderate',
  rest: 'Rest',
};

interface HistoryEntry {
  cache_date: string;
  score: number;
  zone: ReadinessZone;
}

// ─── Shared styles ──────────────────────────────────────────────

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
  padding: 16,
};

const sectionTitle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-text-muted)',
  margin: '0 0 12px',
};

// ─── Big readiness ring (240° arc, token colors) ────────────────

function ReadinessRing({ score, zone }: { score: number; zone: ReadinessZone }) {
  const SIZE = 190;
  const STROKE = 14;
  const RADIUS = (SIZE - STROKE) / 2;
  const CENTER = SIZE / 2;
  const ARC_DEGREES = 240;
  const START_ANGLE = 150;
  const CIRCUMFERENCE = (ARC_DEGREES / 360) * (2 * Math.PI * RADIUS);
  const fillLength = (Math.max(0, Math.min(100, score)) / 100) * CIRCUMFERENCE;
  const color = ZONE_TOKEN[zone];

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Readiness score ${score} out of 100 — ${ZONE_LABEL[zone]} zone`}
    >
      {/* Background track */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={STROKE}
        strokeDasharray={`${CIRCUMFERENCE} ${2 * Math.PI * RADIUS}`}
        strokeLinecap="round"
        transform={`rotate(${START_ANGLE} ${CENTER} ${CENTER})`}
      />
      {/* Filled arc — hidden at 0 to avoid round-cap dot artifact */}
      {score > 0 && (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={`${fillLength} ${CIRCUMFERENCE - fillLength}`}
          strokeLinecap="round"
          transform={`rotate(${START_ANGLE} ${CENTER} ${CENTER})`}
          style={{
            filter: zone === 'peak' ? `drop-shadow(0 0 8px ${color})` : 'none',
            transition: 'stroke-dasharray 1s ease-out',
          }}
        />
      )}
      {/* Score — mono numeral */}
      <text
        x={CENTER}
        y={CENTER - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--color-text-primary, #fff)"
        fontSize="52"
        fontWeight="800"
        fontFamily="var(--font-mono)"
      >
        {score}
      </text>
      <text
        x={CENTER}
        y={CENTER + 32}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize="13"
        fontWeight="700"
        letterSpacing="0.12em"
        style={{ textTransform: 'uppercase' }}
      >
        {ZONE_LABEL[zone].toUpperCase()}
      </text>
    </svg>
  );
}

// ─── Contributing factor row ────────────────────────────────────

const SIGNAL_META: Array<{ key: keyof ReadinessResult['signals']; dominantKey: string; label: string }> = [
  { key: 'session_count', dominantKey: 'recent_sessions', label: 'Recent sessions' },
  { key: 'rpe', dominantKey: 'last_rpe', label: 'Last session effort' },
  { key: 'rest_days', dominantKey: 'rest_days', label: 'Rest days' },
  { key: 'streak', dominantKey: 'streak', label: 'Streak momentum' },
  { key: 'volume_trend', dominantKey: 'volume_trend', label: 'Volume trend' },
];

const MAX_ADJUSTMENT = 25; // largest possible single-signal adjustment

function FactorRow({ label, value, dominant }: { label: string; value: number; dominant: boolean }) {
  const positive = value >= 0;
  const barColor = value === 0
    ? 'var(--color-text-muted)'
    : positive
      ? 'var(--readiness-peak, #00C896)'
      : 'var(--accent, #E0142F)';
  const barPct = Math.min(100, (Math.abs(value) / MAX_ADJUSTMENT) * 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 130, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</span>
        {dominant && (
          <span
            aria-label="Primary factor"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--gold, #E8B339)',
              boxShadow: '0 0 6px var(--gold-glow, rgba(232,179,57,0.25))',
              flexShrink: 0,
            }}
          />
        )}
      </div>
      <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${barPct}%`,
            borderRadius: 3,
            backgroundColor: barColor,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 700,
          width: 34,
          textAlign: 'right',
          color: value === 0 ? 'var(--color-text-muted)' : barColor,
        }}
      >
        {positive ? `+${value}` : value}
      </span>
    </div>
  );
}

// ─── 7-day trend ────────────────────────────────────────────────

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function TrendChart({ history }: { history: HistoryEntry[] }) {
  // API returns descending by date — render oldest → newest
  const entries = [...history].reverse().slice(-7);

  if (entries.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
        Train a few days to build your readiness trend.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110 }}>
      {entries.map((e) => {
        const d = new Date(e.cache_date + 'T00:00:00Z');
        const color = ZONE_TOKEN[e.zone] ?? 'var(--color-text-muted)';
        return (
          <div
            key={e.cache_date}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              {e.score}
            </span>
            <div
              style={{
                width: '100%',
                maxWidth: 26,
                height: `${Math.max(6, (e.score / 100) * 64)}px`,
                borderRadius: 5,
                backgroundColor: color,
                opacity: 0.9,
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
              {DAY_LETTERS[d.getUTCDay()]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────

function ReadinessSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, paddingTop: 24 }}>
      <div style={{ width: 140, height: 28, borderRadius: 6, backgroundColor: 'var(--color-bg-elevated)' }} />
      <div style={{ height: 300, borderRadius: 22, backgroundColor: 'var(--color-bg-elevated)' }} />
      <div style={{ height: 180, borderRadius: 16, backgroundColor: 'var(--color-bg-elevated)' }} />
      <div style={{ height: 150, borderRadius: 16, backgroundColor: 'var(--color-bg-elevated)' }} />
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function ReadinessPage() {
  const { member, loading: memberLoading } = useMember();
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!member) return;
    setLoading(true);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        const [scoreRes, historyRes] = await Promise.all([
          fetch(`/api/member/${member.id}/readiness`),
          fetch(`/api/readiness/${member.id}/history?days=7`),
        ]);
        if (!scoreRes.ok) throw new Error('Failed to load');
        const scoreJson = await scoreRes.json();
        if (!cancelled) setReadiness(scoreJson.readiness ?? null);

        if (historyRes.ok) {
          const historyJson = await historyRes.json();
          if (!cancelled) setHistory(historyJson.history ?? []);
        }
      } catch {
        if (!cancelled) setError('Failed to load your readiness. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [member?.id, retryCount]);

  if (memberLoading || loading) return <ReadinessSkeleton />;

  if (error || !readiness) {
    return (
      <div style={{ padding: 16, paddingTop: 24 }}>
        <BackButton />
        <div style={{ textAlign: 'center', paddingTop: 36 }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16 }}>
          {error ?? 'Readiness data is not available yet.'}
        </p>
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
      </div>
    );
  }

  const zoneColor = ZONE_TOKEN[readiness.zone];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, paddingTop: 24 }}>
      <BackButton style={{ alignSelf: 'flex-start', marginBottom: -8 }} />
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
          Readiness
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
          How prepared your body is to train today
        </p>
      </div>

      {/* Featured ring card */}
      <div style={{ ...featuredCard, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 24 }}>
        <ReadinessRing score={readiness.score} zone={readiness.zone} />
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 20,
            fontWeight: 600,
            margin: 0,
            color: 'var(--color-text-primary)',
            textAlign: 'center',
          }}
        >
          {readiness.headline}
        </p>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center', maxWidth: 320 }}>
          {readiness.subline}
        </p>
      </div>

      {/* Contributing factors */}
      <div style={standardCard}>
        <p style={sectionTitle}>Contributing Factors</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SIGNAL_META.map((s) => (
            <FactorRow
              key={s.key}
              label={s.label}
              value={readiness.signals[s.key]}
              dominant={readiness.dominant_signal === s.dominantKey}
            />
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '12px 0 0' }}>
          Adjustments to your baseline of 50. The gold dot marks today&apos;s primary factor.
        </p>
      </div>

      {/* 7-day trend */}
      <div style={standardCard}>
        <p style={sectionTitle}>7-Day Trend</p>
        <TrendChart history={history} />
      </div>

      {/* Zone legend */}
      <div style={{ ...standardCard, display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
        {(['peak', 'ready', 'moderate', 'rest'] as ReadinessZone[]).map((z) => (
          <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: ZONE_TOKEN[z],
                boxShadow: z === readiness.zone ? `0 0 6px ${zoneColor}` : 'none',
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: z === readiness.zone ? 700 : 500,
                color: z === readiness.zone ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}
            >
              {ZONE_LABEL[z]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
