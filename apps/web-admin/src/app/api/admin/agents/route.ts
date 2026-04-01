import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';

export async function GET() {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  try {
    const { admin } = result;

    const twentyFourHoursAgo = new Date(Date.now() - 86400000).toISOString();

    const [configsRes, actionsRes] = await Promise.all([
      admin
        .from('gym_agent_config')
        .select('agent_id, enabled, fire_count, last_fired_at'),
      admin
        .from('admin_actions_log')
        .select('action_type, target_type, details, created_at')
        .ilike('action_type', 'agent%')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    // Aggregate by agent_id
    const agentMap: Record<string, {
      total_configs: number;
      enabled_count: number;
      total_fires: number;
      last_fired_at: string | null;
    }> = {};

    for (const row of configsRes.data ?? []) {
      const id = row.agent_id;
      if (!agentMap[id]) {
        agentMap[id] = { total_configs: 0, enabled_count: 0, total_fires: 0, last_fired_at: null };
      }
      agentMap[id].total_configs += 1;
      if (row.enabled) agentMap[id].enabled_count += 1;
      agentMap[id].total_fires += Number(row.fire_count ?? 0);
      if (row.last_fired_at) {
        if (!agentMap[id].last_fired_at || row.last_fired_at > agentMap[id].last_fired_at!) {
          agentMap[id].last_fired_at = row.last_fired_at;
        }
      }
    }

    const agents = Object.entries(agentMap).map(([agent_id, data]) => ({
      agent_id,
      ...data,
    }));

    const totalConfigs = agents.reduce((s, a) => s + a.total_configs, 0);
    const totalEnabled = agents.reduce((s, a) => s + a.enabled_count, 0);
    const totalFires = agents.reduce((s, a) => s + a.total_fires, 0);
    const lastFired = agents.reduce<string | null>((latest, a) => {
      if (!a.last_fired_at) return latest;
      return !latest || a.last_fired_at > latest ? a.last_fired_at : latest;
    }, null);

    return NextResponse.json({
      summary: {
        total_configs: totalConfigs,
        total_enabled: totalEnabled,
        total_fires: totalFires,
        last_fired_at: lastFired,
      },
      agents,
      recent_actions: actionsRes.data ?? [],
    });
  } catch (err) {
    console.error('[/api/admin/agents] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
