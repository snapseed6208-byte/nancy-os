-- ============================================
-- Chinese Expression V4.3 — Reference Answer Metadata
--
-- Adds reference_meta JSONB to chinese_speaking_attempts so the AI reference
-- answer can carry:
--   example_source: "user_real" | "user_vague" | "ai_scenario"
--   example_notice: boolean (true when the answer uses an AI-generated demo
--                    scenario that must not be mistaken for the user's real
--                    experience)
--
-- Legacy rows are NULL → frontend must treat missing meta as "no notice".
-- ============================================

ALTER TABLE chinese_speaking_attempts
  ADD COLUMN IF NOT EXISTS reference_meta JSONB;

COMMENT ON COLUMN chinese_speaking_attempts.reference_meta
  IS 'AI reference answer metadata (V4.3): { example_source, example_notice }. NULL for legacy rows.';
