import { NextResponse } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
