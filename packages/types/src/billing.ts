// ============================================================================
// Phase 7 — Billing & Feature Gating Types
// ============================================================================

export type SubscriptionTier = 'starter' | 'growth' | 'pro';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export type BillingInterval = 'monthly' | 'annual';

export interface TierFeatures {
  max_machines: number;
  max_members: number;
  ai_programs: boolean;
  coach_notes: boolean;
  custom_branding: boolean;
  franchise_support: boolean;
  leaderboards: boolean;
  challenges: boolean;
  social_feed: boolean;
  push_notifications: boolean;
  occupancy_heatmap: boolean;
  uptimizeai_agents: string[];
}

export interface TierDefinition {
  name: string;
  tier: SubscriptionTier;
  price_monthly: number;
  price_annual: number;
  features: TierFeatures;
}

export interface BillingInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  limits: {
    max_machines: number;
    max_members: number;
  };
  counts: {
    machines: number;
    members: number;
  };
}

export interface FeatureAccessResult {
  hasAccess: boolean;
  reason?: string;
  requiredTier?: SubscriptionTier;
  upgradeMessage?: string;
}
