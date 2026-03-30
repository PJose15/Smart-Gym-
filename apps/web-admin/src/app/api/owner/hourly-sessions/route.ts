import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';

export async function GET() {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;

    // Start of today (UTC) — session_date is stored as DATE (YYYY-MM-DD)
    const now = new Date();
    const todayUTC = now.toISOString().slice(0, 10);

    const { data, error } = await admin
      .from('workout_sessions')
      .select('created_at')
      .eq('gym_id', gym_id)
      .eq('session_date', todayUTC)
      .limit(5000);

    if (error) throw error;

    // Aggregate by hour
    const hourly: Record<number, number> = {};
    (data ?? []).forEach((s) => {
      const hour = new Date(s.created_at).getHours();
      hourly[hour] = (hourly[hour] ?? 0) + 1;
    });

    return NextResponse.json(hourly);
  } catch (err) {
    console.error('[owner/hourly-sessions] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
