-- ============================================
-- Migration 036: Simplify AI status lifecycle
-- Reduce from 7 states to 5:
--   pending | processing | completed | partial | failed
--
-- Mapping:
--   extracting + analyzing → processing
--   need_upload → failed
-- ============================================

-- Update existing recipes to match new status values
UPDATE recipes
  SET ai_analysis_status = 'processing'
  WHERE ai_analysis_status IN ('extracting', 'analyzing');

UPDATE recipes
  SET ai_analysis_status = 'failed'
  WHERE ai_analysis_status = 'need_upload';

-- Update column comment
COMMENT ON COLUMN recipes.ai_analysis_status IS 'pending | processing | completed | partial | failed';

-- Update source_content comment to match new spec
COMMENT ON COLUMN recipes.source_content IS 'Raw extracted content: {title, description, subtitle, transcript, ocr_text, vision_result, platform}';
