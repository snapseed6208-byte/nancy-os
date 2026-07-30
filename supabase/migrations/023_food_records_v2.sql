-- ============================================
-- 023: Health OS 2.0 Phase A — Diet Tracking v2
-- Lightweight food logging + AI meal analysis
-- ============================================

-- 1. Add new columns to food_records (keep old columns as deprecated)
-- Old columns (carb, protein, vegetables, drink, health_feeling, checklist)
-- remain but are no longer used by the frontend.

ALTER TABLE food_records ADD COLUMN IF NOT EXISTS portion TEXT;

ALTER TABLE food_records ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]';

ALTER TABLE food_records ADD COLUMN IF NOT EXISTS feeling TEXT;

ALTER TABLE food_records ADD COLUMN IF NOT EXISTS record_time TIME;

-- 2. Comment on deprecated columns for documentation
COMMENT ON COLUMN food_records.carb IS 'deprecated: was used for qualitative carb description';
COMMENT ON COLUMN food_records.protein IS 'deprecated: was used for qualitative protein description';
COMMENT ON COLUMN food_records.vegetables IS 'deprecated: was used for qualitative vegetable description';
COMMENT ON COLUMN food_records.drink IS 'deprecated: was used for qualitative drink description';
COMMENT ON COLUMN food_records.health_feeling IS 'deprecated: replaced by feeling column';
COMMENT ON COLUMN food_records.checklist IS 'deprecated: replaced by health_checklists table (Phase C)';

COMMENT ON COLUMN food_records.portion IS 'User-entered portion e.g. 1碗, 半盘, 200g';
COMMENT ON COLUMN food_records.image_urls IS 'Food photos, up to 3 URLs';
COMMENT ON COLUMN food_records.feeling IS 'How user felt after eating: 饱/刚好/还饿/撑';
COMMENT ON COLUMN food_records.record_time IS 'Actual meal time for AI diet rhythm analysis';
