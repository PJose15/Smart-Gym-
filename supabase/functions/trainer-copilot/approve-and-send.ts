/**
 * Edge Function: POST /trainer-copilot/approve-and-send
 * Body: { draft_id, edited_title?, edited_body? }
 *
 * Approves a draft, creates a coach_notes row, and logs actions.
 * Idempotent: will not send twice.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { draft_id, edited_title, edited_body } = await req.json();
    if (!draft_id) {
      return new Response(JSON.stringify({ error: 'draft_id is required' }), { status: 400 });
    }

    // Fetch draft
    const { data: draft, error: draftError } = await serviceClient
      .from('coach_note_drafts')
      .select('*')
      .eq('id', draft_id)
      .single();

    if (draftError || !draft) {
      return new Response(JSON.stringify({ error: 'Draft not found' }), { status: 404 });
    }

    // Verify caller owns the draft
    if (draft.trainer_profile_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized to send this draft' }), { status: 403 });
    }

    // Idempotency: prevent double-send
    if (draft.status === 'sent') {
      return new Response(JSON.stringify({
        message: 'Draft already sent',
        draft_id: draft.id,
        status: 'sent',
      }), { status: 200 });
    }

    if (draft.status === 'discarded') {
      return new Response(JSON.stringify({ error: 'Cannot send a discarded draft' }), { status: 400 });
    }

    const finalTitle = edited_title ?? draft.draft_title;
    const finalBody = edited_body ?? draft.draft_body;
    const wasEdited = edited_title !== undefined || edited_body !== undefined;

    // Determine source from draft
    const source = draft.workout_id ? 'workout' : (draft.period_start ? 'weekly' : 'manual');

    // Create coach note (sent to member)
    const { data: note, error: noteError } = await serviceClient
      .from('coach_notes')
      .insert({
        gym_id: draft.gym_id,
        trainer_profile_id: draft.trainer_profile_id,
        member_profile_id: draft.member_profile_id,
        source,
        status: 'sent',
        title: finalTitle,
        body: finalBody,
        meta: draft.signals,
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (noteError) {
      return new Response(JSON.stringify({ error: noteError.message }), { status: 500 });
    }

    // Update draft status to sent
    await serviceClient
      .from('coach_note_drafts')
      .update({
        status: 'sent',
        draft_title: finalTitle,
        draft_body: finalBody,
      })
      .eq('id', draft_id);

    // Log actions
    const actions = [];

    if (wasEdited) {
      actions.push({
        gym_id: draft.gym_id,
        draft_id: draft.id,
        note_id: note.id,
        actor_profile_id: user.id,
        action: 'edited',
        meta: {
          title_changed: edited_title !== undefined,
          body_changed: edited_body !== undefined,
        },
      });
    }

    actions.push({
      gym_id: draft.gym_id,
      draft_id: draft.id,
      note_id: note.id,
      actor_profile_id: user.id,
      action: 'approved',
      meta: null,
    });

    actions.push({
      gym_id: draft.gym_id,
      draft_id: draft.id,
      note_id: note.id,
      actor_profile_id: user.id,
      action: 'sent',
      meta: null,
    });

    await serviceClient.from('coach_note_actions').insert(actions);

    return new Response(JSON.stringify({
      note_id: note.id,
      draft_id: draft.id,
      message: 'Note sent to member',
    }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
