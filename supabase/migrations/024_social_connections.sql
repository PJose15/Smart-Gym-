-- ═══════════════════════════════════════════════════════════════════
-- Migration 024: social_connections (DOC_02 ghost-table reconciliation)
-- ═══════════════════════════════════════════════════════════════════
-- The follow/unfollow API routes (/api/social/follow, /api/social/unfollow,
-- /api/social/[memberId]/connections) reference this table but no migration
-- ever created it. This was the only true ghost table found in the DOC_02
-- audit — error_log, platform_daily_metrics and admin_actions_log already
-- exist (created by migration 021).
--
-- Schema is derived from the code, not the DOC_02 draft:
--   * UNIQUE (follower_id, following_id) — required by the upsert
--     onConflict: 'follower_id,following_id' in the follow route.
--   * No gym_id column — the routes never write one; gym scoping is
--     enforced in RLS via the follower's members row.
--   * FK constraint names are load-bearing: the connections route embeds
--     members!social_connections_follower_id_fkey and
--     members!social_connections_following_id_fkey. Postgres default
--     naming produces exactly these names.
--
-- Rollback:
--   DROP TABLE IF EXISTS social_connections;

CREATE TABLE social_connections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT social_connections_no_self_follow CHECK (follower_id <> following_id),
  CONSTRAINT social_connections_unique_follow UNIQUE (follower_id, following_id)
);

-- The unique constraint covers follower_id lookups; add the reverse direction.
CREATE INDEX idx_social_connections_following
  ON social_connections(following_id);

ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

-- Members can see follow relationships within their own gym(s)
CREATE POLICY "social_connections_gym_read"
  ON social_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members f
      WHERE f.id = social_connections.follower_id
        AND is_gym_member(f.gym_id)
    )
  );

-- API routes write via service role (bypasses RLS); these policies are
-- defense in depth for any future direct client access.
CREATE POLICY "social_connections_own_insert"
  ON social_connections FOR INSERT
  WITH CHECK (
    follower_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

CREATE POLICY "social_connections_own_delete"
  ON social_connections FOR DELETE
  USING (
    follower_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

COMMENT ON TABLE social_connections IS
  'Member follow relationships (Phase 8.4 social graph). Written via service-role API routes.';
