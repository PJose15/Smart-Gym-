'use client';

import { useEffect, useState, FormEvent, CSSProperties } from 'react';
import type { TrainerNote, TrainerNoteType } from '@nexera/types';

const NOTE_TYPES: TrainerNoteType[] = ['general', 'form', 'injury', 'progress', 'program'];

const noteTypeColors: Record<string, string> = {
  general: 'var(--color-blue)',
  form: '#8B5CF6',
  injury: 'var(--color-red)',
  progress: 'var(--color-green)',
  program: '#EAB308',
};

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: 16,
  marginBottom: 10,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: 'var(--color-bg-base)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  color: 'var(--color-text-primary)',
  fontSize: 14,
  outline: 'none',
  resize: 'vertical',
  minHeight: 80,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const selectStyle: CSSProperties = {
  padding: '8px 12px',
  backgroundColor: 'var(--color-bg-base)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 6,
  color: 'var(--color-text-primary)',
  fontSize: 13,
  outline: 'none',
};

const btnStyle: CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'var(--color-blue)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

export function MemberNotesTab({ memberId }: { memberId: string }) {
  const [notes, setNotes] = useState<TrainerNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<TrainerNoteType>('general');
  const [visibleToMember, setVisibleToMember] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    loadNotes();
  // eslint-disable-next-line
  }, [memberId]);

  async function loadNotes() {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch(`/api/trainer/members/${memberId}/notes`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setNotes(Array.isArray(d) ? d : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/trainer/members/${memberId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          note_type: noteType,
          note_text: noteText.trim(),
          is_visible_to_member: visibleToMember,
        }),
      });

      if (res.ok) {
        setNoteText('');
        setNoteType('general');
        setVisibleToMember(false);
        loadNotes();
      } else {
        setActionError(`Failed to create note (HTTP ${res.status})`);
      }
    } catch {
      setActionError('Network error creating note');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(noteId: string) {
    if (!editText.trim()) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/trainer/members/${memberId}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: editText.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        loadNotes();
      } else {
        setActionError(`Failed to update note (HTTP ${res.status})`);
      }
    } catch {
      setActionError('Network error updating note');
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm('Delete this note?')) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/trainer/members/${memberId}/notes/${noteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadNotes();
      } else {
        setActionError(`Failed to delete note (HTTP ${res.status})`);
      }
    } catch {
      setActionError('Network error deleting note');
    }
  }

  const errorBannerStyle: CSSProperties = {
    backgroundColor: 'var(--color-red-light)',
    color: 'var(--color-red)',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 12,
  };

  return (
    <div>
      {actionError && <div style={errorBannerStyle}>{actionError}</div>}

      {/* Create Note Form */}
      <form onSubmit={handleCreate} style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
          <select value={noteType} onChange={(e) => setNoteType(e.target.value as TrainerNoteType)} style={selectStyle}>
            {NOTE_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={visibleToMember}
              onChange={(e) => setVisibleToMember(e.target.checked)}
            />
            Visible to member
          </label>
        </div>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Write a note..."
          style={inputStyle}
        />
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <button type="submit" disabled={saving || !noteText.trim()} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </form>

      {/* Notes List */}
      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading notes...</p>
      ) : loadError ? (
        <div style={errorBannerStyle}>
          Failed to load notes: {loadError}
          <button
            onClick={() => loadNotes()}
            style={{ marginLeft: 12, background: 'none', border: 'none', color: 'var(--color-red)', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}
          >
            Retry
          </button>
        </div>
      ) : notes.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No notes yet.</p>
      ) : (
        notes.map((note) => (
          <div key={note.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: (noteTypeColors[note.note_type] ?? 'var(--color-blue)') + '22',
                  color: noteTypeColors[note.note_type] ?? 'var(--color-blue)',
                }}>
                  {note.note_type}
                </span>
                {note.is_visible_to_member && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Visible to member</span>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {new Date(note.created_at).toLocaleString()}
              </span>
            </div>

            {editingId === note.id ? (
              <div>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={() => handleUpdate(note.id)} style={btnStyle}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{ ...btnStyle, backgroundColor: 'var(--color-bg-elevated)' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{note.note_text}</p>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setEditingId(note.id); setEditText(note.note_text); }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-blue)', fontSize: 12, cursor: 'pointer', padding: 0 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-red)', fontSize: 12, cursor: 'pointer', padding: 0 }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
