-- ============================================
-- Nancy OS — 012: Health OS v2 + Daily Reflection
-- Health: Record System → Action System
-- Daily Review: Journal → AI Growth Reflection
-- ============================================

-- ── 1. daily_reviews: add mood tracking ──

ALTER TABLE daily_reviews
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS mood_intensity SMALLINT CHECK (mood_intensity BETWEEN 1 AND 5);

-- ── 2. workout_videos: add category for filtering ──

ALTER TABLE workout_videos
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN workout_videos.category IS '臀腿, 背部, 肩胸, 核心, 有氧, 拉伸';

CREATE INDEX IF NOT EXISTS idx_workout_videos_user_category
  ON workout_videos(user_id, category);

-- ── 3. recipes: add goal targeting ──

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS goal TEXT;

COMMENT ON COLUMN recipes.goal IS '减脂, 增肌, 保持';

CREATE INDEX IF NOT EXISTS idx_recipes_user_goal
  ON recipes(user_id, goal);

-- ── 4. meal_plans: weekly meal planning ──

CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  custom_meal TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start, day_of_week, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_user_week
  ON meal_plans(user_id, week_start);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own meal_plans"
  ON meal_plans FOR ALL USING (auth.uid() = user_id);

-- ── 5. Trigger defense for meal_plans ──

DROP TRIGGER IF EXISTS trg_set_user_id_meal_plans ON meal_plans;
CREATE TRIGGER trg_set_user_id_meal_plans
  BEFORE INSERT ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();
