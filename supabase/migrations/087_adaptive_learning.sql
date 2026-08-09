-- ============================================
-- English SRS V3.1: Adaptive Learning Loop
--
-- Adds difficulty diagnosis and reinforcement
-- tracking to review_session_items.
-- ============================================

-- ═══════════════════════════════════════
-- 1. Difficulty diagnosis
-- ═══════════════════════════════════════

ALTER TABLE review_session_items
  ADD COLUMN IF NOT EXISTS difficulty_diagnosis JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN review_session_items.difficulty_diagnosis IS
  'V3.1: AI diagnosis of WHY this expression is difficult.
   {problem_type: memory|application|context|fluency,
    sub_problems: {recall,usage,context,pronunciation,grammar},
    suggestion: string, confidence: 0-1}';

-- ═══════════════════════════════════════
-- 2. Reinforcement status tracking
-- ═══════════════════════════════════════

ALTER TABLE review_session_items
  ADD COLUMN IF NOT EXISTS reinforcement_status TEXT
    CHECK (reinforcement_status IN (
      'none',           -- not in reinforcement
      'queued',         -- waiting for reinforcement
      'round1_recall',  -- Round 1: CN → EN recall
      'round2_cloze',   -- Round 2: fill-in-blank
      'round3_context', -- Round 3: real scenario sentence
      'mastered',       -- passed reinforcement
      'max_rounds'      -- reached max attempts
    ))
    DEFAULT 'none';

COMMENT ON COLUMN review_session_items.reinforcement_status IS
  'V3.1: Current stage within the reinforcement pipeline';

-- ═══════════════════════════════════════
-- 3. Personal context reference
-- ═══════════════════════════════════════

ALTER TABLE review_session_items
  ADD COLUMN IF NOT EXISTS personal_context JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN review_session_items.personal_context IS
  'V3.1: Personal context used for practice.
   {asset_id, asset_title, scenario, prompt}';

-- ═══════════════════════════════════════
-- 4. Classification label
-- ═══════════════════════════════════════

ALTER TABLE review_session_items
  ADD COLUMN IF NOT EXISTS result_classification TEXT
    CHECK (result_classification IN (
      'mastered',       -- ready for sentence
      'needs_reinforcement', -- needs targeted practice
      'needs_context'   -- needs personal scenario
    ));

COMMENT ON COLUMN review_session_items.result_classification IS
  'V3.1: Classification after recall: mastered / needs_reinforcement / needs_context';
