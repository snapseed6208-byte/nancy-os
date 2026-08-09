-- ============================================
-- 088: Add UNIQUE constraint on task_completion_records
-- Migration 021 created the table without UNIQUE.
-- Migration 057 used CREATE TABLE IF NOT EXISTS so the
-- UNIQUE constraint never applied to existing tables.
-- This ALTER TABLE ensures the constraint exists.
-- ============================================

-- Deduplicate before adding constraint (keep earliest per group)
DELETE FROM task_completion_records
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY task_id, completion_date
        ORDER BY completed_at ASC
      ) AS rn
    FROM task_completion_records
  ) sub
  WHERE sub.rn > 1
);

-- Add the unique constraint (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_completion_records_task_id_completion_date_key'
  ) THEN
    ALTER TABLE task_completion_records
      ADD CONSTRAINT task_completion_records_task_id_completion_date_key
      UNIQUE (task_id, completion_date);
  END IF;
END $$;
