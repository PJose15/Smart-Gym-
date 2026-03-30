import { createClient } from '@supabase/supabase-js';
import type { SubscriptionTier, FeatureAccessResult, TierFeatures } from '@nexera/types';
import { SUBSCRIPTION_TIERS } from './tiers';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type FeatureKey = keyof TierFeatures;

export async function checkFeatureAccess(
  gymId: string,
  feature: FeatureKey
): Promise<FeatureAccessResult> {
  const admin = getAdminClient();

  const { data: gym, error } = await admin
    .from('gyms')
    .select('subscription_tier, subscription_status')
    .eq('id', gymId)
    .single();

  if (error || !gym) {
    return { hasAccess: false, reason: 'Gym not found' };
  }

  const { subscription_tier, subscription_status } = gym;

  // Cancelled gyms lose all premium access
  if (subscription_status === 'cancelled') {
    return {
      hasAccess: false,
      reason: 'Subscription cancelled',
      upgradeMessage: 'Your subscription has been cancelled. Please resubscribe to access this feature.',
    };
  }

  const tier = subscription_tier as SubscriptionTier;
  const tierDef = SUBSCRIPTION_TIERS[tier];
  if (!tierDef) {
    return { hasAccess: false, reason: 'Unknown subscription tier' };
  }

  const featureValue = tierDef.features[feature];

  // Boolean features
  if (typeof featureValue === 'boolean') {
    if (featureValue) return { hasAccess: true };

    // Find the minimum tier that has this feature
    const requiredTier = findRequiredTier(feature);
    return {
      hasAccess: false,
      reason: `This feature requires the ${requiredTier} plan`,
      requiredTier,
      upgradeMessage: `Upgrade to ${SUBSCRIPTION_TIERS[requiredTier].name} to unlock this feature.`,
    };
  }

  // Array features (like uptimizeai_agents)
  if (Array.isArray(featureValue)) {
    // For array features, having any entries means access
    if (featureValue.length > 0) return { hasAccess: true };

    const requiredTier = findRequiredTier(feature);
    return {
      hasAccess: false,
      reason: `This feature requires the ${requiredTier} plan`,
      requiredTier,
      upgradeMessage: `Upgrade to ${SUBSCRIPTION_TIERS[requiredTier].name} to unlock this feature.`,
    };
  }

  // Numeric features (limits) — just check if non-zero / unlimited
  if (typeof featureValue === 'number') {
    if (featureValue !== 0) return { hasAccess: true };

    const requiredTier = findRequiredTier(feature);
    return {
      hasAccess: false,
      reason: `This feature requires the ${requiredTier} plan`,
      requiredTier,
      upgradeMessage: `Upgrade to ${SUBSCRIPTION_TIERS[requiredTier].name} to unlock this feature.`,
    };
  }

  return { hasAccess: true };
}

/**
 * Checks if a specific agent is available for a gym's tier.
 */
export async function checkAgentAccess(
  gymId: string,
  agentName: string
): Promise<FeatureAccessResult> {
  const admin = getAdminClient();

  const { data: gym, error } = await admin
    .from('gyms')
    .select('subscription_tier, subscription_status')
    .eq('id', gymId)
    .single();

  if (error || !gym) {
    return { hasAccess: false, reason: 'Gym not found' };
  }

  if (gym.subscription_status === 'cancelled') {
    return {
      hasAccess: false,
      reason: 'Subscription cancelled',
      upgradeMessage: 'Your subscription has been cancelled. Please resubscribe to access AI agents.',
    };
  }

  const tier = gym.subscription_tier as SubscriptionTier;
  const tierDef = SUBSCRIPTION_TIERS[tier];
  const agents = tierDef.features.uptimizeai_agents;

  if (agents.includes(agentName)) {
    return { hasAccess: true };
  }

  // Find the minimum tier that includes this agent
  const tiers: SubscriptionTier[] = ['starter', 'growth', 'pro'];
  for (const t of tiers) {
    if (SUBSCRIPTION_TIERS[t].features.uptimizeai_agents.includes(agentName)) {
      return {
        hasAccess: false,
        reason: `Agent "${agentName}" requires the ${t} plan`,
        requiredTier: t,
        upgradeMessage: `Upgrade to ${SUBSCRIPTION_TIERS[t].name} to use this agent.`,
      };
    }
  }

  return { hasAccess: false, reason: `Unknown agent: ${agentName}` };
}

function findRequiredTier(feature: FeatureKey): SubscriptionTier {
  const tiers: SubscriptionTier[] = ['starter', 'growth', 'pro'];
  for (const t of tiers) {
    const val = SUBSCRIPTION_TIERS[t].features[feature];
    if (typeof val === 'boolean' && val) return t;
    if (Array.isArray(val) && val.length > 0) return t;
    if (typeof val === 'number' && val !== 0) return t;
  }
  return 'pro';
}
