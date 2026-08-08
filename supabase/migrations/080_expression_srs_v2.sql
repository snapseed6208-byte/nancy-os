-- Migration 080: Expression SRS V2 — Activation System
-- Adds interval_days, lapse_count, production_count to expressions
-- Adds review_mode, production_success to expression_reviews
-- Adds updated_at trigger on expressions
-- Adds performance indexes

-- 1. New columns on expressions
ALTER TABLE expressions
  ADD COLUMN IF NOT EXISTS interval_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lapse_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_count INTEGER NOT NULL DEFAULT 0;

-- 2. New columns on expression_reviews
ALTER TABLE expression_reviews
  ADD COLUMN IF NOT EXISTS review_mode TEXT,
  ADD COLUMN IF NOT EXISTS production_success BOOLEAN;

-- 3. updated_at trigger for expressions
CREATE OR REPLACE FUNCTION update_expressions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expressions_updated_at ON expressions;
CREATE TRIGGER trg_expressions_updated_at
  BEFORE UPDATE ON expressions
  FOR EACH ROW
  EXECUTE FUNCTION update_expressions_updated_at();

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_expressions_user_due
  ON expressions(user_id, archived, next_review_date)
  WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_expressions_user_status
  ON expressions(user_id, status)
  WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_expression_reviews_expr_date
  ON expression_reviews(expression_id, reviewed_at DESC);

-- 5. Backfill interval_days for existing expressions
-- For expressions with a next_review_date, compute days between now and that date
-- If overdue (negative), set to 0 to prevent negative intervals
UPDATE expressions
SET interval_days = GREATEST(0, EXTRACT(DAY FROM (next_review_date - now()))::INTEGER)
WHERE next_review_date IS NOT NULL
  AND interval_days = 0;

-- For expressions without next_review_date, leave interval_days = 0 (default)
