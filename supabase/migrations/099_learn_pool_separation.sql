-- ============================================
-- English SRS V3.7 — Learn / Review Pool Separation
--
-- Root cause: selectLearnQueue queries by status
-- IN ('collected','learning') without checking
-- learned_at. Expressions that completed the learn
-- lifecycle but still have status='learning' (SRS
-- stage) are re-selected as "new expressions to
-- learn" on subsequent days.
--
-- Fix:
--   1. Backfill learned_at from completed learn
--      session items + review history.
--   2. Fix status for already-learned expressions
--      still misclassified as collected/learning.
--   3. Add partial index for learned_at queries.
-- ============================================

-- ═══════════════════════════════════════
-- Step 1: Backfill learned_at from completed
--         learn session items. This is the
--         most reliable signal — an expression
--         was explicitly in a learn session
--         and the user completed it.
-- ═══════════════════════════════════════
DO $$
DECLARE
  backfill_count INTEGER;
BEGIN
  WITH backfilled AS (
    UPDATE expressions e
    SET learned_at = sub.first_completion
    FROM (
      SELECT
        rsi.expression_id,
        min(rsi.created_at) AS first_completion
      FROM review_session_items rsi
      JOIN review_sessions rs
        ON rsi.session_id = rs.id
      WHERE rs.session_type = 'learn'
        AND rsi.recall_score IS NOT NULL
      GROUP BY rsi.expression_id
    ) sub
    WHERE e.id = sub.expression_id
      AND e.learned_at IS NULL
    RETURNING e.id
  )
  SELECT count(*) INTO backfill_count FROM backfilled;

  RAISE NOTICE 'Backfilled learned_at for % expressions from completed learn sessions', backfill_count;
END $$;

-- ═══════════════════════════════════════
-- Step 2: Backfill learned_at from review
--         history for expressions that have
--         SRS reviews but no learn session
--         record. Having review history means
--         they must have been learned at some
--         point (SRS review only starts after
--         learning completes).
-- ═══════════════════════════════════════
DO $$
DECLARE
  backfill_count INTEGER;
BEGIN
  WITH backfilled AS (
    UPDATE expressions e
    SET learned_at = sub.earliest_review
    FROM (
      SELECT
        expression_id,
        min(reviewed_at) AS earliest_review
      FROM expression_reviews
      GROUP BY expression_id
    ) sub
    WHERE e.id = sub.expression_id
      AND e.learned_at IS NULL
    RETURNING e.id
  )
  SELECT count(*) INTO backfill_count FROM backfilled;

  RAISE NOTICE 'Backfilled learned_at for % expressions from review history', backfill_count;
END $$;

-- ═══════════════════════════════════════
-- Step 3: Fix status for expressions that
--         have learned_at set but are still
--         misclassified as collected/learning.
--         These should be 'review' (they've
--         completed the learn lifecycle).
--         Only update when next_review_date
--         is NULL (let SRS set it properly).
-- ============================================
DO $$
DECLARE
  fix_count INTEGER;
BEGIN
  WITH fixed AS (
    UPDATE expressions
    SET status = 'review'
    WHERE learned_at IS NOT NULL
      AND status IN ('collected', 'learning')
      AND next_review_date IS NULL
    RETURNING id
  )
  SELECT count(*) INTO fix_count FROM fixed;

  RAISE NOTICE 'Fixed status to review for % already-learned expressions', fix_count;
END $$;

-- ═══════════════════════════════════════
-- Step 4: Partial index for efficient
--         "never learned" lookups per user.
-- ============================================
CREATE INDEX IF NOT EXISTS idx_expr_learned_null
  ON expressions(user_id, learned_at)
  WHERE archived = false AND learned_at IS NULL;

-- ═══════════════════════════════════════
-- Step 5: Validation summary
-- ============================================
DO $$
DECLARE
  total_exprs INTEGER;
  never_learned INTEGER;
  learned INTEGER;
  still_misclassified INTEGER;
BEGIN
  SELECT count(*) INTO total_exprs FROM expressions WHERE archived = false;
  SELECT count(*) INTO never_learned FROM expressions WHERE archived = false AND learned_at IS NULL;
  SELECT count(*) INTO learned FROM expressions WHERE archived = false AND learned_at IS NOT NULL;
  SELECT count(*) INTO still_misclassified
    FROM expressions
    WHERE archived = false
      AND learned_at IS NOT NULL
      AND status IN ('collected', 'learning');

  RAISE NOTICE '=== V3.7 Pool Separation Summary ===';
  RAISE NOTICE 'Total unarchived expressions: %', total_exprs;
  RAISE NOTICE 'Never learned (Learn Pool): %', never_learned;
  RAISE NOTICE 'Already learned (Review Pool): %', learned;
  RAISE NOTICE 'Still misclassified (learned but status=collected/learning): %', still_misclassified;
END $$;
