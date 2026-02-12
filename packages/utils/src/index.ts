/**
 * Formats a number with comma separators
 * @param value - The number to format
 * @returns Formatted string (e.g., "1,000")
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Formats a number with comma separators and optional "+" suffix
 * @param value - The number to format
 * @param showPlus - Whether to add "+" for large numbers
 * @returns Formatted string (e.g., "1,000+")
 */
export function formatStatValue(value: number, showPlus = false): string {
  const formatted = formatNumber(value);
  return showPlus && value >= 1000 ? `${formatted}+` : formatted;
}

/**
 * Parses a QR code string to extract machine slug
 * @param data - Raw QR code data
 * @returns Machine slug or null if invalid
 */
export function parseQrCode(data: string): string | null {
  // Expected format: "smartgym://machine/{slug}" or just the slug
  try {
    if (data.startsWith('smartgym://machine/')) {
      return data.replace('smartgym://machine/', '');
    }
    // Assume it's just a slug if it doesn't match the URL format
    // Validate it's alphanumeric with hyphens/underscores
    if (/^[a-zA-Z0-9_-]+$/.test(data)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}
