import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { triggerUptimizeAIAgent } from '@/lib/billing/triggerAgent';
import { fetchGymAtRiskMembers } from '@/lib/agents/atRiskScan';
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
 * POST /api/cron/agent-weekly
 * Called every Sunday at 07:00 UTC by pg_cron (migration 029).
 *
 * Per non-cancelled gym:
 *  a. Count active members — skip gym entirely if 0 (no weekly-summary for empty gyms)
 *  b. Count completed sessions in last 7 days
 *  c. Fire operations-agent 'weekly-summary' with {gym_id, active_members, sessions_7d}
 *     6-day cooldown makes Sunday reruns idempotent while never blocking next week
 *  d. Early warning: fetchGymAtRiskMembers → fire retention-agent 'member-at-risk'
 *     per at-risk member — 7-day cooldown dedups against owner-route fires
 *
 * Auth: dual-header pattern (x-smartgym-internal-key OR Authorization: Bearer)
 * Batching: gyms processed in batches of 10 via Promise.allSettled — one gym
 * failing never aborts the remaining scans.
 *
 * Tier note: starter gyms' fires get tier-skipped by the trigger route and
 * logged 'skipped' — observable and correct (AGENT-05). The cron does not
 * pre-filter by tier.
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

    // Accept both header forms
    const providedKey =
      request.headers.get('x-smartgym-internal-key') ??
      request.headers.get('authorization')?.replace('Bearer ', '') ??
      null;
    if (providedKey !== internalKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all non-cancelled gyms
    const { data: gyms } = await admin
      .from('gyms')
      .select('id, name')
      .neq('subscription_status', 'cancelled');

    const gymList = gyms ?? [];

    let summaries_triggered = 0;
    let at_risk_triggered = 0;
    let gyms_scanned = 0;
    let pushes_dispatched = 0;

    // Process in batches of 10 with Promise.allSettled — one gym error never
    // aborts other gyms
    for (let i = 0; i < gymList.length; i += 10) {
      const batch = gymList.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (gym) => {
          // a. Count active members (head: true for count-only query)
          const { count: activeMemberCount } = await admin
            .from('members')
            .select('id', { head: true, count: 'exact' })
            .eq('gym_id', gym.id)
            .eq('status', 'active');

          const activeMembers = activeMemberCount ?? 0;

          // Skip gym entirely if no active members — no weekly-summary for empty gyms
          if (activeMembers === 0) return { summaries: 0, at_risk: 0, pushes: 0 };

          gyms_scanned++;

          // b. Count completed sessions last 7d
          const { count: sessionCount } = await admin
            .from('workout_sessions')
            .select('id', { head: true, count: 'exact' })
            .eq('gym_id', gym.id)
            .gte('created_at', sevenDaysAgo);

          const sessions7d = sessionCount ?? 0;

          // c. Fire operations-agent 'weekly-summary'
          await triggerUptimizeAIAgent('operations-agent', {
            event: 'weekly-summary',
            gym_id: gym.id,
            active_members: activeMembers,
            sessions_7d: sessions7d,
            is_agent_initiated: false,
          });

          // Owner push: weekly_summary — is_agent_initiated: true (agent cron output)
          let gymPushes = 0;
          const weeklySummaryOwnerProfileId = await resolveOwnerProfileId(admin, gym.id);
          if (weeklySummaryOwnerProfileId) {
            await sendNotification({
              gym_id: gym.id,
              profile_id: weeklySummaryOwnerProfileId,
              type: 'weekly_summary',
              title: 'Your weekly gym summary',
              body: 'Your weekly summary is ready — open your dashboard.',
              is_agent_initiated: true,
            }).catch(err => console.error('[agent-weekly] weekly_summary push failed:', err));
            gymPushes++;
          }

          // d. Early warning: at-risk member scan
          const atRiskMembers = await fetchGymAtRiskMembers(admin, gym.id);
          let gymAtRiskCount = 0;

          // Fire per at-risk member (same payload contract as owner/at-risk route)
          // 7-day cooldown in trigger route dedups against owner-route fires
          for (const m of atRiskMembers) {
            await triggerUptimizeAIAgent('retention-agent', {
              event: 'member-at-risk',
              gym_id: gym.id,
              member_id: m.profileId,
              is_agent_initiated: false,
            });
            gymAtRiskCount++;
          }

          // Owner push: member_at_risk — ONE per gym per run (no PII in title/body/data)
          if (atRiskMembers.length > 0) {
            const atRiskOwnerProfileId = weeklySummaryOwnerProfileId ?? await resolveOwnerProfileId(admin, gym.id);
            if (atRiskOwnerProfileId) {
              await sendNotification({
                gym_id: gym.id,
                profile_id: atRiskOwnerProfileId,
                type: 'member_at_risk',
                title: 'Members may be at risk',
                body: 'Some members show at-risk patterns. Review retention insights.',
                is_agent_initiated: true,
              }).catch(err => console.error('[agent-weekly] member_at_risk push failed:', err));
              gymPushes++;
            }
          }

          return { summaries: 1, at_risk: gymAtRiskCount, pushes: gymPushes };
        })
      );

      // Accumulate counters from settled results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          summaries_triggered += result.value.summaries;
          at_risk_triggered += result.value.at_risk;
          pushes_dispatched += result.value.pushes ?? 0;
        } else {
          console.error('[agent-weekly] Gym scan error:', result.reason);
        }
      }
    }

    return NextResponse.json({ summaries_triggered, at_risk_triggered, gyms_scanned, pushes_dispatched });
  } catch (err) {
    console.error('[agent-weekly] Error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
