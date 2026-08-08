-- ============================================
-- Migration 074: Material Training MVP (Phase 3)
-- Link sessions to resources for material-based
-- expression training. No new tables — extend
-- existing sessions + attempts tables.
-- ============================================

-- 1. Link sessions to knowledge base resource
ALTER TABLE chinese_speaking_sessions
ADD COLUMN IF NOT EXISTS material_resource_id UUID
REFERENCES resources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chinese_sessions_material
  ON chinese_speaking_sessions(material_resource_id)
  WHERE material_resource_id IS NOT NULL;

-- 2. Store material understanding evaluation per attempt
ALTER TABLE chinese_speaking_attempts
ADD COLUMN IF NOT EXISTS material_understanding JSONB;

COMMENT ON COLUMN chinese_speaking_attempts.material_understanding IS
'Material understanding evaluation: {accuracy_score, core_understanding, understood_correctly, misunderstanding, missing_material_points, personal_connection, transfer_quality}';

-- 3. Add RLS policy for resources created via Chinese Speaking module
-- (resources table already has user-scoped RLS; no change needed)
