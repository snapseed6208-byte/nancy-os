-- ============================================
-- Nancy OS — 006: Phase 3.7 Memory Governance
-- Memory state machine + evidence + feedback
-- ============================================

-- ============================================
-- 1. AI Memories — add status, reinforcement_count, evidence
-- ============================================

ALTER TABLE ai_memories ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'candidate';
-- 'candidate' | 'probable' | 'confirmed' | 'rejected' | 'outdated'

ALTER TABLE ai_memories ADD COLUMN IF NOT EXISTS reinforcement_count INTEGER DEFAULT 1;

ALTER TABLE ai_memories ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '[]';
-- [{ table: "journal_entries", source_id: "uuid", snippet: "...", extracted_at: "ISO" }]

-- Dedup index: same user + same type + same content prefix (first 80 chars)
-- Prevents duplicate memories from multiple reflection runs
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_memories_dedup
  ON ai_memories(user_id, memory_type, LEFT(content, 80));

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_status
  ON ai_memories(user_id, status);

-- ============================================
-- 2. Memory Feedback — user confirmation/rejection
-- ============================================

CREATE TABLE IF NOT EXISTS memory_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  memory_id UUID NOT NULL REFERENCES ai_memories(id) ON DELETE CASCADE,

  action TEXT NOT NULL,
  -- 'confirm' | 'reject' | 'modify'

  reason TEXT,
  -- 可选：用户为什么同意/不同意这条记忆

  modified_content TEXT,
  -- 当 action='modify' 时，用户修改后的内容

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_feedback_memory
  ON memory_feedback(memory_id);

CREATE INDEX IF NOT EXISTS idx_memory_feedback_user
  ON memory_feedback(user_id, created_at DESC);

ALTER TABLE memory_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own memory_feedback"
  ON memory_feedback FOR ALL USING (auth.uid() = user_id);
