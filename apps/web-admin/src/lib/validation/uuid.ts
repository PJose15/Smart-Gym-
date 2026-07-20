import { NextResponse } from 'next/server';
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Permissive zod UUID validator (hex shape only). zod 4's `.uuid()` enforces
 * RFC 4122 version/variant bits, which rejects the synthetic fixed IDs used
 * by seed/demo data (e.g. `00000000-0000-0000-0001-000000000001`). Postgres
 * `uuid` accepts any hex-shaped value, so validate shape, not version.
 */
export const uuidString = z.string().regex(UUID_RE, 'Invalid UUID');

/**
 * Validates that all provided values are valid UUIDs.
 * Returns a 400 NextResponse if any are invalid, or null if all are valid.
 */
export function validateUUIDs(
  params: Record<string, string>,
): NextResponse | null {
  const invalid: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (!UUID_RE.test(value)) {
      invalid.push(key);
    }
  }
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Invalid UUID for: ${invalid.join(', ')}` },
      { status: 400 },
    );
  }
  return null;
}
