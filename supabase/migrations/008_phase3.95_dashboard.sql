-- ============================================
-- Nancy OS — 008: Phase 3.95 Dashboard Data Layer
-- Agent feedback table + dashboard indexes
-- ============================================

-- ============================================
-- 1. Agent Feedback table
-- ============================================

CREATE TABLE IF NOT EXISTS agent_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  agent_type TEXT NOT NULL,
  -- 'daily_brief' | 'reflection' | 'career' | 'coach' | etc.

  reference_id UUID,
  -- brief_id, insight_id, memory_id, etc.

  rating TEXT NOT NULL,
  -- 'helpful' | 'not_helpful'

  reason TEXT,
  -- 可选：用户为什么觉得 helpful / not helpful

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_user
  ON agent_feedback(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_ref
  ON agent_feedback(reference_id);

-- ============================================
-- 2. Dashboard performance indexes
-- ============================================

-- Tasks: today's tasks lookup (used every dashboard load)
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date ON tasks(user_id, due_date)
  WHERE status != 'done';

-- Habit records: today's habits lookup
CREATE INDEX IF NOT EXISTS idx_habit_records_user_date ON habit_records(user_id, date);

-- Mood records: today's mood lookup
CREATE INDEX IF NOT EXISTS idx_mood_records_user_date ON mood_records(user_id, date);

-- ============================================
-- 3. RLS
-- ============================================

ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own agent_feedback"
  ON agent_feedback FOR ALL USING (auth.uid() = user_id);
