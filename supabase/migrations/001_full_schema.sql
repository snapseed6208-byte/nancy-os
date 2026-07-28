-- Nancy OS — Full Database Schema
-- Run this in Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Profiles
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'Asia/Shanghai',
  language_preference TEXT DEFAULT 'zh',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own profile"
  ON profiles FOR ALL USING (auth.uid() = id);

-- ============================================
-- Goals
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own goals"
  ON goals FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Monthly Plans
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL,
  focus_area TEXT,
  theme TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

ALTER TABLE monthly_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own monthly_plans"
  ON monthly_plans FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Tasks
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  monthly_plan_id UUID REFERENCES monthly_plans(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  energy_cost TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tasks"
  ON tasks FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Habits
-- ============================================
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  category TEXT,
  target_days_per_week SMALLINT DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own habits"
  ON habits FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS habit_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  note TEXT,
  value REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(habit_id, date)
);

ALTER TABLE habit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own habit_records"
  ON habit_records FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- English OS: Expressions
-- ============================================
CREATE TABLE IF NOT EXISTS expressions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  english TEXT NOT NULL,
  chinese TEXT NOT NULL,
  type TEXT NOT NULL,
  pronunciation TEXT,
  example_sentence TEXT,
  scene TEXT NOT NULL DEFAULT 'daily life',
  usefulness_level SMALLINT NOT NULL DEFAULT 3 CHECK (usefulness_level BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'new',
  mastery_level SMALLINT DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
  next_review_date TIMESTAMPTZ,
  review_count INTEGER NOT NULL DEFAULT 0,
  last_review_result TEXT,
  streak INTEGER NOT NULL DEFAULT 0,
  source_text TEXT,
  notes TEXT,
  synonyms TEXT,
  english_explanation TEXT,
  native_usage TEXT,
  situation TEXT,
  formality TEXT,
  topic TEXT,
  imported_from TEXT,
  source TEXT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  fluency_score REAL,
  grammar_score REAL,
  vocabulary_score REAL,
  naturalness_score REAL,
  last_practiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expressions_user_id ON expressions(user_id);
CREATE INDEX idx_expressions_status ON expressions(user_id, status);
CREATE INDEX idx_expressions_next_review ON expressions(user_id, next_review_date);
CREATE INDEX idx_expressions_type ON expressions(user_id, type);
CREATE INDEX idx_expressions_scene ON expressions(user_id, scene);

ALTER TABLE expressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own expressions"
  ON expressions FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- English OS: Speaking
-- ============================================
CREATE TABLE IF NOT EXISTS speaking_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  context TEXT,
  expression_ids TEXT NOT NULL DEFAULT '[]',
  expressions_snapshot TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'saved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE speaking_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own speaking_sessions"
  ON speaking_sessions FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS speaking_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES speaking_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcribed_text TEXT,
  answer TEXT NOT NULL,
  natural_version TEXT NOT NULL,
  main_problems TEXT,
  useful_corrections TEXT,
  better_chunks TEXT,
  one_better_example TEXT,
  combined_feedback TEXT NOT NULL,
  fluency_score REAL,
  grammar_score REAL,
  vocabulary_score REAL,
  naturalness_score REAL,
  audio_url TEXT,
  audio_duration REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE speaking_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own speaking_attempts"
  ON speaking_attempts FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS expression_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expression_id UUID NOT NULL REFERENCES expressions(id) ON DELETE CASCADE,
  result TEXT NOT NULL,
  previous_interval INTEGER,
  new_interval INTEGER,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expression_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own expression_reviews"
  ON expression_reviews FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Learning Resources
-- ============================================
CREATE TABLE IF NOT EXISTS learning_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT,
  author TEXT,
  category TEXT,
  ai_summary TEXT,
  ai_category TEXT,
  tags TEXT[],
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE learning_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own learning_resources"
  ON learning_resources FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Health: Fitness
-- ============================================
CREATE TABLE IF NOT EXISTS body_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  height REAL,
  weight REAL,
  target_weight REAL,
  body_fat_percentage REAL,
  target_body_fat REAL,
  fitness_goal TEXT,
  focus_areas TEXT[],
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE body_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own body_profiles"
  ON body_profiles FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS workout_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  title TEXT,
  author TEXT,
  training_type TEXT,
  target_muscles TEXT[],
  difficulty TEXT,
  estimated_duration INTEGER,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workout_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout_videos"
  ON workout_videos FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS workout_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT,
  plan_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'planned',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout_plans"
  ON workout_plans FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS workout_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  exercise_name TEXT NOT NULL,
  sets_completed INTEGER,
  reps_per_set TEXT,
  weight_used REAL,
  duration_minutes INTEGER,
  perceived_effort SMALLINT CHECK (perceived_effort BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workout_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout_records"
  ON workout_records FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Health: Food
-- ============================================
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_url TEXT,
  source_platform TEXT,
  ingredients TEXT,
  steps TEXT,
  calories_per_serving INTEGER,
  protein_grams REAL,
  carbs_grams REAL,
  fat_grams REAL,
  category TEXT,
  meal_time TEXT[],
  health_level TEXT,
  budget_level TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own recipes"
  ON recipes FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS food_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL,
  food_name TEXT NOT NULL,
  carb TEXT,
  protein TEXT,
  vegetables TEXT,
  drink TEXT,
  fullness TEXT,
  health_feeling TEXT,
  checklist JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE food_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own food_records"
  ON food_records FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Journal & Mood
-- ============================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT,
  content TEXT,
  raw_transcript TEXT,
  mood TEXT,
  entry_type TEXT,
  energy_level TEXT,
  top_three JSONB DEFAULT '[]',
  todos JSONB DEFAULT '[]',
  ai_summary TEXT,
  ai_emotion_analysis TEXT,
  ai_keywords TEXT[],
  ai_events TEXT[],
  images TEXT[],
  audio_urls TEXT[],
  weather TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own journal_entries"
  ON journal_entries FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS mood_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_of_day TEXT,
  mood TEXT NOT NULL,
  intensity SMALLINT CHECK (intensity BETWEEN 1 AND 5),
  trigger_event TEXT,
  energy_level SMALLINT CHECK (energy_level BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mood_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own mood_records"
  ON mood_records FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Money
-- ============================================
CREATE TABLE IF NOT EXISTS money_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  necessity TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE money_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own money_records"
  ON money_records FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Weekly Themes
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weekly_goal TEXT,
  daily_action TEXT,
  minimum_standard TEXT,
  check_in_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  check_ins JSONB DEFAULT '[]',
  review JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE weekly_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own weekly_themes"
  ON weekly_themes FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Daily Reviews
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
  ai_growth_insight TEXT,
  ai_tomorrow_suggestion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE daily_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own daily_reviews"
  ON daily_reviews FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Ideas
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

-- ============================================
-- Career
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
  status TEXT NOT NULL DEFAULT 'saved',
  applied_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own jobs"
  ON jobs FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  round_number SMALLINT NOT NULL DEFAULT 1,
  interview_date TIMESTAMPTZ,
  interviewer TEXT,
  format TEXT,
  questions_asked TEXT[],
  self_assessment TEXT,
  ai_feedback TEXT,
  result TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own interviews"
  ON interviews FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- AI Agent
-- ============================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_acted_on BOOLEAN NOT NULL DEFAULT FALSE,
  generated_at DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ai_insights"
  ON ai_insights FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS news_digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source_type TEXT NOT NULL,
  source_name TEXT,
  title TEXT NOT NULL,
  url TEXT,
  summary TEXT NOT NULL,
  category TEXT,
  relevance_score REAL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_saved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE news_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own news_digests"
  ON news_digests FOR ALL USING (auth.uid() = user_id);
