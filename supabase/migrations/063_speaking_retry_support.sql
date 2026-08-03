-- ============================================
-- Migration 063: Speaking Retry Support
-- Phase 6 — Content & Structure Analysis + Retry Flow
-- ============================================

-- 1. Retry relationship columns on speaking_attempts
ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS retry_of_attempt_id UUID
  REFERENCES speaking_attempts(id) ON DELETE SET NULL;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS attempt_round INTEGER NOT NULL DEFAULT 1;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS is_retry BOOLEAN NOT NULL DEFAULT false;

-- 2. Content & Structure analysis columns
ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS content_analysis JSONB;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS answer_structure JSONB;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS structured_better_answer TEXT;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS key_upgrades JSONB;

-- 3. Index for efficient retry lookups
CREATE INDEX IF NOT EXISTS idx_speaking_attempts_retry_of
  ON speaking_attempts(retry_of_attempt_id)
  WHERE retry_of_attempt_id IS NOT NULL;

-- 4. Index for ordering attempts within a session
CREATE INDEX IF NOT EXISTS idx_speaking_attempts_session_round
  ON speaking_attempts(session_id, attempt_round);
