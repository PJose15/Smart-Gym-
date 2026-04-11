import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';
import { toggleFlag } from '@/lib/featureFlags';
import { PLATFORM_FLAG_KEYS, CRITICAL_FLAGS } from '@nexera/types';
import { checkRateLimit } from '@/lib/rateLimit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flagKey: string }> }
) {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  try {
    const { flagKey } = await params;

    if (!PLATFORM_FLAG_KEYS.includes(flagKey as (typeof PLATFORM_FLAG_KEYS)[number])) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const body = await request.json();
    if (typeof body.is_enabled !== 'boolean') {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }
    const isEnabled = body.is_enabled;

    // Critical flags require explicit confirmation header when disabling
    const isCritical = CRITICAL_FLAGS.includes(flagKey as (typeof CRITICAL_FLAGS)[number]);
    if (isCritical && !isEnabled && !request.headers.get('x-confirm-critical')) {
      return NextResponse.json({ error: 'Critical flag requires confirmation', confirm: true }, { status: 409 });
    }

    const rl = checkRateLimit(`admin-flag:${result.user_id}`, 30, 60_000);
    if (rl) return rl;

    const updated = await toggleFlag(result.admin, flagKey, isEnabled, result.user_id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[/api/admin/feature-flags/toggle] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
