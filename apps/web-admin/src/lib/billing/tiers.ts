import type { TierDefinition, SubscriptionTier } from '@nexera/types';

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierDefinition> = {
  starter: {
    name: 'Starter',
    tier: 'starter',
    price_monthly: 49,
    price_annual: 468, // $39/mo billed annually
    features: {
      max_machines: 20,
      max_members: 100,
      ai_programs: false,
      coach_notes: false,
      custom_branding: false,
      franchise_support: false,
      leaderboards: true,
      challenges: false,
      social_feed: true,
      push_notifications: true,
      occupancy_heatmap: false,
      uptimizeai_agents: [],
    },
  },
  growth: {
    name: 'Growth',
    tier: 'growth',
    price_monthly: 99,
    price_annual: 948, // $79/mo billed annually
    features: {
      max_machines: 50,
      max_members: 500,
      ai_programs: true,
      coach_notes: true,
      custom_branding: true,
      franchise_support: false,
      leaderboards: true,
      challenges: true,
      social_feed: true,
      push_notifications: true,
      occupancy_heatmap: true,
      uptimizeai_agents: ['retention-agent', 'engagement-agent'],
    },
  },
  pro: {
    name: 'Pro',
    tier: 'pro',
    price_monthly: 199,
    price_annual: 1908, // $159/mo billed annually
    features: {
      max_machines: -1, // unlimited
      max_members: -1,  // unlimited
      ai_programs: true,
      coach_notes: true,
      custom_branding: true,
      franchise_support: true,
      leaderboards: true,
      challenges: true,
      social_feed: true,
      push_notifications: true,
      occupancy_heatmap: true,
      uptimizeai_agents: [
        'retention-agent',
        'engagement-agent',
        'revenue-agent',
        'operations-agent',
        'growth-agent',
      ],
    },
  },
};

export function getTierDefinition(tier: SubscriptionTier): TierDefinition {
  return SUBSCRIPTION_TIERS[tier];
}
