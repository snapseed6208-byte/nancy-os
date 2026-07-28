-- ============================================
-- Nancy OS — 007: Phase 3.9 AI Daily Brief
-- Daily AI-powered dashboard briefs
-- ============================================

-- ============================================
-- 1. AI Daily Briefs table
-- ============================================

CREATE TABLE IF NOT EXISTS ai_daily_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  date DATE NOT NULL,

  summary TEXT,
  -- 昨日总结 (yesterday_summary)

  focus TEXT,
  -- 今日重点 (today_focus)

  suggestions JSONB DEFAULT '[]',
  -- 个性化建议 [{ suggestion: string, priority: "high"|"medium"|"low" }]

  warnings JSONB DEFAULT '[]',
  -- 提醒/警告 [{ type: string, message: string }]

  motivation TEXT,
  -- 今日激励语

  memory_refs UUID[] DEFAULT '{}',
  -- 引用的 confirmed memory IDs

  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One brief per user per day
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ai_daily_briefs_user_date
  ON ai_daily_briefs(user_id, date DESC);

-- ============================================
-- 2. RLS
-- ============================================

ALTER TABLE ai_daily_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own daily_briefs"
  ON ai_daily_briefs FOR ALL USING (auth.uid() = user_id);
