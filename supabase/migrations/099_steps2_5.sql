DO $$
DECLARE backfill_count INTEGER;
BEGIN
  WITH backfilled AS (
    UPDATE expressions e SET learned_at = sub.earliest_review
    FROM (SELECT expression_id, min(reviewed_at) AS earliest_review FROM expression_reviews GROUP BY expression_id) sub
    WHERE e.id = sub.expression_id AND e.learned_at IS NULL
    RETURNING e.id
  )
  SELECT count(*) INTO backfill_count FROM backfilled;
  RAISE NOTICE 'Backfilled % from review history', backfill_count;
END $$;

DO $$
DECLARE fix_count INTEGER;
BEGIN
  WITH fixed AS (
    UPDATE expressions SET status = 'review'
    WHERE learned_at IS NOT NULL AND status IN ('collected', 'learning') AND next_review_date IS NULL
    RETURNING id
  )
  SELECT count(*) INTO fix_count FROM fixed;
  RAISE NOTICE 'Fixed status to review for % expressions', fix_count;
END $$;

CREATE INDEX IF NOT EXISTS idx_expr_learned_null ON expressions(user_id, learned_at) WHERE archived = false AND learned_at IS NULL;

DO $$
DECLARE
  total_exprs INTEGER; never_learned INTEGER; learned INTEGER; still_misclassified INTEGER;
BEGIN
  SELECT count(*) INTO total_exprs FROM expressions WHERE archived = false;
  SELECT count(*) INTO never_learned FROM expressions WHERE archived = false AND learned_at IS NULL;
  SELECT count(*) INTO learned FROM expressions WHERE archived = false AND learned_at IS NOT NULL;
  SELECT count(*) INTO still_misclassified FROM expressions WHERE archived = false AND learned_at IS NOT NULL AND status IN ('collected', 'learning');
  RAISE NOTICE '=== V3.7 Summary ===';
  RAISE NOTICE 'Total: %, Never learned: %, Learned: %, Misclassified: %', total_exprs, never_learned, learned, still_misclassified;
END $$;
