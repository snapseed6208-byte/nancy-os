-- ============================================
-- 061: Speaking Question Bank RPC Helpers
-- ============================================

-- RPC to safely increment usage_count
CREATE OR REPLACE FUNCTION increment_question_usage(q_id UUID)
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
AS $$
  UPDATE speaking_questions
  SET usage_count = usage_count + 1,
      last_used_at = NOW(),
      updated_at = NOW()
  WHERE id = q_id;
$$;
