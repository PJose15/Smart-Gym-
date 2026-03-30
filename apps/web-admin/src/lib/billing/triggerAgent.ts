/**
 * Triggers an UptimizeAI agent via the internal webhook endpoint.
 * Used by the Stripe webhook handler and other server-side code.
 */
export async function triggerUptimizeAIAgent(
  agentName: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const key = process.env.INTERNAL_WEBHOOK_KEY;
  if (!key) {
    console.warn('[triggerAgent] INTERNAL_WEBHOOK_KEY not set, skipping agent trigger');
    return { success: false, error: 'Internal webhook key not configured' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const res = await fetch(`${appUrl}/api/agents/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-smartgym-internal-key': key,
      },
      body: JSON.stringify({ agent_name: agentName, payload }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error || `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error('[triggerAgent] Error:', err);
    return { success: false, error: String(err) };
  }
}
