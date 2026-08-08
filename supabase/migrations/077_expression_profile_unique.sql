-- ============================================
-- V4.2: Ensure expression_profiles has unique(user_id)
-- Prevents 406 errors from .single() when RLS returns >1 row
-- ============================================

-- Add unique constraint if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expression_profiles_user_id_key'
    AND conrelid = 'expression_profiles'::regclass
  ) THEN
    ALTER TABLE expression_profiles ADD CONSTRAINT expression_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Ensure RLS is enabled (idempotent)
ALTER TABLE expression_profiles ENABLE ROW LEVEL SECURITY;
