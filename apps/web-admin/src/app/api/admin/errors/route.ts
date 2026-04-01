import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';

export async function GET(request: Request) {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  try {
    const { admin } = result;
    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get('status') ?? 'unresolved';
    const status = ['unresolved', 'resolved', 'all'].includes(statusParam) ? statusParam : 'unresolved';
    const env = searchParams.get('env') ?? 'all';
    const search = (searchParams.get('search') ?? '').slice(0, 256);
    const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? 50) || 50), 100);
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0);

    const twentyFourHoursAgo = new Date(Date.now() - 86400000).toISOString();

    // Build main query
    let query = admin
      .from('error_log')
      .select('id, error_code, error_message, stack_trace, context, gym_id, resolved, occurred_at, environment')
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === 'unresolved') query = query.eq('resolved', false);
    else if (status === 'resolved') query = query.eq('resolved', true);

    if (env !== 'all') query = query.eq('environment', env);

    if (search) {
      query = query.or(`error_code.ilike.%${search}%,error_message.ilike.%${search}%`);
    }

    // Summary queries
    const [errorsRes, unresolvedRes, resolvedRes, affectedGymsRes] = await Promise.all([
      query,
      admin
        .from('error_log')
        .select('id', { count: 'exact', head: true })
        .eq('resolved', false)
        .gte('occurred_at', twentyFourHoursAgo),
      admin
        .from('error_log')
        .select('id', { count: 'exact', head: true })
        .eq('resolved', true)
        .gte('occurred_at', twentyFourHoursAgo),
      admin
        .from('error_log')
        .select('gym_id')
        .eq('resolved', false)
        .gte('occurred_at', twentyFourHoursAgo)
        .not('gym_id', 'is', null),
    ]);

    const uniqueGyms = new Set((affectedGymsRes.data ?? []).map((r: { gym_id: string }) => r.gym_id));

    return NextResponse.json({
      errors: errorsRes.data ?? [],
      summary: {
        unresolved_24h: unresolvedRes.count ?? 0,
        resolved_24h: resolvedRes.count ?? 0,
        affected_gyms: uniqueGyms.size,
      },
    });
  } catch (err) {
    console.error('[/api/admin/errors] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
