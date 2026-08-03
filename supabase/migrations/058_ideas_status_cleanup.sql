-- ============================================
-- 058: Ideas Status Cleanup
-- Remove "dismissed" status, consolidate to 3 states
-- ============================================

-- 1. Backfill: dismissed → processed, archived → processed (safety)
UPDATE public.ideas SET status = 'processed' WHERE status IN ('dismissed', 'archived');

-- 2. Drop old CHECK constraint
ALTER TABLE public.ideas DROP CONSTRAINT IF EXISTS ideas_status_check;

-- 3. Add new CHECK constraint (pending, converted, processed only)
ALTER TABLE public.ideas ADD CONSTRAINT ideas_status_check
  CHECK (status IN ('pending', 'converted', 'processed'));

-- 4. Verify
SELECT status, COUNT(*) AS cnt
FROM public.ideas
GROUP BY status
ORDER BY status;
