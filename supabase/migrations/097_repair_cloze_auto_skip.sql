-- ============================================
-- English SRS V3.4 — Production Repair
--
-- Clean up auto-skip / auto-incorrect cloze
-- practice log entries from the V3.3 era where
-- missing material caused system-generated
-- incorrect records.
--
-- These records never represented real user
-- errors and must be purged so they don't
-- distort the user's cloze accuracy stats.
-- ============================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete cloze practice logs where the system auto-marked
  -- incorrect without any real user answer.
  --
  -- Heuristic: score = 0 AND (answer IS NULL OR answer = '')
  -- means the user never submitted an answer, so the record
  -- was an auto-failure due to missing cloze material.
  WITH deleted AS (
    DELETE FROM expression_practice_logs
    WHERE mode = 'cloze'
      AND score = 0
      AND (answer IS NULL OR answer = '')
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RAISE NOTICE 'Cleaned up % auto-skip cloze practice log entries', deleted_count;
END $$;

-- Also reset cloze progress stored in review_session_items
-- that was marked as failed due to auto-skip (no user answer).
-- Set these back to pending so they can be re-practiced with
-- proper V3.4 context cloze cards.
UPDATE review_session_items
SET status = 'pending',
    recall_score = NULL,
    sentence_score = NULL,
    application_score = NULL
WHERE id IN (
  SELECT rsi.id
  FROM review_session_items rsi
  JOIN expression_practice_logs epl
    ON epl.expression_id = rsi.expression_id
    AND epl.session_id = rsi.session_id
  WHERE epl.mode = 'cloze'
    AND epl.score = 0
    AND (epl.answer IS NULL OR epl.answer = '')
    AND rsi.status = 'failed'
)
AND status = 'failed';
