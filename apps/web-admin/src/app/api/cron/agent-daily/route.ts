import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { triggerUptimizeAIAgent } from '@/lib/billing/triggerAgent';
import { resolveOwnerProfileId, sendNotification } from '@/lib/notifications/dispatcher';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/cron/agent-daily
 * Called daily at 06:00 UTC by pg_cron (see migration 029 cron.schedule 'nexera-agent-daily').
 *
 * Runs 4 scans:
 *  1. Dormant members  — members.last_session_date > 14d ago → retention-agent 'member-inactive-14d'
 *  2. Check-in SLA     — weekly_checkins pending trainer review past 48h → operations-agent 'checkin-sla-overdue'
 *  3. Machine underuse — machines with zero scans in trailing 7d → operations-agent 'machine-underutilized'
 *  4. Challenge expiry — is_active challenges past end_date → deactivate + growth-agent 'challenge-ended'
 *
 * Auth: accepts BOTH x-smartgym-internal-key header and Authorization: Bearer <key>
 * (pg_cron sends Authorization: Bearer)
 *
 * Batches of 10 via Promise.allSettled to prevent serverless timeout.
 * Per-target cooldowns are enforced downstream by /api/agents/trigger — re-running the cron
 * never double-fires within a cooldown window.
 */
export async function POST(request: Request) {
  try {
    const internalKey = process.env.INTERNAL_WEBHOOK_KEY;
    if (!internalKey) {
      return NextResponse.json(
        { error: 'Internal webhook key not configured' },
        { status: 500 }
      );
    }

    // Accept both header forms: x-smartgym-internal-key (internal calls) and
    // Authorization: Bearer (pg_cron pattern). pg_cron (migration 029) sends
    // the service-role key as the Bearer token, so accept either credential
    // (dual-header pattern — mirrors cron/receipt-poll).
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

    // ── Date helpers ────────────────────────────────────────────────────────────
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10); // DATE string: 'YYYY-MM-DD'
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayDateString = now.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    let dormant_triggered = 0;
    let checkins_triggered = 0;
    let machines_triggered = 0;
    let challenges_expired = 0;
    let pushes_dispatched = 0;

    // ── Scan 1: Dormant members (14d inactive) ──────────────────────────────────
    const { data: dormantMembers } = await admin
      .from('members')
      .select('id, gym_id')
      .eq('status', 'active')
      .lt('last_session_date', fourteenDaysAgo);

    if (dormantMembers && dormantMembers.length > 0) {
      for (let i = 0; i < dormantMembers.length; i += 10) {
        const batch = dormantMembers.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map(m =>
            triggerUptimizeAIAgent('retention-agent', {
              event: 'member-inactive-14d',
              gym_id: m.gym_id,
              member_id: m.id,
              is_agent_initiated: false,
            })
          )
        );
        dormant_triggered += results.filter(r => r.status === 'fulfilled').length;

        // Push: re-engagement alert per dormant member — fire-and-forget
        const pushResults = await Promise.allSettled(
          batch.map(m =>
            sendNotification({
              gym_id: m.gym_id,
              member_id: m.id,
              type: 'agent_dormant_alert',
              title: 'We miss you',
              body: 'It has been a while — your gym is ready when you are.',
              is_agent_initiated: true,
            })
          )
        );
        pushes_dispatched += pushResults.filter(r => r.status === 'fulfilled').length;
      }
    }

    // ── Scan 2: Check-in SLA overdue (48h without trainer review) ──────────────
    // Mirrors the checkin-deadline cron query: pending trainer review + no sent_at + past 48h
    const { data: overdueCheckins } = await admin
      .from('weekly_checkins')
      .select('id, member_id, gym_id')
      .eq('trainer_approved', false)
      .is('sent_at', null)
      .not('trainer_id', 'is', null)
      .lt('created_at', fortyEightHoursAgo);

    if (overdueCheckins && overdueCheckins.length > 0) {
      for (let i = 0; i < overdueCheckins.length; i += 10) {
        const batch = overdueCheckins.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map(c =>
            triggerUptimizeAIAgent('operations-agent', {
              event: 'checkin-sla-overdue',
              gym_id: c.gym_id,
              member_id: c.member_id,
              dedup_key: c.id,
              is_agent_initiated: false,
            })
          )
        );
        checkins_triggered += results.filter(r => r.status === 'fulfilled').length;
      }

      // Owner push: one per unique affected gym (dispatcher 5-min dedup absorbs multi-checkin gyms)
      const affectedGymIds = [...new Set<string>(overdueCheckins.map(c => c.gym_id))];
      const ownerPushResults = await Promise.allSettled(
        affectedGymIds.map(async gymId => {
          const ownerProfileId = await resolveOwnerProfileId(admin, gymId);
          if (!ownerProfileId) return;
          return sendNotification({
            gym_id: gymId,
            profile_id: ownerProfileId,
            type: 'checkin_overdue',
            title: 'Check-ins overdue',
            body: 'Some member check-ins are past their deadline.',
            is_agent_initiated: true,
          });
        })
      );
      pushes_dispatched += ownerPushResults.filter(r => r.status === 'fulfilled').length;
    }

    // ── Scan 3: Machine underutilization (zero scans in 7d) ─────────────────────
    // machines.is_active confirmed in migration 001 — filter active machines only
    const { data: allMachines } = await admin
      .from('machines')
      .select('id, gym_id')
      .eq('is_active', true);

    // Fetch machine_ids that had any scan in the last 7 days.
    // machine_scan_events: machine_id + scanned_at confirmed in migration 001.
    // Query is scoped to the gym of the machines we are processing (gym_id filter applied).
    // In-memory Set diff handles the underutilization check in O(n).
    //
    // For multi-gym installations the gym_id filter is applied once per unique gym.
    // We collect all scan events into a single Set across gyms before diffing.
    const gymIds = [...new Set<string>((allMachines ?? []).map(m => m.gym_id))];
    const allRecentScans: Array<{ machine_id: string }> = [];

    for (const gymId of gymIds) {
      const { data: gymScans } = await admin
        .from('machine_scan_events')
        .select('machine_id')
        .eq('gym_id', gymId)
        .gte('scanned_at', sevenDaysAgo);
      if (gymScans) allRecentScans.push(...gymScans);
    }

    // Build Set of recently-scanned machine ids for O(1) lookup
    const recentlyScannedIds = new Set<string>(allRecentScans.map(e => e.machine_id));

    const underutilizedMachines = (allMachines ?? []).filter(m => !recentlyScannedIds.has(m.id));

    if (underutilizedMachines.length > 0) {
      for (let i = 0; i < underutilizedMachines.length; i += 10) {
        const batch = underutilizedMachines.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map(m =>
            triggerUptimizeAIAgent('operations-agent', {
              event: 'machine-underutilized',
              gym_id: m.gym_id,
              machine_id: m.id,
              dedup_key: m.id,
              is_agent_initiated: false,
            })
          )
        );
        machines_triggered += results.filter(r => r.status === 'fulfilled').length;
      }

      // Owner push: one per unique underutilized gym (dispatcher 5-min dedup absorbs multi-machine gyms)
      const underutilizedGymIds = [...new Set<string>(underutilizedMachines.map(m => m.gym_id))];
      const machineOwnerResults = await Promise.allSettled(
        underutilizedGymIds.map(async gymId => {
          const ownerProfileId = await resolveOwnerProfileId(admin, gymId);
          if (!ownerProfileId) return;
          return sendNotification({
            gym_id: gymId,
            profile_id: ownerProfileId,
            type: 'machine_underutilized',
            title: 'Machine usage alert',
            body: 'A machine is seeing unusually low usage. See analytics.',
            is_agent_initiated: true,
          });
        })
      );
      pushes_dispatched += machineOwnerResults.filter(r => r.status === 'fulfilled').length;
    }

    // ── Scan 4: Challenge auto-expiry (end_date < today, still active) ──────────
    // end_date is a DATE column — compare against YYYY-MM-DD string
    // This handles Pitfall 6: challenges that expire by date without the owner clicking Complete
    // dedup_key matches the owner-complete path (05-03) — trigger route's 24h cooldown
    // on 'challenge-ended' guarantees once-per-challenge across both code paths
    const { data: expiredChallenges } = await admin
      .from('gym_challenges')
      .select('id, gym_id')
      .eq('is_active', true)
      .lt('end_date', todayDateString);

    if (expiredChallenges && expiredChallenges.length > 0) {
      for (let i = 0; i < expiredChallenges.length; i += 10) {
        const batch = expiredChallenges.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map(async c => {
            // Deactivate first, then fire agent
            await admin
              .from('gym_challenges')
              .update({ is_active: false })
              .eq('id', c.id);

            // Push: challenge_complete to each participant (fire-and-forget per participant)
            const { data: participants } = await admin
              .from('challenge_participants')
              .select('member_id')
              .eq('challenge_id', c.id);

            if (participants && participants.length > 0) {
              const participantResults = await Promise.allSettled(
                participants.map((p: { member_id: string }) =>
                  sendNotification({
                    gym_id: c.gym_id,
                    member_id: p.member_id,
                    type: 'challenge_complete',
                    title: 'Challenge finished',
                    body: 'A challenge you joined has ended — see the final leaderboard.',
                    data: { challenge_id: c.id },
                    is_agent_initiated: true,
                  })
                )
              );
              pushes_dispatched += participantResults.filter(r => r.status === 'fulfilled').length;
            }

            return triggerUptimizeAIAgent('growth-agent', {
              event: 'challenge-ended',
              gym_id: c.gym_id,
              challenge_id: c.id,
              dedup_key: c.id,
              auto_expired: true,
              is_agent_initiated: false,
            });
          })
        );
        challenges_expired += results.filter(r => r.status === 'fulfilled').length;
      }
    }

    return NextResponse.json({
      dormant_triggered,
      checkins_triggered,
      machines_triggered,
      challenges_expired,
      pushes_dispatched,
    });
  } catch (err) {
    console.error('[agent-daily] Error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
