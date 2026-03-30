import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';
import { getAllFlags } from '@/lib/featureFlags';

export async function GET() {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  try {
    const flags = await getAllFlags(result.admin);
    return NextResponse.json(flags);
  } catch (err) {
    console.error('[/api/admin/feature-flags] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
