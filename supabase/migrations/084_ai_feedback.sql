-- ============================================
-- Phase 3.5: AI Feedback Loop
-- Records user feedback on AI suggestions for
-- continuous improvement and personalization.
-- ============================================

CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Which agent + action generated the suggestion
  agent_type TEXT NOT NULL,
  action TEXT NOT NULL,

  -- What kind of suggestion was rated
  suggestion_type TEXT,

  -- Optional reference to the specific suggestion
  suggestion_id TEXT,

  -- User's rating
  feedback TEXT NOT NULL CHECK (feedback IN (
    'helpful',
    'not_helpful',
    'partially_helpful'
  )),

  -- Optional free-text explanation
  user_comment TEXT,

  -- What the user was doing
  context JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user
  ON ai_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_agent
  ON ai_feedback(agent_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type
  ON ai_feedback(feedback, created_at DESC);

-- RLS
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own feedback" ON ai_feedback;
CREATE POLICY "Users manage own feedback"
  ON ai_feedback FOR ALL
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE ai_feedback IS
  'Phase 3.5: User feedback on AI suggestions. Used to track which suggestions are helpful and improve future responses.';
COMMENT ON COLUMN ai_feedback.agent_type IS
  'Which agent: chinese_expression, english_coach, reflection, asset_mining, task_breakdown, daily_brief, etc.';
COMMENT ON COLUMN ai_feedback.action IS
  'What action: analyze_expression, coaching_session, weekly_reflection, mine_from_text, etc.';
COMMENT ON COLUMN ai_feedback.suggestion_type IS
  'Type: improved_speech, answer_outline, diagnosis, topic, key_upgrades, etc.';
