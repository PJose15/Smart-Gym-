/**
 * Edge Function: POST /trainer-copilot/discard
 * Body: { draft_id }
 *
 * Discards a coach note draft.
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

    const { draft_id } = await req.json();
    if (!draft_id) {
      return new Response(JSON.stringify({ error: 'draft_id is required' }), { status: 400 });
    }

    // Fetch draft
    const { data: draft, error: draftError } = await serviceClient
      .from('coach_note_drafts')
      .select('id, trainer_profile_id, gym_id, status')
      .eq('id', draft_id)
      .single();

    if (draftError || !draft) {
      return new Response(JSON.stringify({ error: 'Draft not found' }), { status: 404 });
    }

    // Verify caller owns the draft
    if (draft.trainer_profile_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 });
    }

    // Already discarded or sent
    if (draft.status === 'discarded') {
      return new Response(JSON.stringify({ message: 'Already discarded', draft_id }), { status: 200 });
    }
    if (draft.status === 'sent') {
      return new Response(JSON.stringify({ error: 'Cannot discard a sent draft' }), { status: 400 });
    }

    // Update status
    await serviceClient
      .from('coach_note_drafts')
      .update({ status: 'discarded' })
      .eq('id', draft_id);

    // Log action
    await serviceClient.from('coach_note_actions').insert({
      gym_id: draft.gym_id,
      draft_id: draft.id,
      actor_profile_id: user.id,
      action: 'discarded',
      meta: null,
    });

    return new Response(JSON.stringify({ message: 'Draft discarded', draft_id }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
