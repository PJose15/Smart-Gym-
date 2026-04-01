import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';

export async function GET(request: Request) {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  try {
    const { admin } = result;
    const { searchParams } = new URL(request.url);

    const search = (searchParams.get('search') ?? '').slice(0, 256);
    const statusParam = searchParams.get('status') ?? 'all';
    const status = ['all', 'active', 'inactive', 'suspended'].includes(statusParam) ? statusParam : 'all';
    const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? 50) || 50), 100);
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0);

    let query = admin
      .from('members')
      .select('id, display_name, email, gym_id, status, last_session_date, created_at, score')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const [membersRes, gymsRes] = await Promise.all([
      query,
      admin.from('gyms').select('id, name'),
    ]);

    // Build gym name lookup
    const gymNames: Record<string, string> = {};
    for (const g of gymsRes.data ?? []) {
      gymNames[g.id] = g.name;
    }

    const members = (membersRes.data ?? []).map((m: {
      id: string; display_name: string; email: string; gym_id: string;
      status: string; last_session_date: string | null; created_at: string; score: number | null;
    }) => ({
      ...m,
      gym_name: gymNames[m.gym_id] ?? 'Unknown',
    }));

    return NextResponse.json({ members });
  } catch (err) {
    console.error('[/api/admin/members] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
