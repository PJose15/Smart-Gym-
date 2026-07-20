import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type ExpoReceiptOk = { status: 'ok' };
type ExpoReceiptError = {
  status: 'error';
  message: string;
  details?: { error?: string };
};
type ExpoReceipt = ExpoReceiptOk | ExpoReceiptError;
type ExpoReceiptsResponse = { data: Record<string, ExpoReceipt> };

/**
 * POST /api/cron/receipt-poll
 *
 * Polls Expo push receipt API for notification_log rows with status='sent'
 * that have an expo_receipt_id set. Updates log rows to 'delivered' or 'failed'
 * based on receipt outcome. On DeviceNotRegistered errors, deactivates the
 * corresponding device_tokens row(s) so uninstalled devices stop receiving sends.
 *
 * Scheduled by migration 031: pg_cron 'nexera-receipt-poll' every 15 minutes.
 *
 * Auth: dual-header pattern — accepts both:
 *   x-smartgym-internal-key: <SMARTGYM_INTERNAL_KEY>
 *   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Query window: created_at > 24h ago AND created_at < 30 min ago.
 *   - Floor of 30 min avoids polling Expo too soon after ticket creation.
 *   - Backed by idx_notification_log_receipt_pending (migration 031).
 *
 * DeviceNotRegistered deactivation: deactivates all active device_tokens for
 * the row's profile_id. Single-device MVP tradeoff — receipt doesn't reliably
 * echo the specific push token, so all active tokens for the profile are
 * deactivated. Multi-device targeting is a post-launch improvement.
 */
export async function POST(request: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const internalKey = process.env.SMARTGYM_INTERNAL_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const providedKey =
      request.headers.get('x-smartgym-internal-key') ??
      request.headers.get('authorization')?.replace('Bearer ', '') ??
      null;

    const isValidKey =
      (internalKey && providedKey === internalKey) ||
      (serviceRoleKey && providedKey === serviceRoleKey);

    if (!isValidKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();

    // ── Query pending receipts ────────────────────────────────────────────────
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    // Selects rows with status='sent', expo_receipt_id IS NOT NULL,
    // created_at within last 24h but older than 30 minutes (Expo polling floor).
    // Uses idx_notification_log_receipt_pending (migration 031).
    const { data: pendingRows, error: selectError } = await admin
      .from('notification_log')
      .select('id, expo_receipt_id, profile_id')
      .eq('status', 'sent')
      .not('expo_receipt_id', 'is', null)
      .gt('created_at', twentyFourHoursAgo)
      .lt('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: true })
      .limit(100);

    if (selectError) {
      console.error('[receipt-poll] Select error:', selectError.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const rows = pendingRows ?? [];

    if (rows.length === 0) {
      return NextResponse.json({ polled: 0, delivered: 0, failed: 0, tokens_deactivated: 0 });
    }

    // ── Call Expo getReceipts ─────────────────────────────────────────────────
    const receiptIds = rows.map(r => r.expo_receipt_id as string);

    const expoRes = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: receiptIds }),
      signal: AbortSignal.timeout(10_000),
    });

    const expoJson = (await expoRes.json()) as ExpoReceiptsResponse;
    const receipts = expoJson.data ?? {};

    // ── Process each receipt ──────────────────────────────────────────────────
    let delivered = 0;
    let failed = 0;
    let tokens_deactivated = 0;

    for (const row of rows) {
      const receiptId = row.expo_receipt_id as string;
      const receipt = receipts[receiptId];

      // Receipt ID absent from Expo response → still pending; leave row untouched
      if (!receipt) continue;

      if (receipt.status === 'ok') {
        await admin
          .from('notification_log')
          .update({ status: 'delivered' })
          .eq('id', row.id);
        delivered++;
      } else {
        // status === 'error'
        await admin
          .from('notification_log')
          .update({ status: 'failed' })
          .eq('id', row.id);
        failed++;

        // DeviceNotRegistered: deactivate all active tokens for this profile.
        // Single-device MVP: the receipt doesn't reliably echo the specific push
        // token, so all active tokens for the profile are deactivated.
        // See 06-RESEARCH.md Pitfall 5 for tradeoff rationale.
        if ((receipt as ExpoReceiptError).details?.error === 'DeviceNotRegistered') {
          await admin
            .from('device_tokens')
            .update({ active: false })
            .eq('profile_id', row.profile_id)
            .eq('active', true);
          tokens_deactivated++;
        }
      }
    }

    return NextResponse.json({
      polled: rows.length,
      delivered,
      failed,
      tokens_deactivated,
    });
  } catch (err) {
    console.error('[receipt-poll] Error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
