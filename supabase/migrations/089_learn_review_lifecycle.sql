-- ============================================
-- English SRS V4: Learn → Review Lifecycle
--
-- Establishes the full expression lifecycle:
--   COLLECTED → LEARNING → REVIEW → MASTERED
--
-- Key changes:
-- 1. review_sessions.session_type (learn|review)
-- 2. expressions.learned_at timestamp
-- 3. expressions.status CHECK constraint
-- 4. expression_practice_logs.mode adds 'learn'
-- 5. Partial index for learning queue
-- 6. Migrate 'new' → 'collected'
-- ============================================

-- ═══════════════════════════════════════
-- 1. Session type: distinguish learn vs review
-- ═══════════════════════════════════════

ALTER TABLE review_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'review'
    CHECK (session_type IN ('learn', 'review'));

COMMENT ON COLUMN review_sessions.session_type IS
  'V4: Session type. "learn" = new expression learning, "review" = SRS review.';

-- ═══════════════════════════════════════
-- 2. Learned-at timestamp for expressions
-- ═══════════════════════════════════════

ALTER TABLE expressions
  ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ;

COMMENT ON COLUMN expressions.learned_at IS
  'V4: Timestamp when the expression completed Learning and entered Review. NULL = not yet learned.';

-- ═══════════════════════════════════════
-- 3. Migrate 'new' → 'collected' + update default
-- ═══════════════════════════════════════

UPDATE expressions SET status = 'collected' WHERE status = 'new';

ALTER TABLE expressions ALTER COLUMN status SET DEFAULT 'collected';

-- ═══════════════════════════════════════
-- 4. Add CHECK constraint on expressions.status
-- ═══════════════════════════════════════

ALTER TABLE expressions
  ADD CONSTRAINT chk_expressions_status
    CHECK (status IN ('collected', 'learning', 'review', 'mastered'));

-- ═══════════════════════════════════════
-- 5. Update practice_logs.mode CHECK to add 'learn'
-- ═══════════════════════════════════════

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON con.conrelid = rel.oid
  WHERE rel.relname = 'expression_practice_logs'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%mode%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE expression_practice_logs DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE expression_practice_logs
  ADD CONSTRAINT chk_practice_logs_mode
    CHECK (mode IN ('learn', 'recall', 'recognition', 'cloze', 'sentence', 'application'));

-- ═══════════════════════════════════════
-- 6. Partial index for learning queue
-- ═══════════════════════════════════════

DROP INDEX IF EXISTS idx_expressions_learning;

CREATE INDEX idx_expressions_learning
  ON expressions(user_id, created_at)
  WHERE archived = false AND status IN ('collected', 'learning');

COMMENT ON INDEX idx_expressions_learning IS
  'V4: Learning queue index — collected + learning expressions ordered by creation date.';

-- ═══════════════════════════════════════
-- 7. Comments
-- ═══════════════════════════════════════

COMMENT ON TABLE review_sessions IS
  'English SRS V4: Daily session. session_type distinguishes learn vs review. One per user per day per type.';
