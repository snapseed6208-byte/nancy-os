-- ============================================
-- 021: Recurring Task Model
-- Distinguish one-time tasks from recurring tasks
-- Add completion tracking records table
-- ============================================

-- 1. Add task type and frequency columns to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'one_time'
  CHECK (task_type IN ('one_time', 'recurring'));

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS frequency_type TEXT
  CHECK (frequency_type IN ('daily', 'weekly', 'monthly'));

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_count SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_count SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cycle_start_date DATE;

-- 2. Create task_completion_records table
CREATE TABLE IF NOT EXISTS task_completion_records (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completion_date DATE NOT NULL
);

ALTER TABLE task_completion_records ENABLE ROW LEVEL SECURITY;

-- 3. RLS policy (drop first to be idempotent)
DROP POLICY IF EXISTS "Users can manage own task_completion_records" ON task_completion_records;

CREATE POLICY "Users can manage own task_completion_records"
  ON task_completion_records FOR ALL USING (auth.uid() = user_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_task_completions_task
  ON task_completion_records(task_id, completion_date);

CREATE INDEX IF NOT EXISTS idx_task_completions_user_date
  ON task_completion_records(user_id, completion_date);

CREATE INDEX IF NOT EXISTS idx_tasks_type
  ON tasks(user_id, task_type);

-- 5. Trigger for user_id
DROP TRIGGER IF EXISTS trg_set_user_id_task_completion_records ON task_completion_records;

CREATE TRIGGER trg_set_user_id_task_completion_records
  BEFORE INSERT ON task_completion_records
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();
