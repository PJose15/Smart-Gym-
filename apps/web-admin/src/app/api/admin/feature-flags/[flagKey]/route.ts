import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';
import { toggleFlag } from '@/lib/featureFlags';
import { PLATFORM_FLAG_KEYS } from '@nexera/types';

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

    const updated = await toggleFlag(result.admin, flagKey, isEnabled, result.user_id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[/api/admin/feature-flags/toggle] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
