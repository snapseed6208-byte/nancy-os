-- ============================================
-- Nancy OS — Production Database Schema v1.0
-- Single-execution deployment for fresh Supabase project
-- Generated: 2026-07-29
-- ============================================
-- Execute this entire file in Supabase SQL Editor.
-- All statements use IF NOT EXISTS / IF EXISTS — safe to re-run.
-- ============================================

-- ── Extension ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Trigger Function: auto-fill user_id on INSERT (defense-in-depth) ──
CREATE OR REPLACE FUNCTION set_user_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 1. profiles
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'Asia/Shanghai',
  language_preference TEXT DEFAULT 'zh',
  career_field TEXT,
  industry TEXT,
  bio TEXT,
  birth_date DATE,
  phone TEXT,
  social_links JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  life_theme TEXT,
  energy_pattern JSONB DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT false,
  current_milestone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own profile"
  ON profiles FOR ALL USING (auth.uid() = id);


-- ============================================
-- 2. goals
-- ============================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  progress REAL DEFAULT 0,
  goal_level TEXT,
  goal_category TEXT,
  target_metric TEXT,
  current_metric TEXT,
  why TEXT,
  parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  module TEXT,
  start_date DATE,
  icon TEXT,
  color TEXT,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own goals"
  ON goals FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);

DROP TRIGGER IF EXISTS trg_set_user_id_goals ON goals;
CREATE TRIGGER trg_set_user_id_goals
  BEFORE INSERT ON goals
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 3. tasks
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  monthly_plan_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  module TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  energy_cost TEXT DEFAULT 'medium' CHECK (energy_cost IN ('high','medium','low')),
  energy_level TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  due_date DATE,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  is_today_focus BOOLEAN DEFAULT false,
  recurring_rule TEXT,
  source_type TEXT,
  source_id UUID,
  ai_review_status TEXT DEFAULT 'pending' CHECK (ai_review_status IN ('pending','reviewed','dismissed')),
  time_slot TEXT CHECK (time_slot IN ('morning','afternoon','evening','anytime')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tasks"
  ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id);

DROP TRIGGER IF EXISTS trg_set_user_id_tasks ON tasks;
CREATE TRIGGER trg_set_user_id_tasks
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 4. habits
-- ============================================
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  category TEXT,
  module TEXT,
  target_days_per_week SMALLINT DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  streak_best INTEGER DEFAULT 0,
  reminder_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own habits"
  ON habits FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id, is_active);

DROP TRIGGER IF EXISTS trg_set_user_id_habits ON habits;
CREATE TRIGGER trg_set_user_id_habits
  BEFORE INSERT ON habits
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 5. habit_records
-- ============================================
CREATE TABLE IF NOT EXISTS habit_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('done','skipped','pending','partial')),
  note TEXT,
  value DECIMAL,
  energy_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(habit_id, date)
);
ALTER TABLE habit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own habit_records"
  ON habit_records FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_habit_records_user_date ON habit_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_records_habit_date ON habit_records(habit_id, date);

DROP TRIGGER IF EXISTS trg_set_user_id_habit_records ON habit_records;
CREATE TRIGGER trg_set_user_id_habit_records
  BEFORE INSERT ON habit_records
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 6. expressions (English OS)
-- ============================================
CREATE TABLE IF NOT EXISTS expressions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  english TEXT NOT NULL,
  chinese TEXT,
  type TEXT,
  status TEXT DEFAULT 'learning' CHECK (status IN ('new','learning','familiar','mastered')),
  scene TEXT,
  topic TEXT,
  pronunciation TEXT,
  example_sentence TEXT,
  source TEXT,
  notes TEXT,
  archived BOOLEAN DEFAULT false,
  mastery_level TEXT DEFAULT 'beginner',
  streak INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  last_review_result TEXT,
  next_review_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE expressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own expressions"
  ON expressions FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_expressions_user_status ON expressions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_expressions_next_review ON expressions(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_expressions_archived ON expressions(user_id, archived);

DROP TRIGGER IF EXISTS trg_set_user_id_expressions ON expressions;
CREATE TRIGGER trg_set_user_id_expressions
  BEFORE INSERT ON expressions
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 7. expression_reviews
-- ============================================
CREATE TABLE IF NOT EXISTS expression_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expression_id UUID NOT NULL REFERENCES expressions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('forgot','hard','good','easy')),
  previous_interval INTEGER,
  new_interval INTEGER,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE expression_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own expression_reviews"
  ON expression_reviews FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_expression_reviews_user_date ON expression_reviews(user_id, reviewed_at);

DROP TRIGGER IF EXISTS trg_set_user_id_expression_reviews ON expression_reviews;
CREATE TRIGGER trg_set_user_id_expression_reviews
  BEFORE INSERT ON expression_reviews
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 8. speaking_sessions
-- ============================================
CREATE TABLE IF NOT EXISTS speaking_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT,
  context TEXT,
  expression_ids UUID[],
  scenario TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE speaking_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own speaking_sessions"
  ON speaking_sessions FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_speaking_sessions_user_date ON speaking_sessions(user_id, created_at);

DROP TRIGGER IF EXISTS trg_set_user_id_speaking_sessions ON speaking_sessions;
CREATE TRIGGER trg_set_user_id_speaking_sessions
  BEFORE INSERT ON speaking_sessions
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 9. speaking_attempts
-- ============================================
CREATE TABLE IF NOT EXISTS speaking_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES speaking_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer TEXT,
  transcribed_text TEXT,
  natural_version TEXT,
  main_problems TEXT,
  combined_feedback TEXT,
  fluency_score DECIMAL(3,1),
  grammar_score DECIMAL(3,1),
  vocabulary_score DECIMAL(3,1),
  naturalness_score DECIMAL(3,1),
  one_better_example TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE speaking_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own speaking_attempts"
  ON speaking_attempts FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_set_user_id_speaking_attempts ON speaking_attempts;
CREATE TRIGGER trg_set_user_id_speaking_attempts
  BEFORE INSERT ON speaking_attempts
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 10. ideas
-- ============================================
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT,
  ai_category TEXT,
  status TEXT NOT NULL DEFAULT 'inbox',
  related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ideas"
  ON ideas FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_set_user_id_ideas ON ideas;
CREATE TRIGGER trg_set_user_id_ideas
  BEFORE INSERT ON ideas
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 11. journal_entries
-- ============================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT,
  content TEXT,
  mood TEXT,
  energy_level TEXT,
  weather TEXT,
  location TEXT,
  top_three JSONB DEFAULT '[]',
  todos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own journal_entries"
  ON journal_entries FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON journal_entries(user_id, date);

DROP TRIGGER IF EXISTS trg_set_user_id_journal_entries ON journal_entries;
CREATE TRIGGER trg_set_user_id_journal_entries
  BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 12. mood_records
-- ============================================
CREATE TABLE IF NOT EXISTS mood_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mood TEXT NOT NULL,
  intensity SMALLINT CHECK (intensity BETWEEN 1 AND 5),
  trigger_event TEXT,
  time_of_day TEXT,
  energy_level TEXT,
  ai_analysis TEXT,
  related_factors JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE mood_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own mood_records"
  ON mood_records FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_mood_records_user_date ON mood_records(user_id, date);

DROP TRIGGER IF EXISTS trg_set_user_id_mood_records ON mood_records;
CREATE TRIGGER trg_set_user_id_mood_records
  BEFORE INSERT ON mood_records
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 13. money_records
-- ============================================
CREATE TABLE IF NOT EXISTS money_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense','income')),
  category TEXT,
  necessity TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE money_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own money_records"
  ON money_records FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_money_records_user_date ON money_records(user_id, date);

DROP TRIGGER IF EXISTS trg_set_user_id_money_records ON money_records;
CREATE TRIGGER trg_set_user_id_money_records
  BEFORE INSERT ON money_records
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 14. daily_reviews
-- ============================================
CREATE TABLE IF NOT EXISTS daily_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  q1_what_done TEXT,
  q2_best_thing TEXT,
  q3_what_chaos TEXT,
  q4_tomorrow_first TEXT,
  q5_spending TEXT,
  daily_log TEXT,
  mood TEXT,
  mood_intensity SMALLINT CHECK (mood_intensity BETWEEN 1 AND 5),
  ai_growth_insight TEXT,
  ai_tomorrow_suggestion TEXT,
  tasks_completed_count INTEGER DEFAULT 0,
  tasks_total_count INTEGER DEFAULT 0,
  habits_completed_count INTEGER DEFAULT 0,
  habits_total_count INTEGER DEFAULT 0,
  focus_minutes INTEGER DEFAULT 0,
  mood_avg DECIMAL(3,1),
  goal_progress JSONB DEFAULT '{}',
  tomorrow_plan JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);
ALTER TABLE daily_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own daily_reviews"
  ON daily_reviews FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reviews_user_date ON daily_reviews(user_id, date);


-- ============================================
-- 15. weekly_summaries
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE,
  title TEXT NOT NULL,
  overview TEXT,
  highlights TEXT,
  lowlights TEXT,
  top_insight TEXT,
  tasks_completed INTEGER DEFAULT 0,
  habits_streak_days INTEGER DEFAULT 0,
  english_expressions_learned INTEGER DEFAULT 0,
  english_speaking_sessions INTEGER DEFAULT 0,
  workout_days INTEGER DEFAULT 0,
  mood_avg DECIMAL(3,1),
  focus_hours DECIMAL(4,1) DEFAULT 0,
  next_week_focus TEXT,
  next_week_plan JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own weekly_summaries"
  ON weekly_summaries FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_week ON weekly_summaries(user_id, week_start);


-- ============================================
-- 16. weekly_themes
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID,
  title TEXT NOT NULL,
  category TEXT,
  icon TEXT,
  color TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weekly_goal TEXT,
  daily_action TEXT,
  minimum_standard TEXT,
  check_in_type TEXT DEFAULT 'simple',
  status TEXT NOT NULL DEFAULT 'active',
  check_ins JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE weekly_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own weekly_themes"
  ON weekly_themes FOR ALL USING (auth.uid() = user_id);


-- ============================================
-- 17. events
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  category TEXT,
  description TEXT,
  emotion TEXT,
  reflection TEXT,
  related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own events"
  ON events FOR ALL USING (auth.uid() = user_id);


-- ============================================
-- 18. ai_memories
-- ============================================
CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type TEXT,
  title TEXT,
  content TEXT NOT NULL,
  category TEXT,
  importance TEXT DEFAULT 'medium',
  confidence DECIMAL(3,2) DEFAULT 0.5,
  source TEXT,
  source_ids JSONB DEFAULT '[]',
  source_date DATE,
  related_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  evidence JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate','probable','confirmed','rejected','expired','pending_review')),
  is_active BOOLEAN DEFAULT true,
  reinforcement_count INTEGER DEFAULT 1,
  last_reinforced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ai_memories"
  ON ai_memories FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_active ON ai_memories(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_status ON ai_memories(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_memories_dedup
  ON ai_memories(user_id, memory_type, status);


-- ============================================
-- 19. memory_feedback
-- ============================================
CREATE TABLE IF NOT EXISTS memory_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_id UUID REFERENCES ai_memories(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('confirm','reject','modify','skip')),
  reason TEXT,
  modified_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE memory_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own memory_feedback"
  ON memory_feedback FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_set_user_id_memory_feedback ON memory_feedback;
CREATE TRIGGER trg_set_user_id_memory_feedback
  BEFORE INSERT ON memory_feedback
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 20. agent_feedback
-- ============================================
CREATE TABLE IF NOT EXISTS agent_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  reference_id UUID,
  rating TEXT CHECK (rating IN ('up','down','neutral')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own agent_feedback"
  ON agent_feedback FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_set_user_id_agent_feedback ON agent_feedback;
CREATE TRIGGER trg_set_user_id_agent_feedback
  BEFORE INSERT ON agent_feedback
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 21. ai_daily_briefs
-- ============================================
CREATE TABLE IF NOT EXISTS ai_daily_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  summary TEXT,
  focus TEXT,
  suggestions JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  motivation TEXT,
  memory_refs JSONB DEFAULT '[]',
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ai_daily_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ai_daily_briefs"
  ON ai_daily_briefs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ai_daily_briefs_user_date ON ai_daily_briefs(user_id, date);


-- ============================================
-- 22. ai_insights
-- ============================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  insight_type TEXT,
  title TEXT,
  content TEXT,
  data JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ai_insights"
  ON ai_insights FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_agent ON ai_insights(user_id, agent_type, generated_at);


-- ============================================
-- 23. agent_logs
-- ============================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  action TEXT,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  model TEXT,
  model_version TEXT,
  tokens_used INTEGER,
  related_goal_id UUID,
  related_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own agent_logs"
  ON agent_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user_agent ON agent_logs(user_id, agent_type, created_at);


-- ============================================
-- 24. jobs (Career)
-- ============================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  position TEXT NOT NULL,
  jd_text TEXT,
  jd_url TEXT,
  salary_range TEXT,
  location TEXT,
  industry TEXT,
  status TEXT NOT NULL DEFAULT 'saved'
    CHECK (status IN ('saved','applied','interviewing','offered','rejected','accepted','withdrawn')),
  applied_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own jobs"
  ON jobs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status);


-- ============================================
-- 25. interviews
-- ============================================
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  round_number SMALLINT DEFAULT 1,
  interview_date DATE,
  interviewer TEXT,
  format TEXT,
  questions_asked TEXT,
  self_assessment TEXT,
  ai_feedback TEXT,
  result TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own interviews"
  ON interviews FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job ON interviews(job_id);


-- ============================================
-- 26. resources
-- ============================================
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  platform TEXT,
  resource_type TEXT,
  module TEXT,
  tags JSONB DEFAULT '[]',
  author TEXT,
  thumbnail_url TEXT,
  ai_summary TEXT,
  ai_category TEXT,
  ai_tags JSONB DEFAULT '[]',
  is_favorite BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  read_progress DECIMAL(3,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own resources"
  ON resources FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_resources_user_archived ON resources(user_id, is_archived);


-- ============================================
-- 27. body_profiles (Health)
-- ============================================
CREATE TABLE IF NOT EXISTS body_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  height DECIMAL(5,1),
  weight DECIMAL(5,1),
  target_weight DECIMAL(5,1),
  body_fat_percentage DECIMAL(4,1),
  target_body_fat DECIMAL(4,1),
  fitness_goal TEXT,
  focus_areas JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
ALTER TABLE body_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own body_profiles"
  ON body_profiles FOR ALL USING (auth.uid() = user_id);


-- ============================================
-- 28. workout_videos
-- ============================================
CREATE TABLE IF NOT EXISTS workout_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  platform TEXT,
  title TEXT,
  author TEXT,
  training_type TEXT,
  target_muscles JSONB DEFAULT '[]',
  category TEXT,
  difficulty TEXT CHECK (difficulty IN ('初级','中级','高级')),
  estimated_duration INTEGER,
  is_favorite BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE workout_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout_videos"
  ON workout_videos FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_workout_videos_user_category ON workout_videos(user_id, category);


-- ============================================
-- 29. workout_records
-- ============================================
CREATE TABLE IF NOT EXISTS workout_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID,
  date DATE NOT NULL,
  exercise_name TEXT NOT NULL,
  sets_completed INTEGER,
  reps_per_set JSONB DEFAULT '[]',
  weight_used DECIMAL(5,1),
  duration_minutes INTEGER,
  perceived_effort SMALLINT CHECK (perceived_effort BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE workout_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout_records"
  ON workout_records FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_workout_records_user_date ON workout_records(user_id, date);


-- ============================================
-- 30. recipes
-- ============================================
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  source_platform TEXT,
  ingredients TEXT,
  steps TEXT,
  calories_per_serving DECIMAL(6,1),
  protein_grams DECIMAL(5,1),
  carbs_grams DECIMAL(5,1),
  fat_grams DECIMAL(5,1),
  category TEXT,
  meal_time JSONB DEFAULT '[]',
  goal TEXT,
  health_level TEXT,
  budget_level TEXT,
  is_favorite BOOLEAN DEFAULT false,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own recipes"
  ON recipes FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_user_goal ON recipes(user_id, goal);


-- ============================================
-- 31. food_records
-- ============================================
CREATE TABLE IF NOT EXISTS food_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack','drink')),
  food_name TEXT NOT NULL,
  carb TEXT,
  protein TEXT,
  vegetables TEXT,
  drink TEXT,
  fullness SMALLINT CHECK (fullness BETWEEN 1 AND 10),
  health_feeling TEXT,
  checklist JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE food_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own food_records"
  ON food_records FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_food_records_user_date ON food_records(user_id, date);


-- ============================================
-- 32. meal_plans
-- ============================================
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner')),
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  custom_meal TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start, day_of_week, meal_type)
);
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own meal_plans"
  ON meal_plans FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_week ON meal_plans(user_id, week_start);

DROP TRIGGER IF EXISTS trg_set_user_id_meal_plans ON meal_plans;
CREATE TRIGGER trg_set_user_id_meal_plans
  BEFORE INSERT ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 33. exams
-- ============================================
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'self_study'
    CHECK (category IN ('ielts','course','certificate','self_study')),
  target_score TEXT,
  exam_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','paused')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own exams"
  ON exams FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_exams_user_status ON exams(user_id, status);

DROP TRIGGER IF EXISTS trg_set_user_id_exams ON exams;
CREATE TRIGGER trg_set_user_id_exams
  BEFORE INSERT ON exams
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 34. study_sessions
-- ============================================
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  topic TEXT,
  score DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own study_sessions"
  ON study_sessions FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON study_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_study_sessions_exam ON study_sessions(exam_id);

DROP TRIGGER IF EXISTS trg_set_user_id_study_sessions ON study_sessions;
CREATE TRIGGER trg_set_user_id_study_sessions
  BEFORE INSERT ON study_sessions
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- COMPLETE (34 tables)
-- ============================================
-- Storage buckets must be created manually in Supabase Dashboard:
--   1. speaking-audio  (for English speaking recordings)
--   2. capture-images  (for Life Trace photo captures)
--   3. capture-audio   (for Life Trace voice captures)
-- ============================================
