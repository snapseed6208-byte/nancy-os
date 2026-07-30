-- ============================================
-- Migration 034: Recipe Intelligence v2
-- Add structured recipe columns + AI tracking
-- ============================================

-- 1. Structured ingredients (preserve legacy TEXT column)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS ingredients_json JSONB DEFAULT '[]';
COMMENT ON COLUMN recipes.ingredients_json IS 'JSONB 数组: [{"name":"鸡胸肉","amount":"200g","category":"蛋白质"}]';

-- 2. Structured steps (preserve legacy TEXT column)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS steps_json JSONB DEFAULT '[]';
COMMENT ON COLUMN recipes.steps_json IS 'JSONB 数组: [{"order":1,"text":"藜麦洗净煮15分钟","duration":15}]';

-- 3. Cooking tracking
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cook_count INTEGER DEFAULT 0;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS last_cooked_at TIMESTAMPTZ;
COMMENT ON COLUMN recipes.cook_count IS '烹饪次数 — 每次从食谱添加到饮食记录时 +1';
COMMENT ON COLUMN recipes.last_cooked_at IS '最近一次烹饪时间';

-- 4. AI analysis tracking
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS ai_analysis_status TEXT DEFAULT 'pending';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS ai_summary TEXT;
COMMENT ON COLUMN recipes.ai_analysis_status IS 'pending | completed | failed';
COMMENT ON COLUMN recipes.ai_summary IS 'AI 食谱分析摘要';

-- 5. Goal upgrade: TEXT → TEXT[] (support multiple goals)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'goal' AND data_type = 'text'
  ) THEN
    ALTER TABLE recipes ALTER COLUMN goal TYPE TEXT[] USING
      CASE WHEN goal IS NOT NULL AND goal != '' THEN ARRAY[goal] ELSE NULL END;
  END IF;
END $$;
COMMENT ON COLUMN recipes.goal IS '目标数组: 减脂/增肌/保持';

-- 6. Indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_recipes_ai_status ON recipes(user_id, ai_analysis_status);
CREATE INDEX IF NOT EXISTS idx_recipes_cook_count ON recipes(user_id, cook_count DESC);
