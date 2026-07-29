-- ============================================
-- 018: Fix habit_records status check constraint
-- Previous constraint rejected 'completed' — this fixes it
-- ============================================

ALTER TABLE habit_records DROP CONSTRAINT IF EXISTS habit_records_status_check;

ALTER TABLE habit_records ADD CONSTRAINT habit_records_status_check
  CHECK (status IN ('completed', 'skipped', 'missed'));
