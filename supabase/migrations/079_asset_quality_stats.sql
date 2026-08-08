-- ============================================
-- Phase 4 Stage 2-4: Asset quality score + profile asset stats
-- ============================================

-- 1. Add quality_score to expression_assets (computed, no AI)
ALTER TABLE expression_assets
  ADD COLUMN IF NOT EXISTS quality_score JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN expression_assets.quality_score IS
  'Phase 4 Stage 2: Computed quality metrics. {completeness: 0-100, authenticity: 0-100, reusability: 0-100}';

-- 2. Add asset_stats to expression_profiles (computed summary)
ALTER TABLE expression_profiles
  ADD COLUMN IF NOT EXISTS asset_stats JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN expression_profiles.asset_stats IS
  'Phase 4 Stage 4: Asset summary. {total, by_type: {personal_story: N, ...}, recently_added: [...], top_tags: [...]}';
