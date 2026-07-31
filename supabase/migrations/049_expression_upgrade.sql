-- ============================================
-- 049: expression_upgrade JSONB column
-- Stores AI-generated expression upgrades from
-- speaking feedback for the Expression Bank loop.
-- ============================================

ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS expression_upgrade JSONB DEFAULT '[]';

-- Verify
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'speaking_attempts'
  AND column_name = 'expression_upgrade';
