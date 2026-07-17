'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { PageHeader } from '../components/PageHeader';
import { AnimatedPage } from '../components/AnimatedPage';

// ─── Types ───────────────────────────────────────────────

interface DraftRow {
  id: string;
  gym_id: string;
  trainer_profile_id: string;
  member_profile_id: string;
  workout_id: string | null;
  period_start: string | null;
  period_end: string | null;
  draft_title: string;
  draft_body: string;
  confidence: number;
  signals: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
  member_profile?: { full_name: string } | null;
}

// ─── Styles ─────────────────────────────────────────────

const filterBarStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginBottom: 20,
  alignItems: 'center',
};

const filterSelectStyle: CSSProperties = {
  padding: '6px 12px',
  fontSize: 13,
  border: '1px solid var(--color-border-default)',
  borderRadius: 6,
  outline: 'none',
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-primary)',
};

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
  gap: 16,
};

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: '20px',
  border: '1px solid var(--color-border-subtle)',
  cursor: 'pointer',
  transition: 'box-shadow 0.2s',
};

const cardTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  marginBottom: 6,
};

const memberNameStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--color-text-secondary)',
  marginBottom: 8,
};

const bodyPreviewStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--color-text-muted)',
  lineHeight: 1.5,
  marginBottom: 12,
  maxHeight: 60,
  overflow: 'hidden',
};

const chipRowStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  marginBottom: 12,
};

const chipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 600,
};

const actionsRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 8,
};

const sendBtnStyle: CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-blue)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const discardBtnStyle: CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-red)',
  backgroundColor: 'transparent',
  border: '1px solid var(--color-red)',
  borderRadius: 6,
  cursor: 'pointer',
};

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  borderRadius: 12,
  padding: 32,
  width: '90%',
  maxWidth: 640,
  maxHeight: '85vh',
  overflowY: 'auto',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 160,
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid var(--color-border-default)',
  borderRadius: 6,
  fontFamily: 'inherit',
  resize: 'vertical',
  boxSizing: 'border-box',
  backgroundColor: 'var(--color-bg-highest)',
  color: 'var(--color-text-primary)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid var(--color-border-default)',
  borderRadius: 6,
  boxSizing: 'border-box',
  marginBottom: 12,
  backgroundColor: 'var(--color-bg-highest)',
  color: 'var(--color-text-primary)',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  marginBottom: 6,
};

const signalsPanelStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-highest)',
  borderRadius: 8,
  padding: '14px 16px',
  marginBottom: 16,
  fontSize: 13,
  color: 'var(--color-text-muted)',
};

const confidenceBadgeStyle = (confidence: number): CSSProperties => ({
  ...chipStyle,
  backgroundColor: confidence >= 0.7 ? 'var(--color-green-light)' : confidence >= 0.5 ? 'rgba(255, 215, 0,0.15)' : 'var(--color-red-light)',
  color: confidence >= 0.7 ? 'var(--color-green)' : confidence >= 0.5 ? 'var(--color-gold)' : 'var(--color-red)',
});

const emptyStyle: CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: 'var(--color-text-muted)',
  fontSize: 15,
};

const loadingStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '60px 0',
};

const errorStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-light)',
  color: 'var(--color-red)',
  padding: '14px 18px',
  borderRadius: 8,
  fontSize: 14,
  marginBottom: 16,
};

const statsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const statsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 14,
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: 'var(--color-bg-highest)',
  color: 'var(--color-text-muted)',
};

// ─── Component ────────────────────────────────────────────

export default function CopilotInboxPage() {
  const { authed } = useStaffAuth();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedDraft, setSelectedDraft] = useState<DraftRow | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [sending, setSending] = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (authed) checkFeatureFlag();
  }, [authed]);

  useEffect(() => {
    if (featureEnabled) fetchDrafts();
  }, [featureEnabled, filterStatus]);

  async function checkFeatureFlag() {
    const { data } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'ai_trainer_copilot')
      .is('profile_id', null)
      .limit(1)
      .single();
    setFeatureEnabled(data?.enabled ?? false);
    setLoading(false);
  }

  async function fetchDrafts() {
    setLoading(true);
    try {
      let query = supabase
        .from('coach_note_drafts')
        .select('*, member_profile:member_profile_id(full_name)')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) { setError(fetchError.message); return; }
      setDrafts((data as unknown as DraftRow[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load drafts');
    } finally {
      setLoading(false);
    }
  }

  function openDraft(draft: DraftRow) {
    setSelectedDraft(draft);
    setEditTitle(draft.draft_title);
    setEditBody(draft.draft_body);
  }

  function closeDraft() {
    setSelectedDraft(null);
    setEditTitle('');
    setEditBody('');
  }

  async function handleApproveAndSend() {
    if (!selectedDraft) return;
    setSending(true);
    setError(null);

    try {
      const wasEdited =
        editTitle !== selectedDraft.draft_title || editBody !== selectedDraft.draft_body;

      const { data: { session } } = await supabase.auth.getSession();

      // Call edge function if available, otherwise do client-side operations
      // For now, do client-side since edge functions may not be deployed
      const source = selectedDraft.workout_id ? 'workout' : (selectedDraft.period_start ? 'weekly' : 'manual');

      // Create coach_notes row
      const { data: note, error: noteErr } = await supabase
        .from('coach_notes')
        .insert({
          gym_id: selectedDraft.gym_id,
          trainer_profile_id: selectedDraft.trainer_profile_id,
          member_profile_id: selectedDraft.member_profile_id,
          source,
          status: 'sent',
          title: editTitle,
          body: editBody,
          meta: selectedDraft.signals,
          sent_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (noteErr) { setError(noteErr.message); setSending(false); return; }

      // Update draft status
      await supabase
        .from('coach_note_drafts')
        .update({
          status: 'sent',
          draft_title: editTitle,
          draft_body: editBody,
        })
        .eq('id', selectedDraft.id);

      // Log actions
      const userId = session?.user?.id;
      if (userId && note) {
        const actions: any[] = [];
        if (wasEdited) {
          actions.push({
            gym_id: selectedDraft.gym_id,
            draft_id: selectedDraft.id,
            note_id: note.id,
            actor_profile_id: userId,
            action: 'edited',
          });
        }
        actions.push({
          gym_id: selectedDraft.gym_id,
          draft_id: selectedDraft.id,
          note_id: note.id,
          actor_profile_id: userId,
          action: 'approved',
        });
        actions.push({
          gym_id: selectedDraft.gym_id,
          draft_id: selectedDraft.id,
          note_id: note.id,
          actor_profile_id: userId,
          action: 'sent',
        });
        await supabase.from('coach_note_actions').insert(actions);
      }

      closeDraft();
      fetchDrafts();
    } catch {
      setError('Failed to send note');
    } finally {
      setSending(false);
    }
  }

  async function handleDiscard(draftId: string) {
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();

    await supabase
      .from('coach_note_drafts')
      .update({ status: 'discarded' })
      .eq('id', draftId);

    if (session?.user?.id) {
      const draft = drafts.find((d) => d.id === draftId);
      await supabase.from('coach_note_actions').insert({
        gym_id: draft?.gym_id,
        draft_id: draftId,
        actor_profile_id: session.user.id,
        action: 'discarded',
      });
    }

    closeDraft();
    fetchDrafts();
  }

  // Feature flag gate
  if (featureEnabled === false) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader title="Co-Pilot" description="Trainer Co-Pilot is not enabled for your gym." />
        <p style={emptyStyle}>Contact your gym owner to enable the <strong>ai_trainer_copilot</strong> feature flag.</p>
      </div>
    );
  }

  if (loading && featureEnabled === null) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader title="Co-Pilot" description="AI-assisted coach note drafts" />
        <div style={loadingStyle}><div className="spinner-enhanced" /></div>
      </div>
    );
  }

  const signalsDisplay = (signals: Record<string, unknown> | null) => {
    if (!signals) return null;
    const items: string[] = [];
    if (signals.total_sets) items.push(`${signals.total_sets} sets`);
    if (signals.total_volume_kg) items.push(`${Math.round(signals.total_volume_kg as number)} kg vol`);
    if (signals.workouts_in_period) items.push(`${signals.workouts_in_period} workouts`);
    if (Array.isArray(signals.prs) && signals.prs.length > 0) items.push(`${signals.prs.length} PR${signals.prs.length > 1 ? 's' : ''}`);
    if (Array.isArray(signals.guardrails) && signals.guardrails.length > 0) items.push(`${signals.guardrails.length} guardrail${signals.guardrails.length > 1 ? 's' : ''}`);
    return items;
  };

  return (
    <AnimatedPage>
      <div style={{ padding: 24 }}>
        <PageHeader title="Co-Pilot Inbox" description="Review, edit, and send AI-generated coach note drafts to your members." />

        {error && <div style={errorStyle}>{error}</div>}

        {/* Stats strip */}
        {!loading && drafts.length > 0 && (() => {
          const pendingCount = drafts.filter((d) => d.status === 'pending').length;
          const sentCount = drafts.filter((d) => d.status === 'sent').length;
          const discardedCount = drafts.filter((d) => d.status === 'discarded').length;
          const avgConfidence = drafts.length > 0
            ? Math.round(drafts.reduce((s, d) => s + d.confidence, 0) / drafts.length * 100)
            : 0;
          const uniqueMembers = new Set(drafts.map((d) => d.member_profile_id)).size;
          return (
            <div style={statsStripStyle}>
              <span style={statsChipStyle}>{drafts.length} draft{drafts.length !== 1 ? 's' : ''}</span>
              {pendingCount > 0 && <span style={{ ...statsChipStyle, backgroundColor: 'rgba(255, 215, 0,0.15)', color: 'var(--color-gold)' }}>{pendingCount} pending</span>}
              {sentCount > 0 && <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-green-light)', color: 'var(--color-green)' }}>{sentCount} sent</span>}
              {discardedCount > 0 && <span style={statsChipStyle}>{discardedCount} discarded</span>}
              <span style={statsChipStyle}>{avgConfidence}% avg confidence</span>
              <span style={statsChipStyle}>{uniqueMembers} member{uniqueMembers !== 1 ? 's' : ''}</span>
            </div>
          );
        })()}

        <div style={filterBarStyle}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>Status:</label>
          <select
            style={filterSelectStyle}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="discarded">Discarded</option>
            <option value="all">All</option>
          </select>
        </div>

        {loading ? (
          <div style={loadingStyle}><div className="spinner-enhanced" /></div>
        ) : drafts.length === 0 ? (
          <p style={emptyStyle}>No drafts found. Drafts are generated when members complete workouts.</p>
        ) : (
          <div style={cardGridStyle}>
            {drafts.map((draft) => {
              const chips = signalsDisplay(draft.signals);
              return (
                <div
                  key={draft.id}
                  style={cardStyle}
                  className="section-glow"
                  onClick={() => openDraft(draft)}
                >
                  <div style={cardTitleStyle}>{draft.draft_title}</div>
                  <div style={memberNameStyle}>
                    {draft.member_profile?.full_name ?? 'Member'}
                    {' · '}
                    {new Date(draft.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div style={bodyPreviewStyle}>{draft.draft_body}</div>
                  <div style={chipRowStyle}>
                    <span style={confidenceBadgeStyle(draft.confidence)}>
                      {Math.round(draft.confidence * 100)}% confidence
                    </span>
                    {chips?.map((c, i) => (
                      <span key={i} style={{ ...chipStyle, backgroundColor: 'var(--color-blue-subtle)', color: 'var(--color-blue)' }}>{c}</span>
                    ))}
                  </div>
                  {draft.status === 'pending' && (
                    <div style={actionsRowStyle}>
                      <button
                        style={sendBtnStyle}
                        className="btn-primary"
                        onClick={(e) => { e.stopPropagation(); openDraft(draft); }}
                      >
                        Review & Send
                      </button>
                      <button
                        style={discardBtnStyle}
                        className="btn-danger"
                        onClick={(e) => { e.stopPropagation(); handleDiscard(draft.id); }}
                      >
                        Discard
                      </button>
                    </div>
                  )}
                  {draft.status !== 'pending' && (
                    <span style={{
                      ...chipStyle,
                      backgroundColor: draft.status === 'sent' ? 'var(--color-green-light)' : 'var(--color-bg-highest)',
                      color: draft.status === 'sent' ? 'var(--color-green)' : 'var(--color-text-muted)',
                    }}>
                      {draft.status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Draft Editor Modal ── */}
        {selectedDraft && (
          <div style={modalOverlayStyle} onClick={closeDraft}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0, marginBottom: 16, color: 'var(--color-text-primary)' }}>
                Edit Draft
              </h2>

              {/* Signals panel */}
              <div style={signalsPanelStyle}>
                <strong>Signals used:</strong>
                <div style={{ marginTop: 6 }}>
                  {selectedDraft.signals && Object.entries(selectedDraft.signals).map(([key, val]) => {
                    if (val === null || val === undefined || (Array.isArray(val) && val.length === 0)) return null;
                    const display = Array.isArray(val) ? JSON.stringify(val) : String(val);
                    return (
                      <div key={key} style={{ marginBottom: 2 }}>
                        <strong>{key}:</strong> {display}
                      </div>
                    );
                  })}
                </div>
              </div>

              <label style={labelStyle}>Title</label>
              <input
                style={inputStyle}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />

              <label style={labelStyle}>Body</label>
              <textarea
                style={textareaStyle}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
              />

              <div style={{ ...actionsRowStyle, marginTop: 16, justifyContent: 'flex-end' }}>
                <button style={{ ...discardBtnStyle, color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }} onClick={closeDraft}>
                  Cancel
                </button>
                {selectedDraft.status === 'pending' && (
                  <>
                    <button
                      style={{ ...discardBtnStyle }}
                      onClick={() => handleDiscard(selectedDraft.id)}
                    >
                      Discard
                    </button>
                    <button
                      style={sendBtnStyle}
                      className="btn-primary"
                      disabled={sending}
                      onClick={handleApproveAndSend}
                    >
                      {sending ? 'Sending...' : 'Approve & Send'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
