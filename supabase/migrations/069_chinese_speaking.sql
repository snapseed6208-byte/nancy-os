-- ============================================
-- Migration 069: Chinese Expression Training
-- Tables for 中文表达训练 module.
-- ============================================

-- 1. Sessions table
CREATE TABLE IF NOT EXISTS chinese_speaking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'one_minute_topic',
  topic TEXT NOT NULL,
  topic_type TEXT,
  prompt TEXT,
  source_title TEXT,
  source_text TEXT,
  source_url TEXT,
  recommended_framework TEXT,
  time_limit_seconds INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chinese_sessions_user
  ON chinese_speaking_sessions(user_id, deleted_at, created_at DESC);

-- 2. Attempts table
CREATE TABLE IF NOT EXISTS chinese_speaking_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chinese_speaking_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_round INTEGER NOT NULL DEFAULT 1,
  is_retry BOOLEAN NOT NULL DEFAULT false,
  retry_of_attempt_id UUID REFERENCES chinese_speaking_attempts(id) ON DELETE SET NULL,

  audio_url TEXT,
  audio_duration REAL,

  transcript TEXT,
  edited_transcript TEXT,

  scores JSONB,
  diagnosis JSONB,
  answer_outline JSONB,
  final_improved_speech TEXT,
  key_improvements JSONB,
  delivery_metrics JSONB,

  stt_provider TEXT,
  stt_mode TEXT,
  fallback_used BOOLEAN DEFAULT false,

  ai_model TEXT,
  ai_prompt_version TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT unique_chinese_session_attempt_round UNIQUE (session_id, attempt_round)
);

CREATE INDEX IF NOT EXISTS idx_chinese_attempts_session
  ON chinese_speaking_attempts(session_id, attempt_round);
CREATE INDEX IF NOT EXISTS idx_chinese_attempts_retry_of
  ON chinese_speaking_attempts(retry_of_attempt_id) WHERE retry_of_attempt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chinese_attempts_user
  ON chinese_speaking_attempts(user_id, deleted_at DESC);

-- 3. RLS
ALTER TABLE chinese_speaking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chinese_speaking_attempts ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can manage own chinese sessions'
      AND tablename = 'chinese_speaking_sessions'
  ) THEN
    CREATE POLICY "Users can manage own chinese sessions"
      ON chinese_speaking_sessions
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can manage own chinese attempts'
      AND tablename = 'chinese_speaking_attempts'
  ) THEN
    CREATE POLICY "Users can manage own chinese attempts"
      ON chinese_speaking_attempts
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
