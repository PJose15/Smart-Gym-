'use client';

import { useState, useEffect } from 'react';
import { useScanFlowStore } from '@/lib/stores/scanFlowStore';

interface SessionSummary {
  sets_count: number;
  total_volume_lbs: number;
  best_weight_lbs: number;
  is_personal_best: boolean;
  points_awarded: number;
  streak: number;
}

export function SessionComplete() {
  const { machine, member, sessionId, scanTimestamp, scanEventId, reset } = useScanFlowStore();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [tip, setTip] = useState('');
  const [loading, setLoading] = useState(true);
  const [programReady, setProgramReady] = useState(false);

  // Compute session duration
  const durationSeconds = scanTimestamp ? Math.round((Date.now() - scanTimestamp) / 1000) : null;

  // Finalize session + fetch tip on mount
  useEffect(() => {
    if (!sessionId || !member) {
      setLoading(false);
      return;
    }

    (async () => {
      // Complete session
      try {
        const res = await fetch(`/api/sessions/${sessionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: member.id }),
        });
        if (res.ok) {
          const data = await res.json();
          setSummary(data.summary);
        }
      } catch { /* non-critical */ }

      // Mark scan event as led_to_log
      if (scanEventId) {
        fetch('/api/scan-events', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scan_event_id: scanEventId, led_to_log: true }),
        }).catch(() => { /* non-critical analytics */ });
      }

      // Fetch tip (pass member_id + machine_id for AI-powered tips)
      try {
        const category = machine?.category || '';
        const experience = member?.experience_level || '';
        const params = new URLSearchParams({ category, experience });
        if (member?.id) params.set('member_id', member.id);
        if (machine?.id) params.set('machine_id', machine.id);
        const tipRes = await fetch(`/api/tips?${params.toString()}`);
        if (tipRes.ok) {
          const data = await tipRes.json();
          setTip(data.tip);
        }
      } catch { /* non-critical */ }

      // Fire-and-forget: check if member qualifies for AI program generation
      if (member?.id && machine?.gym_id) {
        fetch('/api/programs/auto-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: member.id, gym_id: machine.gym_id }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.program_id) setProgramReady(true);
          })
          .catch(() => { /* non-critical */ });
      }

      setLoading(false);
    })();
  }, [sessionId, member, machine, scanEventId]);

  const handleScanNext = () => {
    // Reset flow state so user can scan a new machine QR code
    reset();
    window.location.href = '/';
  };

  const handleDoneForToday = () => {
    reset();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Wrapping up...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--page-padding-x)',
        paddingTop: 'var(--space-10)',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        <div style={{ fontSize: 48, marginBottom: 'var(--space-3)' }}>
          {summary?.is_personal_best ? '🏆' : '✅'}
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--color-text-primary)',
          }}
        >
          Session Complete!
        </h2>
        {machine && (
          <p style={{ margin: 0, marginTop: 4, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            {machine.name}
          </p>
        )}
      </div>

      {/* Stats grid */}
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <StatBox label="Sets" value={String(summary.sets_count)} />
          <StatBox label="Best" value={`${summary.best_weight_lbs} lbs`} />
          <StatBox label="Volume" value={`${Math.round(summary.total_volume_lbs).toLocaleString()}`} sub="lbs" />
          {durationSeconds !== null && (
            <StatBox label="Duration" value={formatDuration(durationSeconds)} />
          )}
        </div>
      )}

      {/* PR banner */}
      {summary?.is_personal_best && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-gold-subtle)',
            border: '1px solid color-mix(in srgb, var(--color-gold) 25%, transparent)',
            textAlign: 'center',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--color-gold)',
            marginBottom: 'var(--space-4)',
          }}
        >
          🏆 Personal Record this session!
        </div>
      )}

      {/* Streak + Points */}
      {summary && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--space-6)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-amber)' }}>
              {summary.streak}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Day Streak 🔥
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-blue)' }}>
              +{summary.points_awarded}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Points Earned
            </div>
          </div>
        </div>
      )}

      {/* Tip */}
      {tip && (
        <div
          style={{
            padding: 'var(--card-padding)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border-subtle)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-wider)',
              marginBottom: 'var(--space-2)',
            }}
          >
            💡 Tip
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--leading-relaxed)',
            }}
          >
            {tip}
          </p>
        </div>
      )}

      {/* AI Program Ready Banner */}
      {programReady && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-blue-subtle)',
            border: '1px solid color-mix(in srgb, var(--color-blue) 25%, transparent)',
            textAlign: 'center',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-blue-light)',
            marginBottom: 'var(--space-4)',
          }}
        >
          Your AI program is ready! Check your program tab to get started.
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* CTAs */}
      <button
        onClick={handleScanNext}
        style={{
          width: '100%',
          height: 'var(--tap-target-lg)',
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          backgroundColor: 'var(--gym-primary)',
          color: 'var(--gym-text-on-primary)',
          fontSize: 'var(--text-md)',
          fontWeight: 'var(--weight-bold)',
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-blue)',
          marginBottom: 'var(--space-3)',
        }}
      >
        Scan Next Machine
      </button>
      <button
        onClick={handleDoneForToday}
        style={{
          width: '100%',
          height: 'var(--tap-target-min)',
          borderRadius: 'var(--radius-lg)',
          border: '2px solid var(--color-border-default)',
          backgroundColor: 'transparent',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-medium)',
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
        }}
      >
        Done for Today
      </button>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-bg-raised)',
        border: '1px solid var(--color-border-subtle)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--weight-bold)',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-primary)',
        }}
      >
        {value}
      </div>
      {sub && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}> {sub}</span>
      )}
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
