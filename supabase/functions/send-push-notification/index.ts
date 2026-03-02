/**
 * Edge Function: POST /send-push-notification
 * Body: { profile_id, type, title, body, data? }
 *
 * Sends a push notification to a user via the Expo Push API.
 * Checks notification_preferences before sending.
 * Logs all attempts to notification_log.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushRequest {
  profile_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { profile_id, type, title, body, data } =
      (await req.json()) as PushRequest;

    if (!profile_id || !type || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Check if user has notifications enabled (default: enabled)
    const { data: prefs } = await serviceClient
      .from('notification_preferences')
      .select('enabled')
      .eq('profile_id', profile_id)
      .maybeSingle();

    if (prefs && prefs.enabled === false) {
      return new Response(
        JSON.stringify({ message: 'Notifications disabled by user' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Get active push tokens for the user
    const { data: tokens, error: tokensErr } = await serviceClient
      .from('device_tokens')
      .select('expo_push_token')
      .eq('profile_id', profile_id)
      .eq('active', true);

    if (tokensErr || !tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active tokens' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Build Expo push messages
    const messages = tokens.map(
      (t: { expo_push_token: string }) => ({
        to: t.expo_push_token,
        sound: 'default' as const,
        title,
        body,
        data: { type, ...data },
      }),
    );

    // Send via Expo Push API
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const pushResult = await pushResponse.json();

    // Log notification
    await serviceClient.from('notification_log').insert({
      profile_id,
      type,
      title,
      body,
      data: data ?? {},
      status: pushResponse.ok ? 'sent' : 'failed',
      expo_receipt_id: pushResult?.data?.[0]?.id ?? null,
    });

    return new Response(
      JSON.stringify({
        sent: tokens.length,
        status: pushResponse.ok ? 'sent' : 'failed',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
