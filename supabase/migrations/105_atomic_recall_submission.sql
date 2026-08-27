-- ============================================
-- English SRS: Atomic, idempotent Recall attempts
-- ============================================

-- One client action has one stable UUID. Existing rows remain valid with NULL.
ALTER TABLE expression_practice_logs
  ADD COLUMN IF NOT EXISTS attempt_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_logs_recall_attempt_id
  ON expression_practice_logs(user_id, attempt_id)
  WHERE attempt_id IS NOT NULL;

-- One canonical cross-day memory event per expression in a review session.
ALTER TABLE expression_reviews
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES review_sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expression_reviews_session_expression
  ON expression_reviews(session_id, expression_id)
  WHERE session_id IS NOT NULL;

-- The original inline constraint predates the current rating vocabulary.
ALTER TABLE expression_reviews
  DROP CONSTRAINT IF EXISTS expression_reviews_result_check;
ALTER TABLE expression_reviews
  DROP CONSTRAINT IF EXISTS chk_expression_reviews_result;
ALTER TABLE expression_reviews
  ADD CONSTRAINT chk_expression_reviews_result
  CHECK (result IN ('forgot', 'again', 'fuzzy', 'hard', 'good', 'easy')) NOT VALID;

CREATE OR REPLACE FUNCTION submit_recall_attempt(
  p_session_id UUID,
  p_item_id UUID,
  p_score SMALLINT,
  p_attempt_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_today DATE := timezone('Asia/Shanghai', v_now)::date;
  v_session review_sessions%ROWTYPE;
  v_item review_session_items%ROWTYPE;
  v_expr expressions%ROWTYPE;
  v_existing_log expression_practice_logs%ROWTYPE;
  v_recall JSONB;
  v_original JSONB;
  v_attempts JSONB;
  v_attempt_number INTEGER;
  v_today_passed BOOLEAN;
  v_should_requeue BOOLEAN;
  v_at_limit BOOLEAN;
  v_had_lapse BOOLEAN;
  v_had_fuzzy BOOLEAN;
  v_needs_relearning BOOLEAN;
  v_worst_score SMALLINT;
  v_rating TEXT;
  v_orig_ef NUMERIC;
  v_orig_reps INTEGER;
  v_orig_interval INTEGER;
  v_orig_lapses INTEGER;
  v_orig_productions INTEGER;
  v_orig_review_count INTEGER;
  v_orig_streak INTEGER;
  v_new_ef NUMERIC;
  v_new_reps INTEGER;
  v_new_interval INTEGER;
  v_new_lapses INTEGER;
  v_new_status TEXT;
  v_next_review DATE;
  v_new_recall JSONB;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_score < 1 OR p_score > 5 THEN
    RAISE EXCEPTION 'Recall score must be between 1 and 5';
  END IF;
  IF p_attempt_id IS NULL THEN
    RAISE EXCEPTION 'attempt id is required';
  END IF;

  SELECT * INTO v_session
  FROM review_sessions
  WHERE id = p_session_id
    AND user_id = v_user_id
    AND session_type = 'review';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review session not found or not owned';
  END IF;

  -- Serialize all attempts for one card. A duplicate waits here, then observes
  -- the first transaction's immutable log and returns its original result.
  SELECT * INTO v_item
  FROM review_session_items
  WHERE id = p_item_id AND session_id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session item not found';
  END IF;

  SELECT * INTO v_expr
  FROM expressions
  WHERE id = v_item.expression_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expression not found or not owned';
  END IF;

  SELECT * INTO v_existing_log
  FROM expression_practice_logs
  WHERE user_id = v_user_id AND attempt_id = p_attempt_id;
  IF FOUND THEN
    IF v_existing_log.session_id IS DISTINCT FROM p_session_id
       OR v_existing_log.expression_id IS DISTINCT FROM v_item.expression_id THEN
      RAISE EXCEPTION 'attempt id already belongs to another Recall action';
    END IF;
    RETURN v_existing_log.metadata->'rpc_result';
  END IF;

  v_recall := COALESCE(v_item.mode_data->'recall', '{}'::jsonb);
  IF COALESCE((v_recall->>'today_passed')::boolean, false)
     OR COALESCE((v_recall->>'max_attempts_reached')::boolean, false) THEN
    RAISE EXCEPTION 'Recall item is already resolved today';
  END IF;
  v_attempts := COALESCE(v_recall->'attempts', '[]'::jsonb);
  v_attempt_number := v_item.attempt_count + 1;

  IF v_recall ? 'original_srs' THEN
    v_original := v_recall->'original_srs';
  ELSE
    v_original := jsonb_build_object(
      'ease_factor', COALESCE(v_expr.ease_factor, 2.5),
      'repetitions', COALESCE(v_expr.repetitions, 0),
      'interval_days', COALESCE(v_expr.interval_days, 0),
      'lapse_count', COALESCE(v_expr.lapse_count, 0),
      'production_count', COALESCE(v_expr.production_count, 0),
      'review_count', COALESCE(v_expr.review_count, 0),
      'streak', COALESCE(v_expr.streak, 0),
      'status', v_expr.status,
      'next_review_date', v_expr.next_review_date
    );
  END IF;

  v_had_lapse := COALESCE((v_recall->>'had_lapse')::boolean, false)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_attempts) a WHERE (a->>'score')::integer = 1)
    OR p_score = 1;
  v_had_fuzzy := COALESCE((v_recall->>'had_fuzzy')::boolean, false)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_attempts) a WHERE (a->>'score')::integer = 2)
    OR p_score = 2;
  v_worst_score := CASE WHEN v_had_lapse THEN 1 WHEN v_had_fuzzy THEN 2 ELSE p_score END;
  v_today_passed := p_score >= 3;
  v_at_limit := NOT v_today_passed AND v_attempt_number >= 4;
  v_should_requeue := NOT v_today_passed AND NOT v_at_limit;
  v_needs_relearning := v_had_lapse OR v_at_limit;
  v_rating := CASE v_worst_score
    WHEN 1 THEN 'again'
    WHEN 2 THEN 'fuzzy'
    WHEN 3 THEN 'hard'
    WHEN 4 THEN 'good'
    ELSE 'easy'
  END;

  v_orig_ef := COALESCE((v_original->>'ease_factor')::numeric, 2.5);
  v_orig_reps := COALESCE((v_original->>'repetitions')::integer, 0);
  v_orig_interval := COALESCE((v_original->>'interval_days')::integer, 0);
  v_orig_lapses := COALESCE((v_original->>'lapse_count')::integer, 0);
  v_orig_productions := COALESCE((v_original->>'production_count')::integer, 0);
  v_orig_review_count := COALESCE((v_original->>'review_count')::integer, 0);
  v_orig_streak := COALESCE((v_original->>'streak')::integer, 0);

  -- Same formula as expressionSrs.ts. It is always applied to original_srs,
  -- never to a schedule produced by an earlier attempt today.
  v_new_ef := GREATEST(
    1.3,
    v_orig_ef + (0.1 - (3 - (v_worst_score - 1))
      * (0.08 + (3 - (v_worst_score - 1)) * 0.02))
  );

  CASE v_worst_score
    WHEN 1 THEN
      v_new_reps := 0;
      v_new_interval := 1;
      v_new_lapses := v_orig_lapses + 1;
    WHEN 2 THEN
      v_new_reps := GREATEST(0, v_orig_reps - 1);
      v_new_interval := CASE WHEN v_orig_interval = 0 THEN 2
        ELSE LEAST(3, GREATEST(2, round(v_orig_interval * 0.25)::integer)) END;
      v_new_lapses := v_orig_lapses;
    WHEN 3 THEN
      v_new_reps := v_orig_reps;
      v_new_interval := CASE WHEN v_orig_interval = 0 THEN 3
        ELSE LEAST(365, GREATEST(3, round(v_orig_interval * 1.2)::integer)) END;
      v_new_lapses := v_orig_lapses;
    WHEN 4 THEN
      v_new_reps := v_orig_reps + 1;
      v_new_interval := CASE
        WHEN v_orig_interval = 0 OR v_orig_reps = 0 THEN 4
        ELSE LEAST(365, round(v_orig_interval * v_new_ef)::integer) END;
      v_new_lapses := v_orig_lapses;
    ELSE
      v_new_reps := v_orig_reps + 1;
      v_new_interval := CASE WHEN v_orig_interval = 0 THEN 7
        ELSE LEAST(365, GREATEST(7, round(v_orig_interval * v_new_ef * 1.3)::integer)) END;
      v_new_lapses := v_orig_lapses;
  END CASE;

  v_new_status := CASE
    WHEN v_new_reps >= 8 AND v_new_interval >= 90 THEN 'mastered'
    WHEN v_new_reps >= 3 THEN 'review'
    ELSE 'learning'
  END;
  v_next_review := v_today + v_new_interval;

  v_result := jsonb_build_object(
    'expression_id', v_expr.id,
    'attempt_number', v_attempt_number,
    'rating', v_rating,
    'today_passed', v_today_passed,
    'should_requeue', v_should_requeue,
    'requeue_position', CASE WHEN v_should_requeue THEN 'tail' ELSE NULL END,
    'had_lapse', v_had_lapse,
    'had_fuzzy', v_had_fuzzy,
    'interval_days', v_new_interval,
    'next_review_date', v_next_review,
    'max_attempts_reached', v_at_limit,
    'needs_relearning', v_needs_relearning
  );

  v_new_recall := v_recall || jsonb_build_object(
    'original_srs', v_original,
    'attempts', v_attempts || jsonb_build_array(jsonb_build_object(
      'attempt_id', p_attempt_id,
      'rating', v_rating,
      'score', p_score,
      'attempt_number', v_attempt_number,
      'timestamp', v_now,
      'is_requeue', v_attempt_number > 1
    )),
    'today_passed', v_today_passed,
    'memory_quality_for_scheduling', v_rating,
    'had_lapse', v_had_lapse,
    'had_fuzzy', v_had_fuzzy,
    'max_attempts_reached', v_at_limit,
    'needs_relearning', v_needs_relearning
  );

  UPDATE expressions SET
    next_review_date = v_next_review,
    status = v_new_status,
    mastery_level = LEAST(v_new_reps, 5)::text,
    streak = CASE WHEN v_worst_score = 1 THEN 0 ELSE v_orig_streak + 1 END,
    review_count = v_orig_review_count + 1,
    last_review_result = v_rating,
    ease_factor = round(v_new_ef, 2),
    repetitions = v_new_reps,
    interval_days = v_new_interval,
    lapse_count = v_new_lapses,
    production_count = v_orig_productions,
    last_reviewed_at = v_now,
    updated_at = v_now
  WHERE id = v_expr.id;

  UPDATE review_session_items SET
    recall_score = p_score,
    status = CASE WHEN v_today_passed THEN 'passed'
      WHEN v_at_limit THEN 'completed' ELSE 'reinforcement' END,
    attempt_count = v_attempt_number,
    reinforcement_round = CASE WHEN v_today_passed THEN reinforcement_round
      ELSE reinforcement_round + 1 END,
    reinforcement_status = CASE WHEN v_today_passed THEN 'mastered'
      WHEN v_at_limit THEN 'max_rounds' ELSE 'queued' END,
    result_classification = CASE WHEN v_today_passed THEN 'mastered'
      ELSE 'needs_reinforcement' END,
    mode_data = jsonb_set(COALESCE(mode_data, '{}'::jsonb), '{recall}', v_new_recall, true),
    last_practice_at = v_now
  WHERE id = v_item.id;

  INSERT INTO expression_practice_logs (
    user_id, expression_id, session_id, attempt_id, mode, score, metadata, created_at
  ) VALUES (
    v_user_id, v_expr.id, p_session_id, p_attempt_id, 'recall', p_score,
    jsonb_build_object(
      'attempt_number', v_attempt_number,
      'is_requeue', v_attempt_number > 1,
      'today_passed', v_today_passed,
      'had_lapse', v_had_lapse,
      'had_fuzzy', v_had_fuzzy,
      'rpc_result', v_result
    ),
    v_now
  );

  INSERT INTO expression_reviews (
    user_id, expression_id, session_id, result, previous_interval,
    new_interval, reviewed_at, review_mode, production_success
  ) VALUES (
    v_user_id, v_expr.id, p_session_id, v_rating, v_orig_interval,
    v_new_interval, v_now, 'active_recall', NULL
  )
  ON CONFLICT (session_id, expression_id) WHERE session_id IS NOT NULL
  DO UPDATE SET
    result = EXCLUDED.result,
    new_interval = EXCLUDED.new_interval,
    review_mode = EXCLUDED.review_mode;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION submit_recall_attempt(UUID, UUID, SMALLINT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_recall_attempt(UUID, UUID, SMALLINT, UUID) TO authenticated;

COMMENT ON FUNCTION submit_recall_attempt(UUID, UUID, SMALLINT, UUID) IS
  'Atomically records one idempotent Recall attempt and recomputes the daily SRS event from the original pre-day snapshot plus the worst attempt.';
