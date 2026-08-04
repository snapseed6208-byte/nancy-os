-- ============================================
-- Migration 064: Final High-score Answer Upgrade
-- Replaces structured_better_answer with richer output:
--   diagnosis, finalHighScoreAnswer (in existing column), key_improvements
-- ============================================

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS diagnosis TEXT;

ALTER TABLE speaking_attempts
ADD COLUMN IF NOT EXISTS key_improvements TEXT;
