-- ============================================
-- Phase 3.5 Hotfix: Missing user_id indexes
-- Tables without indexes were doing sequential scans
-- on every user-scoped query.
-- ============================================

-- Core activity tables
CREATE INDEX IF NOT EXISTS idx_speaking_attempts_user
  ON speaking_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_expression_reviews_user
  ON expression_reviews(user_id);

-- Planning & tracking
CREATE INDEX IF NOT EXISTS idx_weekly_themes_user
  ON weekly_themes(user_id);

CREATE INDEX IF NOT EXISTS idx_jobs_user
  ON jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_interviews_user
  ON interviews(user_id);

-- Health
CREATE INDEX IF NOT EXISTS idx_workout_records_user
  ON workout_records(user_id);

-- goal_milestones and news_digests are orphan tables
-- (referenced only in dead Drizzle schema, never created in prod).
-- Indexes not needed.
