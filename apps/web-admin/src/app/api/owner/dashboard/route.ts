import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import type { OwnerDashboardMetrics, MachinePerformance, PeakHourCell } from '@nexera/types';

export async function GET() {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const weekAgoDate = weekAgo.toISOString().slice(0, 10);
    const twoWeeksAgoDate = twoWeeksAgo.toISOString().slice(0, 10);
    const monthAgoDate = monthAgo.toISOString().slice(0, 10);

    // Parallel queries
    const [
      membersRes,
      activeMembersRes,
      workoutsThisWeekRes,
      workoutsLastWeekRes,
      machinesRes,
      maintenanceRes,
      machineUsageRes,
      peakHoursRes,
    ] = await Promise.all([
      admin.from('members').select('id', { count: 'exact', head: true }).eq('gym_id', gym_id),
      admin.from('workout_sessions').select('member_id').eq('gym_id', gym_id).gte('session_date', weekAgoDate),
      admin.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('gym_id', gym_id).gte('session_date', weekAgoDate),
      admin.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('gym_id', gym_id).gte('session_date', twoWeeksAgoDate).lt('session_date', weekAgoDate),
      admin.from('machines').select('id', { count: 'exact', head: true }).eq('gym_id', gym_id),
      admin.from('machines').select('id', { count: 'exact', head: true }).eq('gym_id', gym_id).eq('maintenance_status', 'in_maintenance'),
      // Machine usage this week — workout_sessions has machine_id directly
      admin
        .from('workout_sessions')
        .select('machine_id, member_id, machines!inner(name, equipment_type)')
        .eq('gym_id', gym_id)
        .gte('session_date', weekAgoDate)
        .not('machine_id', 'is', null)
        .limit(1000),
      // Peak hours (last 30 days) — use created_at for hour-of-day
      admin
        .from('workout_sessions')
        .select('created_at')
        .eq('gym_id', gym_id)
        .gte('session_date', monthAgoDate)
        .limit(5000),
    ]);

    // Active members (unique)
    const uniqueActiveMembers = new Set((activeMembersRes.data ?? []).map((r) => r.member_id));

    // Workouts change %
    const thisWeekCount = workoutsThisWeekRes.count ?? 0;
    const lastWeekCount = workoutsLastWeekRes.count ?? 0;
    const changePct = lastWeekCount > 0
      ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
      : 0;

    const metrics: OwnerDashboardMetrics = {
      total_members: membersRes.count ?? 0,
      active_members_7d: uniqueActiveMembers.size,
      workouts_this_week: thisWeekCount,
      workouts_change_pct: changePct,
      total_machines: machinesRes.count ?? 0,
      machines_needing_maintenance: maintenanceRes.count ?? 0,
      // Revenue tracking deferred until Stripe integration
    };

    // Machine performance aggregation
    const machineMap = new Map<string, { name: string; type: string; sessions: number; users: Set<string> }>();
    (machineUsageRes.data ?? []).forEach((s) => {
      const machine = s.machines as unknown as { name: string; equipment_type: string };
      const existing = machineMap.get(s.machine_id);
      if (existing) {
        existing.sessions++;
        existing.users.add(s.member_id);
      } else {
        machineMap.set(s.machine_id, {
          name: machine.name,
          type: machine.equipment_type,
          sessions: 1,
          users: new Set([s.member_id]),
        });
      }
    });

    const machine_performance: MachinePerformance[] = [...machineMap.entries()]
      .map(([id, m]) => ({
        machine_id: id,
        machine_name: m.name,
        equipment_type: m.type,
        sessions_7d: m.sessions,
        unique_users_7d: m.users.size,
      }))
      .sort((a, b) => b.sessions_7d - a.sessions_7d)
      .slice(0, 15);

    // Peak hours aggregation
    const hourMap = new Map<string, number>();
    (peakHoursRes.data ?? []).forEach((s) => {
      const d = new Date(s.created_at);
      const key = `${d.getDay()}-${d.getHours()}`;
      hourMap.set(key, (hourMap.get(key) ?? 0) + 1);
    });

    const peak_hours: PeakHourCell[] = [...hourMap.entries()].map(([key, count]) => {
      const [dow, hour] = key.split('-').map(Number);
      return { day_of_week: dow, hour, count };
    });

    return NextResponse.json({ metrics, machine_performance, peak_hours });
  } catch (err) {
    console.error('[owner/dashboard] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
