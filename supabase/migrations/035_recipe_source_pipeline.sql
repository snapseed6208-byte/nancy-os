-- ============================================
-- Migration 035: Recipe Source Pipeline v3
-- Add source tracking, content storage, confidence,
-- and proper AI status lifecycle.
-- ============================================

-- 1. Source type — where did this recipe come from?
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_type TEXT;
COMMENT ON COLUMN recipes.source_type IS 'bilibili | xiaohongshu | douyin | upload | manual';

-- 2. Source content — raw extracted content from the source
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_content JSONB DEFAULT '{}';
COMMENT ON COLUMN recipes.source_content IS 'Raw extracted content: {title, description, transcript, ocr_text, images[], platform}';

-- 3. Confidence — how reliable is the AI extraction?
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS confidence TEXT;
COMMENT ON COLUMN recipes.confidence IS 'high (transcript/text) | medium (OCR/vision) | low (title only)';

-- 4. Update AI status comment to reflect new lifecycle
COMMENT ON COLUMN recipes.ai_analysis_status IS 'pending | extracting | analyzing | completed | partial | need_upload | failed';

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_recipes_source_type ON recipes(user_id, source_type);
CREATE INDEX IF NOT EXISTS idx_recipes_confidence ON recipes(user_id, confidence);
