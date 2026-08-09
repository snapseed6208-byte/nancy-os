-- ============================================
-- English SRS V3: Daily Review Session System
--
-- Problem: Training modes re-randomize expressions
-- each time. No same-day reinforcement tracking.
-- No practice history.
--
-- Solution: review_sessions anchors 15 daily items.
-- All modes read from the same session.
-- ============================================

-- ═══════════════════════════════════════
-- 1. Daily Review Sessions
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session date (one session per user per day)
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Target count (default 15)
  target_count INTEGER NOT NULL DEFAULT 15,

  -- Session status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),

  -- Current stage: recall → sentence → application
  current_stage TEXT NOT NULL DEFAULT 'recall'
    CHECK (current_stage IN ('recall', 'sentence', 'application')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- One session per user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_sessions_user_date
  ON review_sessions(user_id, session_date);

CREATE INDEX IF NOT EXISTS idx_review_sessions_user
  ON review_sessions(user_id, created_at DESC);

-- RLS
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own review sessions" ON review_sessions;
CREATE POLICY "Users manage own review sessions"
  ON review_sessions FOR ALL
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- 2. Session Items (per-expression state)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS review_session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  expression_id UUID NOT NULL REFERENCES expressions(id) ON DELETE CASCADE,

  -- Per-mode scores (NULL = not yet attempted in this mode)
  recall_score SMALLINT CHECK (recall_score BETWEEN 0 AND 5),
  sentence_score SMALLINT CHECK (sentence_score BETWEEN 0 AND 5),
  application_score SMALLINT CHECK (application_score BETWEEN 0 AND 5),

  -- User's sentence answer (for sentence mode)
  user_sentence TEXT,
  ai_feedback TEXT,

  -- Item status within this session
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',        -- not yet practiced
      'in_progress',    -- currently practicing
      'passed',         -- passed all attempted modes
      'failed',         -- failed current mode (enters reinforcement)
      'reinforcement',  -- in reinforcement queue
      'completed'       -- fully done for the day
    )),

  -- How many times practiced today
  attempt_count INTEGER NOT NULL DEFAULT 0,

  -- Reinforcement round (0 = main, 1-3 = reinforcement)
  reinforcement_round INTEGER NOT NULL DEFAULT 0,

  last_practice_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_session_items_session
  ON review_session_items(session_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_session_items_unique
  ON review_session_items(session_id, expression_id);

-- RLS
ALTER TABLE review_session_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own session items" ON review_session_items;
CREATE POLICY "Users manage own session items"
  ON review_session_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM review_sessions
      WHERE review_sessions.id = review_session_items.session_id
      AND review_sessions.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════
-- 3. Practice Logs (detailed history)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS expression_practice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expression_id UUID NOT NULL REFERENCES expressions(id) ON DELETE CASCADE,
  session_id UUID REFERENCES review_sessions(id) ON DELETE SET NULL,

  -- Which training mode
  mode TEXT NOT NULL
    CHECK (mode IN ('recall', 'recognition', 'cloze', 'sentence', 'application')),

  -- User's answer
  answer TEXT,

  -- AI or system feedback
  feedback TEXT,

  -- Score (0-5)
  score SMALLINT CHECK (score BETWEEN 0 AND 5),

  -- Additional context (JSONB for flexibility)
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expression_practice_logs_user
  ON expression_practice_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expression_practice_logs_expression
  ON expression_practice_logs(expression_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expression_practice_logs_session
  ON expression_practice_logs(session_id);

-- RLS
ALTER TABLE expression_practice_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own practice logs" ON expression_practice_logs;
CREATE POLICY "Users manage own practice logs"
  ON expression_practice_logs FOR ALL
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- Comments
-- ═══════════════════════════════════════

COMMENT ON TABLE review_sessions IS
  'English SRS V3: Daily review session. One per user per day. Anchors 15 expressions for the day.';
COMMENT ON TABLE review_session_items IS
  'Per-expression state within a review session. Tracks scores per mode, reinforcement rounds.';
COMMENT ON TABLE expression_practice_logs IS
  'Immutable log of every practice attempt. Used for learning history and analytics.';
