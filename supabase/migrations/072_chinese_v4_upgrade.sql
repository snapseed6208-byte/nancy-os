-- ============================================
-- Migration 072: Chinese Expression V4 Upgrade
-- Adds reference_viewed_before_retry to chinese_speaking_attempts.
-- V4 diagnosis uses skill-specific dimensions; no schema
-- changes needed for JSONB columns (diagnosis, scores, delivery_metrics).
-- ============================================

ALTER TABLE chinese_speaking_attempts
ADD COLUMN IF NOT EXISTS reference_viewed_before_retry BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN chinese_speaking_attempts.reference_viewed_before_retry IS 'Whether the user viewed the full AI reference before starting a retry (Round 2). Set immediately when user clicks view reference.';
