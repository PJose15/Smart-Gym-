import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { parseMembersCsv } from '@/lib/import/parseMembersCsv';
import type { StaffVerifyResult } from '@/lib/auth/verifyStaff';

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_ROWS = 500;

/**
 * POST /api/owner/members/import
 *
 * Two-phase validate-then-import endpoint for member CSV uploads.
 *
 * mode=validate  → parse + validate, return { valid, invalid, total } — no DB writes
 * mode=import    → validate + call bulk_import_members RPC with valid rows only
 *
 * Body: multipart/form-data with:
 *   - file: CSV file (max 1 MB)
 *   - mode: 'validate' | 'import'
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth ──────���─────────────────────────────────────────────────
  const authResult = await verifyStaff('owner');
  if (authResult instanceof NextResponse) return authResult;

  const { user_id, gym_id, admin } = authResult as StaffVerifyResult;

  // ── Rate limit ──────────────────────────────���────────────────────
  const limited = checkRateLimit(`members-import:${user_id}`, 10, 600_000);
  if (limited) return limited;

  // ���─ Parse form data ──────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  const mode = formData.get('mode') as string | null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!mode || (mode !== 'validate' && mode !== 'import')) {
    return NextResponse.json(
      { error: "mode must be 'validate' or 'import'" },
      { status: 400 }
    );
  }

  // ── File size check ──────────���────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 1 MB.' },
      { status: 400 }
    );
  }

  // ── Parse CSV ─────────────────���────────────────────��──────────────
  let csvText: string;
  try {
    csvText = await file.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 400 });
  }

  const parsed = parseMembersCsv(csvText);

  // ── Row cap ──────���────────────────────────────────────────────────
  if (parsed.total > MAX_ROWS) {
    return NextResponse.json(
      { error: `Max ${MAX_ROWS} rows per import. Your file has ${parsed.total} data rows.` },
      { status: 400 }
    );
  }

  // ── Validate mode — no DB writes ──────────────────────��───────────
  if (mode === 'validate') {
    return NextResponse.json({
      valid: parsed.valid,
      invalid: parsed.invalid,
      total: parsed.total,
    });
  }

  // ── Import mode ────────────────��──────────────────────���───────────
  // Only import valid rows; owner confirmed after seeing the validation report
  if (parsed.valid.length === 0) {
    return NextResponse.json(
      { error: 'No valid rows to import.' },
      { status: 400 }
    );
  }

  const { data, error: rpcError } = await admin.rpc('bulk_import_members', {
    p_gym_id: gym_id,
    p_members: parsed.valid,
  });

  if (rpcError) {
    console.error('[members/import] bulk_import_members RPC error:', rpcError.message);
    return NextResponse.json(
      { error: 'Import failed. Please try again.' },
      { status: 500 }
    );
  }

  const result = data as { imported: number; skipped: Array<{ row_index: number; reason: string }> };

  return NextResponse.json({
    imported: result.imported,
    skipped: result.skipped,
    invalid_count: parsed.invalid.length,
  });
}
