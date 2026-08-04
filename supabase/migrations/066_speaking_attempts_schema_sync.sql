-- ============================================
-- Migration 066: Speaking Attempts Schema Sync
-- Backfills columns from 063/064 that were repaired but never executed,
-- plus STT observability columns.
-- ============================================

-- ── From 063: Retry support ──

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS retry_of_attempt_id UUID
  REFERENCES speaking_attempts(id) ON DELETE SET NULL;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS attempt_round INTEGER NOT NULL DEFAULT 1;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS is_retry BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS content_analysis JSONB;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS answer_structure JSONB;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS structured_better_answer TEXT;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS key_upgrades JSONB;

-- ── From 064: Final High-score Answer ──

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS diagnosis TEXT;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS key_improvements TEXT;

-- ── New: STT observability ──

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS stt_provider TEXT;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS stt_mode TEXT;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT false;

-- ── Indexes from 063 (safe to re-create) ──

CREATE INDEX IF NOT EXISTS idx_speaking_attempts_retry_of
  ON speaking_attempts(retry_of_attempt_id)
  WHERE retry_of_attempt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_speaking_attempts_session_round
  ON speaking_attempts(session_id, attempt_round);
