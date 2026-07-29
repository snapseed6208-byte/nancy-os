-- ============================================
-- 015: Content Intelligence System — resources table upgrade
-- Adds AI extraction fields for smart content parsing
-- ============================================

-- 1. Add AI extraction columns to resources
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ai_key_points JSONB DEFAULT '[]';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ai_action_items JSONB DEFAULT '[]';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS parse_status TEXT DEFAULT 'pending';

-- 2. Index for querying by content type
CREATE INDEX IF NOT EXISTS idx_resources_content_type ON resources(user_id, content_type) WHERE content_type IS NOT NULL;

-- 3. Add set_user_id_on_insert trigger for defense-in-depth
DROP TRIGGER IF EXISTS trg_set_user_id_resources ON resources;
CREATE TRIGGER trg_set_user_id_resources
  BEFORE INSERT ON resources
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id_on_insert();
