-- ============================================
-- Phase 3.2: Knowledge Transfer — long-term knowledge expression profile
-- Tracks how users convert input knowledge into personal expression ability
-- ============================================

ALTER TABLE expression_profiles
  ADD COLUMN IF NOT EXISTS knowledge_transfer_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN expression_profiles.knowledge_transfer_profile IS 'Phase 3.2: { knowledge_understanding: {score,trend,recent_scores,sample_count}, knowledge_processing: {...}, personal_connection: {...}, expression_transfer: {...}, dominant_pattern, pattern_description, training_strategy[], round2_impact: {avg_knowledge_growth,stage_most_improved,retry_effectiveness} }';
