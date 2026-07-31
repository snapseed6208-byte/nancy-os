-- ============================================
-- 051: Fix expression formality column drift
-- Root cause: migration 001 uses CREATE TABLE IF NOT EXISTS.
-- If the expressions table pre-existed, several columns
-- from 001 were never created in production.
--
-- This migration adds ALL columns from 001 that are
-- referenced by application code or part of the full
-- Expression data model, ensuring future insert/update
-- operations succeed regardless of table origin.
-- ============================================

-- formality: P1.5 Expression Upgrade insert breaks without this
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS formality TEXT;

-- Additional columns from 001 that may be missing but are part
-- of the complete Expression data model:
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS synonyms TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS english_explanation TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS native_usage TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS situation TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS imported_from TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS fluency_score REAL;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS grammar_score REAL;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS vocabulary_score REAL;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS naturalness_score REAL;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS last_practiced_at TIMESTAMPTZ;

-- Verify all expected columns now exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'expressions'
ORDER BY ordinal_position;
