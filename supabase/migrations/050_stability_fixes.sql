-- ============================================
-- 050: English OS Stability Phase — Schema Drift Fix
-- Ensures all columns referenced by application code
-- exist in production, even if the expressions table
-- pre-dated migration 001 (CREATE TABLE IF NOT EXISTS).
-- ============================================

-- Columns from 001_full_schema that may be missing
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS pronunciation TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS source_text TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS difficulty_level TEXT;

-- usefulness_level: add with constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expressions' AND column_name = 'usefulness_level'
  ) THEN
    ALTER TABLE public.expressions ADD COLUMN usefulness_level SMALLINT NOT NULL DEFAULT 3;
    ALTER TABLE public.expressions ADD CONSTRAINT expressions_usefulness_check
      CHECK (usefulness_level BETWEEN 1 AND 5);
  END IF;
END $$;

-- Columns from 042_expression_upgrades that may be missing
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS usage_note TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS memory_tip TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS common_mistakes TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS context TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS common_patterns TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS ease_factor REAL DEFAULT 2.5;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS repetitions INTEGER DEFAULT 0;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'active';

-- Verify
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'expressions'
ORDER BY ordinal_position;
