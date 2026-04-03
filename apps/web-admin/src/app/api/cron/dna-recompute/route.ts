import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { invalidateAndRefreshDNA } from '@/lib/dna/dnaCache';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/cron/dna-recompute
 * Called every Sunday at 4:30am UTC by pg_cron.
 * Recomputes DNA + creates weekly snapshots for all active members.
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

    // Accept both x-smartgym-internal-key header and Authorization: Bearer
    // (pg_cron sends Authorization header)
    const providedKey =
      request.headers.get('x-smartgym-internal-key') ??
      request.headers.get('authorization')?.replace('Bearer ', '') ??
      null;
    if (providedKey !== internalKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();

    // Get all active members with their gym
    const { data: members } = await admin
      .from('members')
      .select('id, gym_id')
      .eq('status', 'active');

    if (!members || members.length === 0) {
      return NextResponse.json({ recomputed: 0 });
    }

    let recomputed = 0;
    let errors = 0;

    // Process in batches of 10 with Promise.allSettled to prevent timeout
    for (let i = 0; i < members.length; i += 10) {
      const batch = members.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(member => invalidateAndRefreshDNA(member.id, member.gym_id, admin))
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          recomputed++;
        } else {
          errors++;
          console.error(
            `[dna-recompute] Error for member ${batch[j].id}:`,
            (results[j] as PromiseRejectedResult).reason
          );
        }
      }
    }

    return NextResponse.json({ recomputed, errors, total: members.length });
  } catch (err) {
    console.error('[dna-recompute] Error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
