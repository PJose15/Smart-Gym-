import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';

export async function GET() {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  try {
    const { admin } = result;

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 86400000).toISOString();
    const today = now.toISOString().slice(0, 10);

    const dbStart = Date.now();
    const [
      dbCheck,
      apiPerfRes,
      sessionsRes,
      errorsRes,
      notifSentRes,
      notifDeliveredRes,
      notifFailedRes,
    ] = await Promise.all([
      admin.from('gyms').select('id', { count: 'exact', head: true }).limit(1),
      admin
        .from('api_performance_log')
        .select('endpoint, response_time_ms')
        .gte('occurred_at', oneHourAgo),
      admin
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .gte('session_date', today),
      admin
        .from('error_log')
        .select('id', { count: 'exact', head: true })
        .eq('resolved', false)
        .gte('occurred_at', twentyFourHoursAgo),
      // Notification delivery metrics (24h window).
      // 'sent' = ticket accepted but receipt not yet polled (pending).
      // delivery_rate is computed over resolved receipts only (delivered / (delivered + failed)).
      admin
        .from('notification_log')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('created_at', twentyFourHoursAgo),
      admin
        .from('notification_log')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'delivered')
        .gte('created_at', twentyFourHoursAgo),
      admin
        .from('notification_log')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', twentyFourHoursAgo),
    ]);
    const dbLatencyMs = Date.now() - dbStart;

    const dbHealthy = !dbCheck.error;
    const unresolvedErrors = errorsRes.count ?? 0;

    // Compute status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (!dbHealthy) status = 'critical';
    else if (unresolvedErrors > 50) status = 'critical';
    else if (unresolvedErrors > 10 || dbLatencyMs > 2000) status = 'degraded';

    // Group API performance by endpoint
    const perfByEndpoint: Record<string, { total: number; count: number }> = {};
    for (const row of apiPerfRes.data ?? []) {
      const ep = row.endpoint ?? 'unknown';
      if (!perfByEndpoint[ep]) perfByEndpoint[ep] = { total: 0, count: 0 };
      perfByEndpoint[ep].total += Number(row.response_time_ms);
      perfByEndpoint[ep].count += 1;
    }

    const apiPerformance = Object.entries(perfByEndpoint).map(([endpoint, v]) => ({
      endpoint,
      avg_ms: Math.round(v.total / v.count),
      request_count: v.count,
    }));

    // Compute push delivery rate over resolved receipts only.
    // 'sent' count = tickets accepted but not yet polled (pending resolution).
    // delivery_rate is over resolved receipts only (delivered / (delivered + failed)).
    const sent24h = notifSentRes.count ?? 0;
    const delivered24h = notifDeliveredRes.count ?? 0;
    const failed24h = notifFailedRes.count ?? 0;
    const resolvedDenominator = delivered24h + failed24h;
    const deliveryRate =
      resolvedDenominator > 0
        ? Math.round((delivered24h / resolvedDenominator) * 1000) / 1000
        : null;

    return NextResponse.json({
      status,
      db_healthy: dbHealthy,
      db_latency_ms: dbLatencyMs,
      sessions_today: sessionsRes.count ?? 0,
      unresolved_errors_24h: unresolvedErrors,
      api_performance: apiPerformance,
      notifications: {
        sent_24h: sent24h,
        delivered_24h: delivered24h,
        failed_24h: failed24h,
        delivery_rate: deliveryRate,
      },
    });
  } catch (err) {
    console.error('[/api/admin/health] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
