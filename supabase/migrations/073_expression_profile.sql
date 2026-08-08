-- ============================================
-- Migration 073: Personal Expression Profile
-- Long-term expression growth tracking via
-- client-side aggregation of structured diagnosis fields.
-- ============================================

CREATE TABLE IF NOT EXISTS expression_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Aggregated strengths: { "relevance": 5, "evidence": 3, ... }
  strengths JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Aggregated weaknesses: { "boundary": { "count": 3, "last_seen": "...", "avg_severity": "high" }, ... }
  weaknesses JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Usage patterns: { "preferred_types": { "opinion": 12, "experience": 5 }, "total_sessions": 17, "total_retries": 8, "avg_score": 72, "score_trend": [{ "date": "...", "score": 70 }, ...] }
  patterns JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Improvement log: [{ "date": "...", "before_score": 65, "after_score": 78, "area": "evidence", "sessions": 5 }, ...]
  improvement_history JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Snapshot of the raw signals for debugging / recalibration
  raw_signal_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expression_profiles_user
  ON expression_profiles(user_id);

-- RLS
ALTER TABLE expression_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can manage own expression profile'
      AND tablename = 'expression_profiles'
  ) THEN
    CREATE POLICY "Users can manage own expression profile"
      ON expression_profiles
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
