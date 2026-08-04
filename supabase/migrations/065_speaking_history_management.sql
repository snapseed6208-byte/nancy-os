-- ============================================
-- Migration 065: Speaking History Management
-- Soft delete, editable metadata, test flag
-- ============================================

-- speaking_sessions: metadata + soft delete
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS learning_notes TEXT;
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Ensure updated_at exists (may already exist from 001)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'speaking_sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE speaking_sessions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- speaking_attempts: soft delete only (cascade from session delete, no user-facing delete)
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_speaking_sessions_active
  ON speaking_sessions(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_speaking_attempts_active
  ON speaking_attempts(session_id)
  WHERE deleted_at IS NULL;

-- Index for formal (non-test) stats
CREATE INDEX IF NOT EXISTS idx_speaking_sessions_formal
  ON speaking_sessions(user_id, created_at DESC)
  WHERE deleted_at IS NULL AND is_test = false;
