-- ============================================
-- English SRS V4: Learn → Review Lifecycle
-- Part 1: Core schema columns
-- ============================================

ALTER TABLE review_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'review'
    CHECK (session_type IN ('learn', 'review'));

ALTER TABLE expressions
  ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ;
