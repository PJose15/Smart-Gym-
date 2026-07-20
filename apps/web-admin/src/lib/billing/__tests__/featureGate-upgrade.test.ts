/**
 * @jest-environment node
 *
 * Tests for shouldTriggerUpgradeAgent + fireUpgradeOpportunity in featureGate.ts
 *
 * Mocks:
 *  - @/lib/billing/triggerAgent (triggerUptimizeAIAgent)
 */

// ─── Mock triggerAgent ────────────────────────────────────────────────────────
const mockTriggerUptimizeAIAgent = jest.fn().mockResolvedValue({ success: true });
jest.mock('@/lib/billing/triggerAgent', () => ({
  triggerUptimizeAIAgent: (...args: unknown[]) => mockTriggerUptimizeAIAgent(...args),
}));

// ─── Stub @supabase/supabase-js (required by featureGate.ts module init) ──────
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

let shouldTriggerUpgradeAgent: (feature: string) => boolean;
let fireUpgradeOpportunity: (gymId: string, feature: string, requiredTier?: string) => void;

beforeAll(async () => {
  const mod = await import('../featureGate');
  shouldTriggerUpgradeAgent = (mod as unknown as Record<string, (f: string) => boolean>).shouldTriggerUpgradeAgent;
  fireUpgradeOpportunity = (mod as unknown as Record<string, (g: string, f: string, t?: string) => void>).fireUpgradeOpportunity;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockTriggerUptimizeAIAgent.mockResolvedValue({ success: true });
});

// ─── shouldTriggerUpgradeAgent ────────────────────────────────────────────────

describe('shouldTriggerUpgradeAgent', () => {
  test('returns true for ai_programs (upgrade intent)', () => {
    expect(shouldTriggerUpgradeAgent('ai_programs')).toBe(true);
  });

  test('returns true for challenges', () => {
    expect(shouldTriggerUpgradeAgent('challenges')).toBe(true);
  });

  test('returns true for coach_notes', () => {
    expect(shouldTriggerUpgradeAgent('coach_notes')).toBe(true);
  });

  test('returns true for custom_branding', () => {
    expect(shouldTriggerUpgradeAgent('custom_branding')).toBe(true);
  });

  test('returns true for max_machines', () => {
    expect(shouldTriggerUpgradeAgent('max_machines')).toBe(true);
  });

  test('returns false for leaderboards (not upgrade-intent, low friction)', () => {
    expect(shouldTriggerUpgradeAgent('leaderboards')).toBe(false);
  });

  test('returns false for social_feed', () => {
    expect(shouldTriggerUpgradeAgent('social_feed')).toBe(false);
  });

  test('returns false for push_notifications', () => {
    expect(shouldTriggerUpgradeAgent('push_notifications')).toBe(false);
  });

  test('returns false for franchise_support', () => {
    expect(shouldTriggerUpgradeAgent('franchise_support')).toBe(false);
  });
});

// ─── fireUpgradeOpportunity ───────────────────────────────────────────────────

describe('fireUpgradeOpportunity', () => {
  test('calls triggerUptimizeAIAgent with revenue-agent + correct payload for max_machines', async () => {
    fireUpgradeOpportunity('gym-1', 'max_machines');
    // fire-and-forget — give the microtask queue a tick to flush
    await Promise.resolve();
    expect(mockTriggerUptimizeAIAgent).toHaveBeenCalledTimes(1);
    expect(mockTriggerUptimizeAIAgent).toHaveBeenCalledWith(
      'revenue-agent',
      expect.objectContaining({
        event: 'upgrade-opportunity',
        gym_id: 'gym-1',
        feature: 'max_machines',
        dedup_key: 'max_machines',
        is_agent_initiated: false,
      })
    );
  });

  test('passes required_tier in payload when provided', async () => {
    fireUpgradeOpportunity('gym-2', 'ai_programs', 'growth');
    await Promise.resolve();
    expect(mockTriggerUptimizeAIAgent).toHaveBeenCalledWith(
      'revenue-agent',
      expect.objectContaining({
        required_tier: 'growth',
      })
    );
  });

  test('sets required_tier to null when not provided', async () => {
    fireUpgradeOpportunity('gym-3', 'max_machines');
    await Promise.resolve();
    expect(mockTriggerUptimizeAIAgent).toHaveBeenCalledWith(
      'revenue-agent',
      expect.objectContaining({
        required_tier: null,
      })
    );
  });

  test('does NOT call triggerUptimizeAIAgent for a non-upgrade-intent feature (leaderboards)', async () => {
    fireUpgradeOpportunity('gym-1', 'leaderboards');
    await Promise.resolve();
    expect(mockTriggerUptimizeAIAgent).not.toHaveBeenCalled();
  });

  test('does NOT call triggerUptimizeAIAgent for social_feed', async () => {
    fireUpgradeOpportunity('gym-1', 'social_feed');
    await Promise.resolve();
    expect(mockTriggerUptimizeAIAgent).not.toHaveBeenCalled();
  });

  test('never throws even when triggerUptimizeAIAgent rejects', async () => {
    mockTriggerUptimizeAIAgent.mockRejectedValue(new Error('webhook down'));
    expect(() => fireUpgradeOpportunity('gym-1', 'max_machines')).not.toThrow();
    // Wait for rejection to be swallowed
    await new Promise((r) => setTimeout(r, 10));
  });
});
