-- ============================================
-- 053: Recurring Task Templates + Task Audit Fields
-- Enables template-based recurring task generation
-- and proper AI review → approved lifecycle.
-- ============================================

-- 1. Create recurring_task_templates table
CREATE TABLE IF NOT EXISTS recurring_task_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  module TEXT,
  estimated_minutes INTEGER,
  energy_level TEXT DEFAULT 'medium',
  time_slot TEXT,
  frequency_type TEXT NOT NULL CHECK (frequency_type IN ('daily', 'weekly', 'monthly')),
  target_count INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_type TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recurring_task_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own recurring_task_templates" ON recurring_task_templates;
CREATE POLICY "Users can manage own recurring_task_templates"
  ON recurring_task_templates FOR ALL USING (auth.uid() = user_id);

-- 2. Add template linkage + audit fields to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS template_id UUID
  REFERENCES recurring_task_templates(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS instance_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_template_date
  ON tasks(template_id, instance_date);
CREATE INDEX IF NOT EXISTS idx_tasks_approved_at
  ON tasks(user_id, approved_at);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_user
  ON recurring_task_templates(user_id, is_active);

-- Verify
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('recurring_task_templates', 'tasks')
  AND column_name IN ('template_id', 'instance_date', 'approved_at',
                      'frequency_type', 'target_count', 'is_active')
ORDER BY table_name, ordinal_position;
