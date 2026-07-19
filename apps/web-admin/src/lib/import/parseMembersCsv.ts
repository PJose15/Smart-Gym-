import { parse } from 'csv-parse/sync';

export interface ParsedMemberRow {
  display_name: string;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  warnings?: string[];
}

export interface RowError {
  row: number;
  errors: string[];
  raw: Record<string, string>;
}

export interface ParseResult {
  valid: ParsedMemberRow[];
  invalid: RowError[];
  total: number;
}

/**
 * Normalize a CSV header to a canonical field name.
 * Handles common Excel/Sheets export variants.
 */
export function normalizeHeader(h: string): string {
  const cleaned = h.replace(/^﻿/, '').toLowerCase().trim();

  // Email aliases
  if (
    cleaned === 'email' ||
    cleaned === 'email address' ||
    cleaned === 'e-mail' ||
    cleaned === 'e_mail'
  ) {
    return 'email';
  }

  // Phone aliases
  if (
    cleaned === 'phone' ||
    cleaned === 'phone number' ||
    cleaned === 'mobile' ||
    cleaned === 'cell' ||
    cleaned === 'mobile number' ||
    cleaned === 'cell number'
  ) {
    return 'phone';
  }

  // Full display name aliases
  if (
    cleaned === 'full name' ||
    cleaned === 'member name' ||
    cleaned === 'name' ||
    cleaned === 'display_name' ||
    cleaned === 'displayname'
  ) {
    return 'display_name';
  }

  // First name
  if (cleaned === 'first name' || cleaned === 'firstname' || cleaned === 'first_name') {
    return 'first_name';
  }

  // Last name
  if (cleaned === 'last name' || cleaned === 'lastname' || cleaned === 'last_name') {
    return 'last_name';
  }

  // Default: replace spaces with underscores
  return cleaned.replace(/\s+/g, '_');
}

/**
 * Normalize a phone number to E.164 format.
 * - Strips spaces, dashes, parens, dots
 * - 10 digits → assume US +1 prefix
 * - Already starts with + → keep (strip non-digits after +)
 * - Otherwise → returns null (invalid)
 */
function normalizePhone(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  // Strip everything except digits and leading +
  const stripped = raw.trim().replace(/[\s\-().]/g, '');

  if (stripped.startsWith('+')) {
    // E.164: keep + and digits
    const digits = stripped.slice(1).replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return null;
    return `+${digits}`;
  }

  // Only digits remain
  const digits = stripped.replace(/\D/g, '');

  if (digits.length === 10) {
    // US number without country code
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    // US with leading 1
    return `+${digits}`;
  }

  if (digits.length >= 7 && digits.length <= 15) {
    // Treat as international without +
    return `+${digits}`;
  }

  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse a CSV text string of member data.
 * Handles UTF-8 BOM, header variants, phone normalization,
 * in-file duplicate detection, and row-level validation.
 */
export function parseMembersCsv(text: string): ParseResult {
  const valid: ParsedMemberRow[] = [];
  const invalid: RowError[] = [];

  // Strip BOM manually (belt-and-braces on top of csv-parse bom:true)
  const cleanText = text.replace(/^﻿/, '');

  let rows: Record<string, string>[];
  try {
    rows = parse(cleanText, {
      columns: (headers: string[]) => headers.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (err) {
    const message = err instanceof Error ? err.message : 'CSV parse error';
    return {
      valid: [],
      invalid: [{ row: 1, errors: [`CSV parse error: ${message}`], raw: {} }],
      total: 0,
    };
  }

  // Track seen emails and phones for in-file dedup
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const errors: string[] = [];
    const warnings: string[] = [];

    // ── Name resolution ──────────────────────────────────────────
    let displayName = row['display_name']?.trim() || '';
    const firstName = row['first_name']?.trim() || null;
    const lastName = row['last_name']?.trim() || null;

    if (!displayName) {
      if (firstName || lastName) {
        displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
      } else {
        errors.push('Name is required (provide a Name, Full Name, or First + Last Name column)');
      }
    }

    // ── Email validation ─────────────────────────────────────────
    let email: string | null = row['email']?.trim() || null;
    if (email) {
      email = email.toLowerCase();
      if (!EMAIL_RE.test(email)) {
        errors.push(`Invalid email format: '${row['email']}'`);
        email = null;
      }
    }

    // ── Phone normalization ───────────────────────────────────────
    const rawPhone = row['phone']?.trim() || '';
    let phone: string | null = null;
    if (rawPhone) {
      phone = normalizePhone(rawPhone);
      if (phone === null) {
        errors.push(`Invalid phone number: '${rawPhone}'`);
      }
    }

    // ── Require at least one of email or phone ───────────────────
    if (!errors.some(e => e.includes('email'))) {
      if (!email && !phone && !rawPhone) {
        errors.push('At least one of email or phone is required');
      }
    } else if (!phone && !rawPhone) {
      // email errored and no phone either
      errors.push('At least one of email or phone is required');
    }

    // ── In-file dedup ─────────────────────────────────────────────
    if (email && errors.length === 0) {
      if (seenEmails.has(email)) {
        errors.push(`Duplicate email in file: '${email}'`);
      } else {
        seenEmails.add(email);
      }
    }

    if (phone && errors.length === 0) {
      if (seenPhones.has(phone)) {
        errors.push(`Duplicate phone in file: '${phone}'`);
      } else {
        seenPhones.add(phone);
      }
    }

    // ── No phone warning ──────────────────────────────────────────
    if (errors.length === 0 && !phone) {
      warnings.push('No phone number — member cannot claim profile via mobile OTP until a phone is added');
    }

    if (errors.length > 0) {
      invalid.push({ row: rowNum, errors, raw: row });
    } else {
      valid.push({
        display_name: displayName,
        first_name: firstName || (displayName ? displayName.split(' ')[0] : null),
        email,
        phone,
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    }
  });

  return { valid, invalid, total: rows.length };
}
