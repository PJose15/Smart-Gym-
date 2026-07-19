/**
 * @jest-environment node
 *
 * Tests for parseMembersCsv pure library
 */

import { parseMembersCsv, normalizeHeader } from '../parseMembersCsv';

// Test 1: UTF-8 BOM-prefixed CSV parses; first header is 'email' not '﻿email'
test('T1: BOM-prefixed CSV parses cleanly — first header is email', () => {
  const bom = '﻿';
  const csv = `${bom}email,name,phone\nbob@example.com,Bob Smith,+15551234567`;
  const result = parseMembersCsv(csv);
  expect(result.total).toBe(1);
  expect(result.valid).toHaveLength(1);
  expect(result.valid[0].email).toBe('bob@example.com');
});

// Test 2: header aliases — Excel variants map to canonical names
test('T2: header aliases normalise to canonical field names', () => {
  const csv = `Email Address,Full Name,Phone Number\nbob@example.com,Bob Smith,555-123-4567`;
  const result = parseMembersCsv(csv);
  expect(result.valid).toHaveLength(1);
  expect(result.valid[0].email).toBe('bob@example.com');
  expect(result.valid[0].display_name).toBe('Bob Smith');
  expect(result.valid[0].phone).toBe('+15551234567');
});

test('T2b: E-mail / Member Name / Mobile alias variants', () => {
  const csv = `E-mail,Member Name,Mobile\nbob@example.com,Bob Smith,+15551234567`;
  const result = parseMembersCsv(csv);
  expect(result.valid).toHaveLength(1);
  expect(result.valid[0].email).toBe('bob@example.com');
  expect(result.valid[0].display_name).toBe('Bob Smith');
});

test('T2c: Cell alias for phone; First Name maps to first_name', () => {
  const csv = `Email,First Name,Last Name,Cell\nbob@example.com,Bob,Smith,+15551234567`;
  const result = parseMembersCsv(csv);
  expect(result.valid).toHaveLength(1);
  expect(result.valid[0].first_name).toBe('Bob');
});

// Test 3: first+last name synthesises display_name; neither → invalid
test('T3: first+last name synthesises display_name', () => {
  const csv = `email,first_name,last_name,phone\nbob@example.com,Bob,Smith,+15551234567`;
  const result = parseMembersCsv(csv);
  expect(result.valid).toHaveLength(1);
  expect(result.valid[0].display_name).toBe('Bob Smith');
});

test('T3b: no name at all → row invalid with reason', () => {
  const csv = `email,phone\nbob@example.com,+15551234567`;
  const result = parseMembersCsv(csv);
  expect(result.valid).toHaveLength(0);
  expect(result.invalid).toHaveLength(1);
  expect(result.invalid[0].errors.join(' ')).toMatch(/name/i);
});

// Test 4: invalid email → invalid; missing BOTH email+phone → invalid; phone normalizes
test('T4a: invalid email format → row invalid', () => {
  const csv = `email,name,phone\nbob@,Bob Smith,+15551234567`;
  const result = parseMembersCsv(csv);
  expect(result.valid).toHaveLength(0);
  expect(result.invalid).toHaveLength(1);
  expect(result.invalid[0].errors.join(' ')).toMatch(/email/i);
});

test('T4b: missing BOTH email and phone → row invalid', () => {
  const csv = `email,name,phone\n,Bob Smith,`;
  const result = parseMembersCsv(csv);
  expect(result.valid).toHaveLength(0);
  expect(result.invalid).toHaveLength(1);
  expect(result.invalid[0].errors.join(' ')).toMatch(/email.*phone|phone.*email/i);
});

test('T4c: US phone 555-123-4567 normalises to +15551234567', () => {
  const csv = `email,name,phone\nbob@example.com,Bob Smith,555-123-4567`;
  const result = parseMembersCsv(csv);
  expect(result.valid).toHaveLength(1);
  expect(result.valid[0].phone).toBe('+15551234567');
});

test('T4d: phone already E.164 stays as-is', () => {
  const csv = `email,name,phone\nbob@example.com,Bob Smith,+15551234567`;
  const result = parseMembersCsv(csv);
  expect(result.valid[0].phone).toBe('+15551234567');
});

test('T4e: row with email but no phone is valid with a warning', () => {
  const csv = `email,name\nbob@example.com,Bob Smith`;
  const result = parseMembersCsv(csv);
  expect(result.valid).toHaveLength(1);
  const warnings = result.valid[0].warnings ?? [];
  expect(warnings.some(w => /phone|claim/i.test(w))).toBe(true);
});

// Test 5: in-file duplicate email (case-insensitive) → second row invalid
test('T5a: duplicate email in file (case-insensitive) → second row invalid', () => {
  const csv = `email,name,phone\nbob@example.com,Bob Smith,+15551234567\nBOB@EXAMPLE.COM,Bob Again,+15551111111`;
  const result = parseMembersCsv(csv);
  expect(result.valid).toHaveLength(1);
  expect(result.invalid).toHaveLength(1);
  expect(result.invalid[0].errors.join(' ')).toMatch(/duplicate/i);
});

test('T5b: duplicate phone in file → second row invalid', () => {
  const csv = `email,name,phone\nbob@example.com,Bob Smith,+15551234567\nalice@example.com,Alice,+15551234567`;
  const result = parseMembersCsv(csv);
  expect(result.valid).toHaveLength(1);
  expect(result.invalid).toHaveLength(1);
  expect(result.invalid[0].errors.join(' ')).toMatch(/duplicate/i);
});

// normalizeHeader helper
test('normalizeHeader: lowercases and maps known aliases', () => {
  expect(normalizeHeader('Email Address')).toBe('email');
  expect(normalizeHeader('Full Name')).toBe('display_name');
  expect(normalizeHeader('Phone Number')).toBe('phone');
  expect(normalizeHeader('Mobile')).toBe('phone');
  expect(normalizeHeader('Cell')).toBe('phone');
  expect(normalizeHeader('Member Name')).toBe('display_name');
  expect(normalizeHeader('E-mail')).toBe('email');
  expect(normalizeHeader('First Name')).toBe('first_name');
  expect(normalizeHeader('Last Name')).toBe('last_name');
});
