-- ============================================
-- 082: Expression Asset Usage Tracking
-- Records which assets are recommended by AI agents
-- for future analysis of high-value personal assets.
-- ============================================

CREATE TABLE IF NOT EXISTS expression_asset_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES expression_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  action TEXT NOT NULL,
  match_score INTEGER,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_asset_usage_asset
  ON expression_asset_usage(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_user
  ON expression_asset_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_agent
  ON expression_asset_usage(agent_type, used_at DESC);

-- RLS
ALTER TABLE expression_asset_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own asset usage" ON expression_asset_usage;
CREATE POLICY "Users manage own asset usage"
  ON expression_asset_usage FOR ALL
  USING (auth.uid() = user_id);
