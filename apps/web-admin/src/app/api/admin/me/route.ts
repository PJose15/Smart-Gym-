import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';

export async function GET() {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  return NextResponse.json({
    user_id: result.user_id,
    email: result.email,
    display_name: result.display_name,
    role: 'super_admin',
  });
}
