-- Nancy OS — Phase 1.5 修复
-- 缺失字段 + 缺失索引

-- ============================================
-- 缺失字段
-- ============================================

-- expressions: AI 溯源字段
ALTER TABLE expressions ADD COLUMN IF NOT EXISTS ai_model TEXT;
ALTER TABLE expressions ADD COLUMN IF NOT EXISTS ai_prompt_version TEXT;

-- speaking_attempts: AI 溯源字段
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS ai_model TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS ai_prompt_version TEXT;

-- ============================================
-- 缺失索引 — 高频查询优化
-- ============================================

-- journal_entries: 按日期范围查询（时间线视图）
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date
  ON journal_entries(user_id, date);

-- mood_records: 趋势图日期范围查询
CREATE INDEX IF NOT EXISTS idx_mood_records_user_date
  ON mood_records(user_id, date);

-- food_records: 每日饮食查询
CREATE INDEX IF NOT EXISTS idx_food_records_user_date
  ON food_records(user_id, date);

-- tasks: 按状态筛选
CREATE INDEX IF NOT EXISTS idx_tasks_user_status
  ON tasks(user_id, status);

-- speaking_attempts: 按会话查询所有尝试
CREATE INDEX IF NOT EXISTS idx_speaking_attempts_session
  ON speaking_attempts(session_id);

-- expression_reviews: 按表达查复习历史
CREATE INDEX IF NOT EXISTS idx_expression_reviews_expression
  ON expression_reviews(expression_id);

-- learning_resources: 按分类查询 (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'learning_resources') THEN
    CREATE INDEX IF NOT EXISTS idx_learning_resources_user_category
      ON learning_resources(user_id, category);
  END IF;
END $$;

-- ai_insights: 按 agent 类型 + 日期查最新的洞察
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_agent_date
  ON ai_insights(user_id, agent_type, generated_at);
