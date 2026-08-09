-- ============================================
-- English SRS V4: Learn → Review Lifecycle
-- Part 3: Constraints, indexes, and mode updates
-- ============================================

ALTER TABLE expressions ADD CONSTRAINT chk_expressions_status CHECK (status IN ('collected', 'learning', 'review', 'mastered')) NOT VALID;

ALTER TABLE expression_practice_logs DROP CONSTRAINT IF EXISTS chk_practice_logs_mode;

ALTER TABLE expression_practice_logs ADD CONSTRAINT chk_practice_logs_mode CHECK (mode IN ('learn', 'recall', 'recognition', 'cloze', 'sentence', 'application')) NOT VALID;

DROP INDEX IF EXISTS idx_expressions_learning;

CREATE INDEX idx_expressions_learning ON expressions(user_id, created_at) WHERE archived = false AND status IN ('collected', 'learning');
