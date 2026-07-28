-- ============================================
-- Nancy OS — Phase 3.98: Habit OS + Task Intelligence
-- ============================================

-- 1. Add time_slot to tasks for morning/afternoon/evening scheduling
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_slot TEXT;

-- 2. Add indexes for habit queries
CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_habit_records_user_date ON habit_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_time_slot ON tasks(user_id, time_slot) WHERE time_slot IS NOT NULL;

-- 3. Add ai_review_status to tasks for AI-generated task review mechanism
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_review_status TEXT DEFAULT NULL;
-- NULL = manual task, 'pending' = needs review, 'confirmed' = reviewed & accepted, 'edited' = reviewed & modified
