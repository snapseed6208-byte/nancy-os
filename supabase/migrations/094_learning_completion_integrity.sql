-- ============================================
-- English SRS V4.1: Learning Completion Transaction Integrity
--
-- Root cause: migration 091 added chk_practice_logs_mode (includes 'learn')
-- but only dropped a constraint with that name that never existed. The original
-- inline CHECK from migration 086 was auto-named expression_practice_logs_mode_check
-- and EXCLUDES 'learn'. Both enforce on new rows, so mode='learn' → 23514 → 400.
--
-- The same drift affects expressions.status: expressions_status_check (from an
-- earlier migration) allows ('new','learning','familiar','mastered') and blocks
-- 'collected'/'review' even though chk_expressions_status (migration 091) allows them.
--
-- Fix: drop the two stale constraints, then add an atomic learning-completion RPC.
-- ============================================

ALTER TABLE expression_practice_logs
  DROP CONSTRAINT IF EXISTS expression_practice_logs_mode_check;

ALTER TABLE expressions
  DROP CONSTRAINT IF EXISTS expressions_status_check;

-- ═══════════════════════════════════════
-- Atomic learning completion
--
-- Marks the session item completed AND initializes SRS for the expression
-- in a single DB transaction. Idempotent: re-running skips already-completed
-- items and never re-initializes an expression already in the review cycle.
--
-- p_srs carries the schedule computed by src/lib/srs/expressionSrs.ts so the
-- SM-2 algorithm stays in TypeScript (single source of truth).
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION complete_expression_learning(
  p_session_id UUID,
  p_item_id UUID,
  p_recall_score SMALLINT,
  p_sentence_score SMALLINT,
  p_srs JSONB
)
RETURNS TABLE (
  item_completed BOOLEAN,
  srs_initialized BOOLEAN,
  expression_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session RECORD;
  v_item RECORD;
  v_expr RECORD;
  v_now TIMESTAMPTZ := now();
  v_item_completed BOOLEAN := false;
  v_srs_initialized BOOLEAN := false;
  v_status TEXT := COALESCE(p_srs->>'status', 'review');
  v_next_review DATE := NULLIF(p_srs->>'next_review_date', '')::date;
  v_interval INT := COALESCE(round(NULLIF(p_srs->>'interval_days', '')::numeric)::int, 1);
  v_reps INT := COALESCE(NULLIF(p_srs->>'repetitions', '')::int, 1);
  v_ease REAL := COALESCE(NULLIF(p_srs->>'ease_factor', '')::real, 2.5);
  v_result TEXT := COALESCE(p_srs->>'result', 'good');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session FROM review_sessions
    WHERE id = p_session_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or not owned';
  END IF;

  SELECT * INTO v_item FROM review_session_items
    WHERE id = p_item_id AND session_id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found in session';
  END IF;

  SELECT * INTO v_expr FROM expressions WHERE id = v_item.expression_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expression not found';
  END IF;

  -- 1. Mark item completed (idempotent)
  IF v_item.status IS DISTINCT FROM 'completed' THEN
    UPDATE review_session_items
      SET status = 'completed',
          recall_score = p_recall_score,
          sentence_score = p_sentence_score,
          last_practice_at = v_now
      WHERE id = p_item_id;
    v_item_completed := true;
  END IF;

  -- 2. Initialize SRS once.
  --    Guard: only expressions not yet actively scheduled for a FUTURE review.
  --    Production note: legacy 'learning' rows carry a next_review_date (old SRS
  --    meaning = "already reviewed"). Re-initializing those would reset their
  --    SM-2 progress, so we skip anything scheduled ahead. Overdue (past) dates
  --    are re-engaged with a fresh schedule — unblocks rows stuck mid-failure.
  IF v_expr.status IN ('collected', 'learning')
     AND (v_expr.next_review_date IS NULL OR v_expr.next_review_date <= v_now::date) THEN
    UPDATE expressions
      SET status = v_status,
          learned_at = v_now,
          next_review_date = v_next_review,
          interval_days = v_interval,
          repetitions = v_reps,
          ease_factor = v_ease,
          last_reviewed_at = v_now,
          review_count = COALESCE(review_count, 0) + 1
      WHERE id = v_expr.id;

    INSERT INTO expression_reviews (
      user_id, expression_id, result, previous_interval, new_interval, review_mode
    ) VALUES (
      v_user_id, v_expr.id, v_result, 0, v_interval, 'learn'
    );

    v_srs_initialized := true;
  END IF;

  RETURN QUERY SELECT v_item_completed, v_srs_initialized, v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_expression_learning(UUID, UUID, SMALLINT, SMALLINT, JSONB) TO authenticated;
