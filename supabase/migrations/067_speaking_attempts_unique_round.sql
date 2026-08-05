-- ============================================
-- Migration 067: Speaking Attempts Unique Round
-- Enforces one attempt per round per session.
-- ============================================

-- Deduplicate any existing violations before adding the constraint.
-- Keeps the NEWEST (last created_at) row for each (session_id, attempt_round).
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT session_id, attempt_round, COUNT(*) AS cnt
    FROM speaking_attempts
    WHERE deleted_at IS NULL
    GROUP BY session_id, attempt_round
    HAVING COUNT(*) > 1
  ) dupes;

  IF duplicate_count > 0 THEN
    RAISE WARNING '[067] Found % duplicate session/round combinations — soft-deleting older duplicates', duplicate_count;

    UPDATE speaking_attempts
    SET deleted_at = NOW()
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY session_id, attempt_round
            ORDER BY created_at DESC
          ) AS rn
        FROM speaking_attempts
        WHERE deleted_at IS NULL
      ) ranked
      WHERE ranked.rn > 1
    );
  END IF;
END $$;

-- Each session can have at most one attempt per round.
-- Rounds: 1 = first attempt, 2 = first retry, 3 = second retry, etc.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_session_attempt_round'
      AND conrelid = 'speaking_attempts'::regclass
  ) THEN
    ALTER TABLE speaking_attempts
    ADD CONSTRAINT unique_session_attempt_round
    UNIQUE (session_id, attempt_round);
  END IF;
END $$;
