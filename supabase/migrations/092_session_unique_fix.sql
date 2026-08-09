-- ============================================
-- English SRS V4: Session Lifecycle Fix
-- Part: UNIQUE constraint update
--
-- Problem: UNIQUE(user_id, session_date) prevents
-- having BOTH a "learn" AND "review" session on the
-- same day, causing 409 errors.
--
-- Fix: Change to UNIQUE(user_id, session_date, session_type)
-- ============================================

-- Step 1: Drop the old index
DROP INDEX IF EXISTS idx_review_sessions_user_date;

-- Step 2: Create new index with session_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_sessions_user_date_type
  ON review_sessions(user_id, session_date, session_type);
