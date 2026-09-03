-- ============================================
-- Habit Lab: 21-Day Atomic Habits Sprint Engine
--
-- A personal behavior experiment system, distinct from the
-- generic streak-tracker (habits/habit_records).
--
-- Core invariants:
--  * Day X is derived from habit_sprints.start_date (Asia/Shanghai
--    business date), NEVER from completion logs.
--  * One log per calendar day per sprint (UNIQUE(sprint_id, date)).
--  * Missed days are inferred (absence of a log), not stored.
--  * Only 'completed' / 'skipped' are stored as explicit states.
-- ============================================

-- ═══════════════════════════════════════
-- 1. Habit Sprints (the experiment)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.habit_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'BookOpen',

  -- The natural-language cue sentence built from trigger + action,
  -- e.g. "喝完晨间咖啡后，我会打开书读一页" (habit stacking).
  cue_sentence TEXT NOT NULL,
  trigger TEXT,
  location TEXT,

  -- Minimum version of the habit (the smallest action that counts)
  minimum_action TEXT NOT NULL,

  -- Identity statement, e.g. "我是一个读者"
  identity_statement TEXT,

  -- Schedule
  duration_days INTEGER NOT NULL DEFAULT 21,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habit_sprints_user_status
  ON public.habit_sprints(user_id, status);
CREATE INDEX IF NOT EXISTS idx_habit_sprints_user_created
  ON public.habit_sprints(user_id, created_at DESC);

-- ═══════════════════════════════════════
-- 2. Habit Sprint Logs (daily outcomes)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.habit_sprint_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID NOT NULL REFERENCES public.habit_sprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Beijing business date (YYYY-MM-DD) this log belongs to
  date DATE NOT NULL,

  -- Explicit states only; missed is absence of a row
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'skipped')),

  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One outcome per calendar day per sprint
  CONSTRAINT habit_sprint_logs_sprint_date_unique UNIQUE (sprint_id, date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_sprint
  ON public.habit_sprint_logs(sprint_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date
  ON public.habit_sprint_logs(user_id, date);

-- ═══════════════════════════════════════
-- 3. Habit Rewards (milestone shelf)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.habit_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Star',
  points_required INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'redeemed')),
  redeemed_at TIMESTAMPTZ,
  sort_order SMALLINT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habit_rewards_user
  ON public.habit_rewards(user_id, status);

-- ═══════════════════════════════════════
-- 4. Habit Sprint Reviews (21-day retrospective)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.habit_sprint_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID NOT NULL UNIQUE REFERENCES public.habit_sprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Snapshot of the completed sprint outcome
  completed_days INTEGER NOT NULL DEFAULT 0,
  total_days INTEGER NOT NULL DEFAULT 21,
  completion_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,

  -- Three review questions
  easiest_context TEXT,
  primary_friction TEXT,
  next_action TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habit_reviews_user
  ON public.habit_sprint_reviews(user_id);

-- ═══════════════════════════════════════
-- 5. Row Level Security
-- ═══════════════════════════════════════

ALTER TABLE public.habit_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_sprint_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_sprint_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own habit sprints" ON public.habit_sprints;
DROP POLICY IF EXISTS "Users manage own habit sprint logs" ON public.habit_sprint_logs;
DROP POLICY IF EXISTS "Users manage own habit rewards" ON public.habit_rewards;
DROP POLICY IF EXISTS "Users manage own habit sprint reviews" ON public.habit_sprint_reviews;

CREATE POLICY "Users manage own habit sprints" ON public.habit_sprints
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own habit sprint logs" ON public.habit_sprint_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own habit rewards" ON public.habit_rewards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own habit sprint reviews" ON public.habit_sprint_reviews
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- 6. Updated-at triggers
-- ═══════════════════════════════════════

DROP TRIGGER IF EXISTS trg_habit_sprints_updated_at ON public.habit_sprints;
CREATE TRIGGER trg_habit_sprints_updated_at
  BEFORE UPDATE ON public.habit_sprints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_habit_sprint_logs_updated_at ON public.habit_sprint_logs;
CREATE TRIGGER trg_habit_sprint_logs_updated_at
  BEFORE UPDATE ON public.habit_sprint_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_habit_rewards_updated_at ON public.habit_rewards;
CREATE TRIGGER trg_habit_rewards_updated_at
  BEFORE UPDATE ON public.habit_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
