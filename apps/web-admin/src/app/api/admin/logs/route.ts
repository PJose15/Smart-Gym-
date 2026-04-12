import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';

export async function GET(req: NextRequest) {
  try {
    const result = await verifySuperAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    const url = req.nextUrl.searchParams;
    const agent_name = url.get('agent_name');
    const gym_id = url.get('gym_id');
    const status = url.get('status');
    const limit = Math.min(Number(url.get('limit')) || 50, 200);
    const offset = Number(url.get('offset')) || 0;

    let query = admin
      .from('smartgym_agent_logs')
      .select('id, gym_id, member_id, agent_name, trigger_event, action_taken, channel, status, error_message, payload, executed_at')
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (agent_name) query = query.eq('agent_name', agent_name);
    if (gym_id) query = query.eq('gym_id', gym_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error)
      return NextResponse.json(
        { error: 'Failed to fetch logs' },
        { status: 500 }
      );
    return NextResponse.json({ logs: data ?? [], limit, offset });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
