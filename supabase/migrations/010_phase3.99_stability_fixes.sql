-- ============================================
-- Nancy OS — 010: Phase 3.99 Stability Fixes
-- P0.1: speaking_sessions schema fix
-- P1.4: Missing indexes
-- ============================================

-- ============================================
-- 1. speaking_sessions: add scenario + duration_seconds
--    Referenced by english-coach and daily-brief-agent
-- ============================================
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS scenario TEXT;
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- ============================================
-- 2. Missing indexes for high-traffic query paths
-- ============================================

-- speaking_sessions: context fetch in english-coach + daily-brief
CREATE INDEX IF NOT EXISTS idx_speaking_sessions_user_created
  ON speaking_sessions(user_id, created_at DESC);

-- money_records: monthly summary aggregation
CREATE INDEX IF NOT EXISTS idx_money_records_user_date
  ON money_records(user_id, date DESC);

-- ideas: reflection-agent weekly query
CREATE INDEX IF NOT EXISTS idx_ideas_user_created
  ON ideas(user_id, created_at DESC);

-- ai_memories: ordering by last_reinforced_at (all agents use this)
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_reinforced
  ON ai_memories(user_id, last_reinforced_at DESC);
