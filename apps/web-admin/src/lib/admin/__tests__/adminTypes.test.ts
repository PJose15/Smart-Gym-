import {
  PLATFORM_FLAG_KEYS,
  CRITICAL_FLAGS,
  type PlatformFlagKey,
  type PlatformFeatureFlag,
  type PlatformOverviewData,
  type AdminSession,
} from '@nexera/types';

describe('Admin Types — Phase 9', () => {
  // ── PLATFORM_FLAG_KEYS ────────────────────────────────
  test('PLATFORM_FLAG_KEYS contains 7 expected flags', () => {
    expect(PLATFORM_FLAG_KEYS).toHaveLength(7);
    expect(PLATFORM_FLAG_KEYS).toContain('ai_chat_enabled');
    expect(PLATFORM_FLAG_KEYS).toContain('social_feed_enabled');
    expect(PLATFORM_FLAG_KEYS).toContain('ai_program_generation');
    expect(PLATFORM_FLAG_KEYS).toContain('global_leaderboard');
    expect(PLATFORM_FLAG_KEYS).toContain('push_notifications_enabled');
    expect(PLATFORM_FLAG_KEYS).toContain('uptimizeai_agents_enabled');
    expect(PLATFORM_FLAG_KEYS).toContain('new_gym_registrations');
  });

  test('PLATFORM_FLAG_KEYS are all snake_case strings', () => {
    for (const key of PLATFORM_FLAG_KEYS) {
      expect(key).toMatch(/^[a-z][a-z0-9_]+$/);
    }
  });

  test('no duplicate flag keys', () => {
    const unique = new Set(PLATFORM_FLAG_KEYS);
    expect(unique.size).toBe(PLATFORM_FLAG_KEYS.length);
  });

  // ── CRITICAL_FLAGS ────────────────────────────────────
  test('CRITICAL_FLAGS is a subset of PLATFORM_FLAG_KEYS', () => {
    for (const flag of CRITICAL_FLAGS) {
      expect(PLATFORM_FLAG_KEYS).toContain(flag);
    }
  });

  test('CRITICAL_FLAGS contains uptimizeai_agents_enabled', () => {
    expect(CRITICAL_FLAGS).toContain('uptimizeai_agents_enabled');
  });

  test('CRITICAL_FLAGS has at least 1 entry', () => {
    expect(CRITICAL_FLAGS.length).toBeGreaterThanOrEqual(1);
  });

  // ── Type shape tests (compile-time + runtime) ────────
  test('PlatformFeatureFlag has expected shape', () => {
    const flag: PlatformFeatureFlag = {
      id: '123',
      flag_key: 'ai_chat_enabled',
      is_enabled: true,
      description: 'Enables AI chat',
      updated_by: null,
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(flag.flag_key).toBe('ai_chat_enabled');
    expect(typeof flag.is_enabled).toBe('boolean');
  });

  test('PlatformOverviewData has expected shape', () => {
    const data: PlatformOverviewData = {
      active_gyms: 5,
      total_members: 200,
      sessions_today: 42,
      mrr_usd: 1500,
      openai_cost_30d: 12.5,
      new_registrations_7d: 8,
      health_status: 'healthy',
    };
    expect(data.health_status).toBe('healthy');
    expect(typeof data.mrr_usd).toBe('number');
  });

  test('PlatformOverviewData health_status allows degraded and down', () => {
    const degraded: PlatformOverviewData = {
      active_gyms: 0, total_members: 0, sessions_today: 0,
      mrr_usd: 0, openai_cost_30d: 0, new_registrations_7d: 0,
      health_status: 'degraded',
    };
    const down: PlatformOverviewData = {
      ...degraded,
      health_status: 'down',
    };
    expect(degraded.health_status).toBe('degraded');
    expect(down.health_status).toBe('down');
  });

  test('AdminSession has super_admin role', () => {
    const session: AdminSession = {
      user_id: 'abc',
      email: 'admin@nexera.io',
      display_name: 'Admin',
      platform_role: 'super_admin',
    };
    expect(session.platform_role).toBe('super_admin');
  });
});
