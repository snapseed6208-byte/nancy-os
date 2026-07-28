-- ============================================
-- Nancy OS — 002: Core OS Unified Data Model
-- 建立个人成长操作系统核心数据层
-- ============================================

-- ============================================
-- 1. Profiles 扩展 — 个人基础信息
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT[];

-- ============================================
-- 2. Goals 增强 — 长期目标系统
-- ============================================

-- 新增模块归属 + 量化指标字段
ALTER TABLE goals ADD COLUMN IF NOT EXISTS module TEXT;
-- 值: 'english' | 'health' | 'exam' | 'career' | 'personal' | 'finance'

ALTER TABLE goals ADD COLUMN IF NOT EXISTS target_metric TEXT;
-- 可量化目标值, 如: "7.0", "18%", "通过", "3 offers"

ALTER TABLE goals ADD COLUMN IF NOT EXISTS current_metric TEXT;
-- 当前值, 如: "6.5", "22%", "备考中", "1 offer"

ALTER TABLE goals ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS why TEXT;
-- 目标动机: "想要在澳洲工作", "改善体态健康"

ALTER TABLE goals ADD COLUMN IF NOT EXISTS parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;
-- 支持目标层级: 大目标 → 子目标

-- 新增 goal_milestones — 目标里程碑
CREATE TABLE IF NOT EXISTS goal_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_date DATE,
  completed_at TIMESTAMPTZ,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own goal_milestones"
  ON goal_milestones FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 3. Tasks 增强 — 统一任务系统 (所有模块共享)
-- ============================================

-- module 字段：明确任务所属模块
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS module TEXT;
-- 值: 'english' | 'health' | 'exam' | 'career' | 'life_admin' | 'learning'

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
-- 预估耗时（分钟）

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_minutes INTEGER;
-- 实际耗时（分钟）

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS energy_level TEXT DEFAULT 'medium';
-- 'low' (碎片时间可做) | 'medium' (需要专注) | 'high' (需要大块时间)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_today_focus BOOLEAN DEFAULT FALSE;
-- 今日焦点标记（每日最多 3 个）

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_rule TEXT;
-- 重复规则 (RFC 5545 RRULE 简化版): 'daily' | 'weekday' | 'weekly:mon,wed,fri' | 'monthly:15'

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';
-- 'manual' | 'ai_agent' | 'goal_breakdown' | 'habit_linked'

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_id UUID;
-- 来源记录 ID (如 goal_id, habit_id)

-- ============================================
-- 4. Habits 增强 — 习惯打卡系统
-- ============================================

ALTER TABLE habits ADD COLUMN IF NOT EXISTS streak_best INTEGER DEFAULT 0;
-- 历史最佳连续天数

ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_time TIME;
-- 提醒时间

ALTER TABLE habits ADD COLUMN IF NOT EXISTS module TEXT;
-- 关联模块: 'english' | 'health' | 'exam' | 'career' | 'personal'

-- habit_records 增加关联
ALTER TABLE habit_records ADD COLUMN IF NOT EXISTS energy_level SMALLINT;
-- 完成时的精力状态 (1-5)

-- ============================================
-- 5. Mood Records 增强 — 情绪追踪
-- ============================================

ALTER TABLE mood_records ADD COLUMN IF NOT EXISTS ai_analysis TEXT;
-- AI 情绪分析结果

ALTER TABLE mood_records ADD COLUMN IF NOT EXISTS related_factors TEXT[];
-- 影响因素: ['睡眠不足', '运动后', '完成任务']

-- ============================================
-- 6. Daily Review 增强 — 每日复盘 (成长闭环)
-- ============================================

ALTER TABLE daily_reviews ADD COLUMN IF NOT EXISTS tasks_completed_count INTEGER DEFAULT 0;
ALTER TABLE daily_reviews ADD COLUMN IF NOT EXISTS tasks_total_count INTEGER DEFAULT 0;
ALTER TABLE daily_reviews ADD COLUMN IF NOT EXISTS habits_completed_count INTEGER DEFAULT 0;
ALTER TABLE daily_reviews ADD COLUMN IF NOT EXISTS habits_total_count INTEGER DEFAULT 0;
ALTER TABLE daily_reviews ADD COLUMN IF NOT EXISTS focus_minutes INTEGER DEFAULT 0;
ALTER TABLE daily_reviews ADD COLUMN IF NOT EXISTS mood_avg REAL;
-- 当日情绪平均值 (1-5)

ALTER TABLE daily_reviews ADD COLUMN IF NOT EXISTS goal_progress JSONB DEFAULT '[]';
-- [{ goal_id, goal_title, progress_delta, note }]

ALTER TABLE daily_reviews ADD COLUMN IF NOT EXISTS tomorrow_plan JSONB DEFAULT '[]';
-- [{ title, module, priority, estimated_minutes }]

-- ============================================
-- 7. Resource Library — 统一资源库 (新增)
-- ============================================
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基本信息
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  platform TEXT,
  -- 'bilibili' | 'youtube' | 'douyin' | 'feishu' | 'web' | 'local' | 'other'

  -- 分类
  resource_type TEXT NOT NULL DEFAULT 'article',
  -- 'video' | 'article' | 'file' | 'course' | 'book' | 'tool' | 'other'

  module TEXT,
  -- 'english' | 'health' | 'exam' | 'career' | 'general'

  tags TEXT[],
  author TEXT,
  thumbnail_url TEXT,

  -- AI 处理结果
  ai_summary TEXT,
  ai_category TEXT,
  ai_tags TEXT[],

  -- 状态
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  read_progress REAL DEFAULT 0,
  -- 0.0 ~ 1.0

  -- 扩展数据 (类型特定字段)
  metadata JSONB DEFAULT '{}',
  -- video: { duration, quality }
  -- course: { provider, instructor, total_hours }
  -- book: { isbn, author, total_pages }
  -- article: { word_count, read_time }

  -- 关联
  related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resources_user_module ON resources(user_id, module);
CREATE INDEX idx_resources_user_type ON resources(user_id, resource_type);
CREATE INDEX idx_resources_user_favorite ON resources(user_id, is_favorite);
CREATE INDEX idx_resources_user_tags ON resources USING GIN(tags);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own resources"
  ON resources FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 8. Module Stats — 模块级统计快照 (新增)
-- ============================================
CREATE TABLE IF NOT EXISTS module_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  date DATE NOT NULL,

  -- 通用指标
  tasks_completed INTEGER DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,
  focus_minutes INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,

  -- 模块特定数据 (JSONB)
  stats_data JSONB DEFAULT '{}',
  -- english: { expressions_learned, speaking_sessions, reviews_done, avg_score }
  -- health: { workout_minutes, calories, protein_grams, weight }
  -- exam: { study_minutes, practice_tests, weak_areas[] }
  -- career: { applications, interviews, offers }
  -- general: { journal_entries, mood_avg, habits_done }

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, module, date)
);

ALTER TABLE module_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own module_stats"
  ON module_stats FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 9. Weekly Summaries — 周报 (新增)
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- AI 生成内容
  title TEXT,
  overview TEXT,
  highlights JSONB DEFAULT '[]',
  lowlights JSONB DEFAULT '[]',
  top_insight TEXT,

  -- 数据摘要
  tasks_completed INTEGER DEFAULT 0,
  habits_streak_days INTEGER DEFAULT 0,
  english_expressions_learned INTEGER DEFAULT 0,
  english_speaking_sessions INTEGER DEFAULT 0,
  workout_days INTEGER DEFAULT 0,
  mood_avg REAL,
  focus_hours REAL,

  -- 下周
  next_week_focus TEXT,
  next_week_plan JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own weekly_summaries"
  ON weekly_summaries FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 10. 新增缺失索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_module ON tasks(user_id, module);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_today_focus ON tasks(user_id, is_today_focus);
CREATE INDEX IF NOT EXISTS idx_goals_user_module ON goals(user_id, module);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_habits_user_module ON habits(user_id, module);
CREATE INDEX IF NOT EXISTS idx_habit_records_user_date ON habit_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_reviews_user_week ON daily_reviews(user_id, date);
CREATE INDEX IF NOT EXISTS idx_module_stats_user_date ON module_stats(user_id, date);
