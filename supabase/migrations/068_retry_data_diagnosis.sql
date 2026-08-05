-- ============================================
-- Migration 068: Diagnose and repair retry data
-- Stage 6 — identifies corrupted attempts and
-- backfills broken retry links where possible.
-- ============================================

-- 1. Report: orphaned retries (retry saved without a first attempt)
-- These are UNRECOVERABLE — the first attempt was never persisted.
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM speaking_attempts r
  WHERE r.is_retry = true
    AND r.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM speaking_attempts p
      WHERE p.session_id = r.session_id
        AND p.is_retry = false
        AND p.deleted_at IS NULL
    );

  IF orphan_count > 0 THEN
    RAISE WARNING '[068] Found % orphaned retries (retry without a first attempt). These cannot be recovered automatically.', orphan_count;
  END IF;
END $$;

-- 2. Report: broken links (both rounds exist but retry_of_attempt_id is null)
DO $$
DECLARE
  broken_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO broken_count
  FROM speaking_attempts r
  WHERE r.is_retry = true
    AND r.retry_of_attempt_id IS NULL
    AND r.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM speaking_attempts p
      WHERE p.session_id = r.session_id
        AND p.is_retry = false
        AND p.deleted_at IS NULL
    );

  IF broken_count > 0 THEN
    RAISE WARNING '[068] Found % retries with broken parent links. These will be backfilled.', broken_count;
  END IF;
END $$;

-- 3. Repair: backfill retry_of_attempt_id where both rounds exist
UPDATE speaking_attempts r
SET retry_of_attempt_id = p.id
FROM speaking_attempts p
WHERE r.is_retry = true
  AND r.retry_of_attempt_id IS NULL
  AND r.deleted_at IS NULL
  AND p.session_id = r.session_id
  AND p.is_retry = false
  AND p.deleted_at IS NULL
  AND p.id != r.id;

-- 4. Verify: count remaining issues after repair
DO $$
DECLARE
  remaining_orphans INTEGER;
  remaining_broken INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_orphans
  FROM speaking_attempts r
  WHERE r.is_retry = true
    AND r.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM speaking_attempts p
      WHERE p.session_id = r.session_id
        AND p.is_retry = false
        AND p.deleted_at IS NULL
    );

  SELECT COUNT(*) INTO remaining_broken
  FROM speaking_attempts r
  WHERE r.is_retry = true
    AND r.retry_of_attempt_id IS NULL
    AND r.deleted_at IS NULL;

  IF remaining_orphans > 0 THEN
    RAISE WARNING '[068] % orphaned retries remain after repair (unrecoverable).', remaining_orphans;
  END IF;

  IF remaining_broken > 0 THEN
    RAISE WARNING '[068] % retries still have null retry_of_attempt_id after repair.', remaining_broken;
  ELSE
    RAISE NOTICE '[068] All broken retry links have been repaired.';
  END IF;
END $$;
