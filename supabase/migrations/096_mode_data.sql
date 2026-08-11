-- ============================================
-- English SRS V3.4 — Context Cloze Generation
--
-- Adds mode_data JSONB to review_session_items
-- so each mode can persist its own data per item.
--
-- Also adds ai_cloze_sentence to expressions
-- for caching AI-generated cloze sentences.
-- ============================================

ALTER TABLE review_session_items
  ADD COLUMN IF NOT EXISTS mode_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN review_session_items.mode_data IS
  'Per-mode data. Keys: cloze (ContextClozeCard), sentence (evaluation). Stored per session item so cards vary across review sessions.';

ALTER TABLE expressions
  ADD COLUMN IF NOT EXISTS ai_cloze_sentence TEXT;

COMMENT ON COLUMN expressions.ai_cloze_sentence IS
  'AI-generated cloze sentence for this expression. Used as fallback when no manual cloze_sentence exists. Cached but regenerated per session.';
