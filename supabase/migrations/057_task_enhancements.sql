-- ============================================
-- 057: Task Enhancements
-- 1. Planning window: start_date (when to start)
-- 2. Time slots for future calendar/AI scheduling
-- 3. Verify recurring task records table
-- ============================================

-- ── 1. Planning window ──
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;

-- ── 2. Scheduled time slots ──
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_time_start TIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_time_end TIME;

-- ── 3. Ensure task_completion_records exists (idempotent) ──
CREATE TABLE IF NOT EXISTS task_completion_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, completion_date)
);

ALTER TABLE task_completion_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own task_completion_records" ON task_completion_records;
CREATE POLICY "Users can manage own task_completion_records"
  ON task_completion_records FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_completion_records_date
  ON task_completion_records(task_id, completion_date);

-- ── Verify ──
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND column_name IN ('start_date', 'scheduled_time_start', 'scheduled_time_end')
ORDER BY ordinal_position;
