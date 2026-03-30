import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlatformFeatureFlag } from '@nexera/types';

/**
 * Fetches all platform feature flags.
 */
export async function getAllFlags(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<PlatformFeatureFlag[]> {
  const { data, error } = await admin
    .from('feature_flags')
    .select('id, flag_key, is_enabled, description, updated_by, updated_at')
    .order('flag_key');

  if (error) throw error;
  return (data ?? []) as PlatformFeatureFlag[];
}

/**
 * Toggles a feature flag and logs the action.
 */
export async function toggleFlag(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>,
  flagKey: string,
  isEnabled: boolean,
  adminUserId: string
): Promise<PlatformFeatureFlag> {
  const { data, error } = await admin
    .from('feature_flags')
    .update({ is_enabled: isEnabled, updated_by: adminUserId, updated_at: new Date().toISOString() })
    .eq('flag_key', flagKey)
    .select('id, flag_key, is_enabled, description, updated_by, updated_at')
    .single();

  if (error) throw error;

  // Log the action
  const { error: logError } = await admin.from('admin_actions_log').insert({
    admin_user_id: adminUserId,
    action_type: 'feature_flag_toggle',
    target_type: 'feature_flag',
    target_id: flagKey,
    details: { flag_key: flagKey, is_enabled: isEnabled },
  });

  if (logError) {
    console.error('[featureFlags] Failed to log action:', logError);
  }

  return data as PlatformFeatureFlag;
}
