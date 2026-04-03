import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';

export async function GET(req: NextRequest) {
  try {
    const result = await verifySuperAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    const url = req.nextUrl.searchParams;
    const search = url.get('search') || '';
    const role = url.get('role');
    const limit = Math.min(Number(url.get('limit')) || 50, 200);
    const offset = Number(url.get('offset')) || 0;

    let query = admin
      .from('users')
      .select(
        'id, email, display_name, platform_role, created_at, gym_memberships(gym_id, role, status)'
      )
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (search)
      query = query.or(
        `email.ilike.%${search}%,display_name.ilike.%${search}%`
      );
    if (role) query = query.eq('platform_role', role);

    const { data, error } = await query;
    if (error)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    return NextResponse.json({ users: data ?? [], limit, offset });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
