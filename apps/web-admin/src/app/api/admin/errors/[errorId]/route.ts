import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ errorId: string }> }
) {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  try {
    const { admin, email } = result;
    const { errorId } = await params;
    const uuidError = validateUUIDs({ errorId });
    if (uuidError) return uuidError;

    const { error } = await admin
      .from('error_log')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: email,
      })
      .eq('id', errorId);

    if (error) throw error;

    // Log admin action
    await admin.from('admin_actions_log').insert({
      admin_user_id: result.user_id,
      action_type: 'resolve_error',
      target_type: 'error_log',
      target_id: errorId,
      details: { resolved_by: email },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[/api/admin/errors/[errorId]] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
