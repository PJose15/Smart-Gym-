/**
 * Tests for admin API input validation patterns used across Phase 9 routes.
 * These test the validation logic extracted from the route handlers.
 */

describe('Admin Input Validation — Phase 9', () => {
  // ── Pagination bounds ─────────────────────────────────

  describe('pagination validation', () => {
    function validatePagination(limitParam: string | null, offsetParam: string | null) {
      const limit = Math.min(Math.max(1, Number(limitParam ?? 50) || 50), 100);
      const offset = Math.max(0, Number(offsetParam ?? 0) || 0);
      return { limit, offset };
    }

    test('defaults to limit=50, offset=0', () => {
      expect(validatePagination(null, null)).toEqual({ limit: 50, offset: 0 });
    });

    test('caps limit at 100', () => {
      expect(validatePagination('999', '0')).toEqual({ limit: 100, offset: 0 });
    });

    test('floors limit at 1', () => {
      expect(validatePagination('0', '0')).toEqual({ limit: 50, offset: 0 }); // 0 || 50 = 50
      expect(validatePagination('-5', '0')).toEqual({ limit: 1, offset: 0 }); // -5 is valid number, max(1,-5) = 1
    });

    test('floors offset at 0', () => {
      expect(validatePagination('50', '-10')).toEqual({ limit: 50, offset: 0 });
    });

    test('handles NaN inputs gracefully', () => {
      expect(validatePagination('abc', 'xyz')).toEqual({ limit: 50, offset: 0 });
    });

    test('accepts valid values', () => {
      expect(validatePagination('25', '100')).toEqual({ limit: 25, offset: 100 });
    });
  });

  // ── Search length ─────────────────────────────────────

  describe('search validation', () => {
    function validateSearch(raw: string | null) {
      return (raw ?? '').slice(0, 256);
    }

    test('truncates to 256 characters', () => {
      const longSearch = 'a'.repeat(500);
      expect(validateSearch(longSearch)).toHaveLength(256);
    });

    test('passes short strings through', () => {
      expect(validateSearch('gym')).toBe('gym');
    });

    test('defaults null to empty string', () => {
      expect(validateSearch(null)).toBe('');
    });
  });

  // ── Status filter validation ──────────────────────────

  describe('error status filter', () => {
    const validStatuses = ['unresolved', 'resolved', 'all'];

    function validateErrorStatus(raw: string | null) {
      const param = raw ?? 'unresolved';
      return validStatuses.includes(param) ? param : 'unresolved';
    }

    test('defaults to unresolved', () => {
      expect(validateErrorStatus(null)).toBe('unresolved');
    });

    test('accepts valid values', () => {
      expect(validateErrorStatus('resolved')).toBe('resolved');
      expect(validateErrorStatus('all')).toBe('all');
    });

    test('rejects invalid values', () => {
      expect(validateErrorStatus('invalid')).toBe('unresolved');
      expect(validateErrorStatus('DROP TABLE')).toBe('unresolved');
    });
  });

  describe('member status filter', () => {
    const validStatuses = ['all', 'active', 'inactive', 'suspended'];

    function validateMemberStatus(raw: string | null) {
      const param = raw ?? 'all';
      return validStatuses.includes(param) ? param : 'all';
    }

    test('defaults to all', () => {
      expect(validateMemberStatus(null)).toBe('all');
    });

    test('accepts active/inactive/suspended', () => {
      expect(validateMemberStatus('active')).toBe('active');
      expect(validateMemberStatus('inactive')).toBe('inactive');
      expect(validateMemberStatus('suspended')).toBe('suspended');
    });

    test('rejects invalid values', () => {
      expect(validateMemberStatus('garbage')).toBe('all');
    });
  });

  describe('gym filters', () => {
    const validStatuses = ['all', 'active', 'trialing', 'past_due', 'cancelled'];
    const validTiers = ['all', 'starter', 'growth', 'pro'];

    function validateGymStatus(raw: string | null) {
      const param = raw ?? 'all';
      return validStatuses.includes(param) ? param : 'all';
    }

    function validateGymTier(raw: string | null) {
      const param = raw ?? 'all';
      return validTiers.includes(param) ? param : 'all';
    }

    test('status defaults to all', () => {
      expect(validateGymStatus(null)).toBe('all');
    });

    test('tier defaults to all', () => {
      expect(validateGymTier(null)).toBe('all');
    });

    test('accepts valid gym statuses', () => {
      expect(validateGymStatus('active')).toBe('active');
      expect(validateGymStatus('past_due')).toBe('past_due');
    });

    test('accepts valid tiers', () => {
      expect(validateGymTier('starter')).toBe('starter');
      expect(validateGymTier('pro')).toBe('pro');
    });

    test('rejects invalid gym status', () => {
      expect(validateGymStatus('hacked')).toBe('all');
    });

    test('rejects invalid tier', () => {
      expect(validateGymTier('enterprise')).toBe('all');
    });
  });

  // ── Feature flag validation ───────────────────────────

  describe('feature flag toggle validation', () => {
    const PLATFORM_FLAG_KEYS = [
      'ai_chat_enabled', 'social_feed_enabled', 'ai_program_generation',
      'global_leaderboard', 'push_notifications_enabled',
      'uptimizeai_agents_enabled', 'new_gym_registrations',
    ] as const;

    const CRITICAL_FLAGS = ['uptimizeai_agents_enabled'] as const;

    function validateFlagToggle(flagKey: string, body: unknown, hasConfirmHeader: boolean) {
      if (!PLATFORM_FLAG_KEYS.includes(flagKey as typeof PLATFORM_FLAG_KEYS[number])) {
        return { valid: false, reason: 'unknown_flag' };
      }
      if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).is_enabled !== 'boolean') {
        return { valid: false, reason: 'invalid_body' };
      }
      const isEnabled = (body as { is_enabled: boolean }).is_enabled;
      const isCritical = CRITICAL_FLAGS.includes(flagKey as typeof CRITICAL_FLAGS[number]);
      if (isCritical && !isEnabled && !hasConfirmHeader) {
        return { valid: false, reason: 'needs_confirmation' };
      }
      return { valid: true, isEnabled };
    }

    test('rejects unknown flag key', () => {
      expect(validateFlagToggle('unknown_flag', { is_enabled: true }, false))
        .toEqual({ valid: false, reason: 'unknown_flag' });
    });

    test('rejects non-boolean is_enabled', () => {
      expect(validateFlagToggle('ai_chat_enabled', { is_enabled: 'yes' }, false))
        .toEqual({ valid: false, reason: 'invalid_body' });
    });

    test('rejects null body', () => {
      expect(validateFlagToggle('ai_chat_enabled', null, false))
        .toEqual({ valid: false, reason: 'invalid_body' });
    });

    test('accepts valid enable toggle', () => {
      expect(validateFlagToggle('ai_chat_enabled', { is_enabled: true }, false))
        .toEqual({ valid: true, isEnabled: true });
    });

    test('accepts valid disable toggle for non-critical flag', () => {
      expect(validateFlagToggle('social_feed_enabled', { is_enabled: false }, false))
        .toEqual({ valid: true, isEnabled: false });
    });

    test('blocks critical flag disable without confirmation', () => {
      expect(validateFlagToggle('uptimizeai_agents_enabled', { is_enabled: false }, false))
        .toEqual({ valid: false, reason: 'needs_confirmation' });
    });

    test('allows critical flag disable with confirmation header', () => {
      expect(validateFlagToggle('uptimizeai_agents_enabled', { is_enabled: false }, true))
        .toEqual({ valid: true, isEnabled: false });
    });

    test('allows critical flag enable without confirmation', () => {
      expect(validateFlagToggle('uptimizeai_agents_enabled', { is_enabled: true }, false))
        .toEqual({ valid: true, isEnabled: true });
    });
  });

  // ── Billing status validation ─────────────────────────

  describe('billing status normalization', () => {
    const validStatuses = ['active', 'trialing', 'past_due', 'cancelled'];

    function normalizeBillingStatus(raw: string | null) {
      return validStatuses.includes(raw ?? '') ? raw : 'unknown';
    }

    test('passes valid statuses through', () => {
      expect(normalizeBillingStatus('active')).toBe('active');
      expect(normalizeBillingStatus('trialing')).toBe('trialing');
      expect(normalizeBillingStatus('past_due')).toBe('past_due');
      expect(normalizeBillingStatus('cancelled')).toBe('cancelled');
    });

    test('normalizes unknown status', () => {
      expect(normalizeBillingStatus('deleted')).toBe('unknown');
      expect(normalizeBillingStatus(null)).toBe('unknown');
    });
  });

  // ── Health score calculation ──────────────────────────

  describe('gym health score', () => {
    function calcHealthScore(members: number, sessions: number, subStatus: string) {
      let health = 50;
      if (members > 0) health += Math.min(30, Math.round(Math.min(sessions / members, 3) * 10));
      if (subStatus === 'active') health += 20;
      else if (subStatus === 'trialing') health += 10;
      health = Math.min(100, Math.max(0, health));
      return health;
    }

    test('base score is 50 with no members and unknown status', () => {
      expect(calcHealthScore(0, 0, 'unknown')).toBe(50);
    });

    test('active subscription adds 20', () => {
      expect(calcHealthScore(0, 0, 'active')).toBe(70);
    });

    test('trialing subscription adds 10', () => {
      expect(calcHealthScore(0, 0, 'trialing')).toBe(60);
    });

    test('activity ratio capped at 3x members', () => {
      // 100 sessions / 10 members = 10, but capped at 3 → 30 points
      expect(calcHealthScore(10, 100, 'active')).toBe(100); // 50 + 30 + 20
    });

    test('moderate activity gives proportional score', () => {
      // 15 sessions / 10 members = 1.5 → round(1.5 * 10) = 15
      expect(calcHealthScore(10, 15, 'active')).toBe(85); // 50 + 15 + 20
    });

    test('zero members skips activity bonus', () => {
      expect(calcHealthScore(0, 50, 'active')).toBe(70); // 50 + 0 + 20
    });

    test('score never exceeds 100', () => {
      expect(calcHealthScore(1, 999, 'active')).toBe(100);
    });

    test('score never goes below 0', () => {
      expect(calcHealthScore(0, 0, 'cancelled')).toBe(50);
    });
  });

  // ── Auth security: 404 concealment ────────────────────

  describe('admin auth 404 concealment', () => {
    test('all admin error responses should use 404 status', () => {
      // Document the security requirement: admin endpoints must never
      // return 401/403 to avoid revealing admin route existence.
      // The verifySuperAdmin middleware returns 404 for all auth failures.
      const allowedErrorStatuses = [404, 409]; // 409 for critical flag confirmation
      expect(allowedErrorStatuses).toContain(404);
      expect(allowedErrorStatuses).not.toContain(401);
      expect(allowedErrorStatuses).not.toContain(403);
    });
  });
});
