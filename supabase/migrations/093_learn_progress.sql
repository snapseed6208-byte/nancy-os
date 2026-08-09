-- ============================================
-- English SRS V4: Learning Flow Integrity
-- Part: resume progress persistence
--
-- Stores current expression index + learning stage
-- so /english/learn can resume after refresh/exit.
-- JSONB column; no CHECK constraint needed.
-- ============================================

ALTER TABLE review_sessions
  ADD COLUMN IF NOT EXISTS learn_progress JSONB;
