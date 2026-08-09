-- ============================================
-- Phase 3.5: Asset Source Tracking
-- Adds generic source tracking for assets mined
-- from any module (not just Chinese speaking).
-- ============================================

-- 1. Add source_type to expression_assets
ALTER TABLE expression_assets
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'chinese_speaking'
  CHECK (source_type IN (
    'chinese_speaking',
    'english_coach',
    'reflection',
    'journal',
    'manual'
  ));

COMMENT ON COLUMN expression_assets.source_type IS
  'Which module created this asset: chinese_speaking, english_coach, reflection, journal, manual';

-- 2. Add source_ref_id for generic source reference
ALTER TABLE expression_assets
  ADD COLUMN IF NOT EXISTS source_ref_id TEXT;

COMMENT ON COLUMN expression_assets.source_ref_id IS
  'Generic reference to source record (e.g., journal entry UUID, reflection insight UUID, coach session ID)';

-- 3. Relax fact_status to allow ai_suggested as default for mined assets
-- (existing rows keep their value, new mining flow uses ai_suggested until user confirms)
COMMENT ON COLUMN expression_assets.fact_status IS
  'user_confirmed = user explicitly saved; user_edited = user modified; ai_suggested = AI-mined, pending user review';
