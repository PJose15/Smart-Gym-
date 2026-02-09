/**
 * Generate a URL-safe slug from a string.
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a QR slug for a machine: gym-slug + machine name + random suffix.
 */
export function generateQrSlug(gymSlug: string, machineName: string): string {
  const base = generateSlug(`${gymSlug}-${machineName}`);
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

/**
 * Parse a SmartGym QR code value.
 * Accepts:
 *   - smartgym://machine/<slug>
 *   - https://<domain>/m/<slug>
 *   - plain slug string
 * Returns the slug or null if invalid.
 */
export function parseQrCode(raw: string): string | null {
  const trimmed = raw.trim();

  // Deep link: smartgym://machine/<slug>
  const deepLinkMatch = trimmed.match(/^smartgym:\/\/machine\/([a-z0-9-]+)$/i);
  if (deepLinkMatch) return deepLinkMatch[1];

  // Universal link: https://*/m/<slug>
  const universalLinkMatch = trimmed.match(/^https?:\/\/[^/]+\/m\/([a-z0-9-]+)$/i);
  if (universalLinkMatch) return universalLinkMatch[1];

  // Plain slug (alphanumeric + hyphens, min 3 chars)
  const plainSlugMatch = trimmed.match(/^[a-z0-9][a-z0-9-]{1,}[a-z0-9]$/i);
  if (plainSlugMatch) return trimmed.toLowerCase();

  return null;
}

/**
 * Build the QR code value to encode for a machine.
 */
export function buildQrValue(qrSlug: string): string {
  return `smartgym://machine/${qrSlug}`;
}

/**
 * Format weight with unit.
 */
export function formatWeight(kg: number, unit: 'kg' | 'lbs' = 'kg'): string {
  if (unit === 'lbs') {
    return `${Math.round(kg * 2.20462)} lbs`;
  }
  return `${kg} kg`;
}

/**
 * Validate an email address (basic check).
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
