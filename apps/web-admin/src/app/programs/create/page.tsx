'use client';

import { useEffect, useState, FormEvent, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Gym } from '@smartgym/types';
import { AnimatedPage } from '../../components/AnimatedPage';

export default function CreateProgramPage() {
  const router = useRouter();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gymId, setGymId] = useState('');

  // Data state
  const [gyms, setGyms] = useState<Pick<Gym, 'id' | 'name'>[]>([]);
  const [loadingGyms, setLoadingGyms] = useState(true);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGyms() {
      setLoadingGyms(true);
      const { data, error: fetchError } = await supabase
        .from('gyms')
        .select('id, name')
        .order('name');

      if (fetchError) {
        setError(fetchError.message);
      } else {
        const gymList = (data as Pick<Gym, 'id' | 'name'>[]) ?? [];
        setGyms(gymList);
        // Auto-select the first gym for MVP
        if (gymList.length > 0) {
          setGymId(gymList[0].id);
        }
      }
      setLoadingGyms(false);
    }
    fetchGyms();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !gymId) return;

    setSubmitting(true);
    setError(null);

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError(authError?.message ?? 'You must be logged in to create a program.');
      setSubmitting(false);
      return;
    }

    // Insert program
    const { data, error: insertError } = await supabase
      .from('programs')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        gym_id: gymId,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    // Redirect to the new program's detail page
    router.push(`/programs/${data.id}`);
  }

  return (
    <AnimatedPage>
    <div>
      {/* Back link */}
      <Link href="/programs" style={backLinkStyle}>
        &larr; Back to Programs
      </Link>

      {/* Page header */}
      <h1 style={titleStyle}>Create Program</h1>
      <p style={subtitleStyle}>
        Set up a new workout program. You can add days and exercises after
        creating it.
      </p>

      {/* Form card */}
      <div style={cardStyle}>
        {error && (
          <div style={errorBannerStyle} className="error-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Program Name */}
          <div style={fieldGroupStyle}>
            <label htmlFor="program-name" style={labelStyle}>
              Program Name <span style={{ color: '#e53935' }}>*</span>
            </label>
            <input
              id="program-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beginner Full Body"
              required
              style={inputStyle}
              className="input-animate"
            />
          </div>

          {/* Description */}
          <div style={fieldGroupStyle}>
            <label htmlFor="program-description" style={labelStyle}>
              Description
            </label>
            <textarea
              id="program-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of the program goals, target audience, etc."
              rows={4}
              style={textareaStyle}
              className="input-animate"
            />
          </div>

          {/* Gym Selector */}
          <div style={fieldGroupStyle}>
            <label htmlFor="program-gym" style={labelStyle}>
              Gym <span style={{ color: '#e53935' }}>*</span>
            </label>
            {loadingGyms ? (
              <p style={{ color: '#999', fontSize: 14, margin: 0 }}>
                Loading gyms...
              </p>
            ) : gyms.length === 0 ? (
              <p style={{ color: '#e53935', fontSize: 14, margin: 0 }}>
                No gyms found. Please create a gym first.
              </p>
            ) : (
              <select
                id="program-gym"
                value={gymId}
                onChange={(e) => setGymId(e.target.value)}
                required
                style={inputStyle}
                className="input-animate"
              >
                {gyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Submit */}
          <div style={buttonRowStyle}>
            <Link href="/programs" style={cancelButtonStyle} className="btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !gymId}
              className="btn-primary"
              style={{
                ...submitButtonStyle,
                opacity: submitting || !name.trim() || !gymId ? 0.6 : 1,
                cursor:
                  submitting || !name.trim() || !gymId
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {submitting ? 'Creating...' : 'Create Program'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </AnimatedPage>
  );
}

/* -- Styles --------------------------------------------------------- */

const backLinkStyle: CSSProperties = {
  display: 'inline-block',
  marginBottom: 20,
  color: '#4fc3f7',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
};

const titleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  marginTop: 0,
  marginBottom: 8,
  color: '#1a1a2e',
};

const subtitleStyle: CSSProperties = {
  color: '#666',
  marginTop: 0,
  marginBottom: 24,
  fontSize: 15,
};

const cardStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 8,
  padding: 32,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  maxWidth: 560,
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: '#fdecea',
  color: '#611a15',
  padding: '12px 16px',
  borderRadius: 6,
  fontSize: 14,
  marginBottom: 20,
  border: '1px solid #f5c6cb',
};

const fieldGroupStyle: CSSProperties = {
  marginBottom: 20,
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: '#1a1a2e',
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  resize: 'vertical',
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
  marginTop: 28,
};

const cancelButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '10px 20px',
  backgroundColor: '#f0f0f0',
  color: '#333',
  borderRadius: 6,
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
};

const submitButtonStyle: CSSProperties = {
  padding: '10px 24px',
  backgroundColor: '#4361ee',
  color: '#ffffff',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
};
