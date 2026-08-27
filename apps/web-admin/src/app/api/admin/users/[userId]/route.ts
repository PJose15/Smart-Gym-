import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const uuidError = validateUUIDs({ userId: params.userId });
    if (uuidError) return uuidError;
    const result = await verifySuperAdmin();
    if (result instanceof NextResponse) return result;
    const { admin, user_id } = result;

    if (params.userId === user_id)
      return NextResponse.json(
        { error: 'Cannot suspend yourself' },
        { status: 400 }
      );

    const rl = checkRateLimit(`admin-ban:${user_id}`, 10, 60_000);
    if (rl) return rl;

    const { error } = await admin.auth.admin.updateUserById(params.userId, {
      ban_duration: '876000h',
    });
    if (error)
      return NextResponse.json(
        { error: 'Failed to suspend user' },
        { status: 500 }
      );

    // Log action
    const { error: logError } = await admin.from('admin_actions_log').insert({
      admin_user_id: user_id,
      action_type: 'suspend_user',
      target_type: 'user',
      target_id: params.userId,
    });
    if (logError) {
      console.error('[admin/users] Failed to log action:', logError);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
