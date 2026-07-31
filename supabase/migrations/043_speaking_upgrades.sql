-- ============================================
-- 043: Speaking Practice Module Upgrades
-- Add category, mode, expression tracking to speaking tables
-- ============================================

-- speaking_sessions: category + mode + expression tracking
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'free_speaking';
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS recommended_expressions JSONB DEFAULT '[]';
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS new_expressions_learned INTEGER DEFAULT 0;

-- speaking_attempts: reference answer + expression tracking
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS reference_answer TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS expressions_used JSONB DEFAULT '[]';
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS expressions_missed JSONB DEFAULT '[]';

-- Index for filtering sessions by category
CREATE INDEX IF NOT EXISTS idx_speaking_sessions_category
  ON speaking_sessions(user_id, category);
