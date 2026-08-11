-- ============================================
-- English SRS V3.6 — Learn Session Deduplication
--
-- Ensures (session_id, expression_id) is unique
-- at the database level. Migration 086 already
-- created this index but it may not exist in all
-- environments.
--
-- Safe: IF NOT EXISTS prevents duplicate creation.
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_session_items_unique
  ON review_session_items(session_id, expression_id);

-- Clean up any existing duplicate items by keeping
-- the earliest-created one (min id / min created_at).
-- Only deletes duplicates that have no user data
-- (no recall_score, no user_sentence, no ai_feedback).
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  WITH duplicates AS (
    SELECT
      session_id,
      expression_id,
      count(*) AS cnt
    FROM review_session_items
    GROUP BY session_id, expression_id
    HAVING count(*) > 1
  ),
  to_delete AS (
    SELECT rsi.id
    FROM review_session_items rsi
    JOIN duplicates d
      ON rsi.session_id = d.session_id
      AND rsi.expression_id = d.expression_id
    WHERE rsi.id NOT IN (
      -- Keep the earliest item per (session_id, expression_id)
      SELECT DISTINCT ON (session_id, expression_id) id
      FROM review_session_items
      WHERE (session_id, expression_id) IN (
        SELECT session_id, expression_id FROM duplicates
      )
      ORDER BY session_id, expression_id, created_at ASC
    )
    -- Only delete duplicates without user data
    AND rsi.recall_score IS NULL
    AND rsi.user_sentence IS NULL
    AND rsi.ai_feedback IS NULL
  )
  SELECT count(*) INTO dup_count FROM to_delete;

  DELETE FROM review_session_items
  WHERE id IN (SELECT id FROM to_delete);

  RAISE NOTICE 'Cleaned up % duplicate learn session items (no user data lost)', dup_count;
END $$;
