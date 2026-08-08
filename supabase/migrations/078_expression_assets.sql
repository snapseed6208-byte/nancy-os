-- ============================================
-- Phase 4: Expression Asset Library
-- Dedicated table for Nancy's long-term personal
-- expression database (stories, cases, viewpoints,
-- quotes, quality expressions).
-- ============================================

-- 1. Create expression_assets table
CREATE TABLE IF NOT EXISTS expression_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Asset classification
  asset_type TEXT NOT NULL CHECK (
    asset_type IN (
      'personal_story',
      'experience_case',
      'viewpoint',
      'quality_expression',
      'quote'
    )
  ),
  title TEXT NOT NULL,

  -- Core content (type-specific JSONB)
  asset_data JSONB NOT NULL,

  -- ═══ Evidence tracing ═══
  -- No asset can exist without source evidence
  source_attempt_id UUID REFERENCES chinese_speaking_attempts(id)
    ON DELETE SET NULL,
  source_session_id UUID REFERENCES chinese_speaking_sessions(id)
    ON DELETE SET NULL,
  extracted_from_transcript TEXT NOT NULL
    CHECK (char_length(extracted_from_transcript) > 0),
  evidence_quote TEXT NOT NULL
    CHECK (char_length(evidence_quote) > 0),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium')),
  fact_status TEXT NOT NULL DEFAULT 'user_confirmed' CHECK (
    fact_status IN ('user_confirmed', 'user_edited', 'ai_suggested')
  ),

  -- Indexing & retrieval
  tags TEXT[] NOT NULL DEFAULT '{}',

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'archived', 'deleted')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expression_assets_user
  ON expression_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_expression_assets_type
  ON expression_assets(user_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_expression_assets_tags
  ON expression_assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_expression_assets_status
  ON expression_assets(user_id, status);

-- RLS
ALTER TABLE expression_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own assets" ON expression_assets;
CREATE POLICY "Users manage own assets"
  ON expression_assets FOR ALL
  USING (auth.uid() = user_id);

-- 2. Add temporary asset_candidates to attempts
ALTER TABLE chinese_speaking_attempts
  ADD COLUMN IF NOT EXISTS asset_candidates JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN chinese_speaking_attempts.asset_candidates IS
  'Phase 4: AI-generated expression asset candidates from this attempt. Array of {type, title, asset_data, tags, confidence, evidence_quote, extracted_from_transcript}. Cleared after user confirms/rejects.';
