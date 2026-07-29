-- ============================================
-- 017: Habit OS Intelligence
-- Adds habit_analyses table for AI-powered insights
-- ============================================

-- 1. Habit analyses table
CREATE TABLE IF NOT EXISTS habit_analyses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id      UUID REFERENCES habits(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL DEFAULT 'overall'
                  CHECK (analysis_type IN ('overall', 'habit_specific')),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  summary       TEXT,
  strengths     TEXT[] DEFAULT '{}',
  suggestions   TEXT[] DEFAULT '{}',
  motivation    TEXT,
  stats         JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE habit_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own habit_analyses' AND tablename = 'habit_analyses'
  ) THEN
    CREATE POLICY "Users can manage own habit_analyses"
      ON habit_analyses FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_habit_analyses_user ON habit_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_habit_analyses_habit ON habit_analyses(habit_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_set_user_id_habit_analyses ON habit_analyses;
CREATE TRIGGER trg_set_user_id_habit_analyses
  BEFORE INSERT ON habit_analyses
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();
