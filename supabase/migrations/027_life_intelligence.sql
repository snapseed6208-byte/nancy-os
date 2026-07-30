-- ============================================
-- Migration 027: Life Intelligence — journal_entries schema upgrade
-- Phase D: AI understanding layer for Life Trace
-- ============================================

-- 1. Add new AI columns for the life-analysis-agent
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_emotion_analysis TEXT,
  ADD COLUMN IF NOT EXISTS ai_keywords TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_events TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_themes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_patterns JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_actions JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_thoughts JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_analysis_version TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Drop deprecated columns (safe — IF EXISTS skips if missing)
ALTER TABLE journal_entries
  DROP COLUMN IF EXISTS entry_type,
  DROP COLUMN IF EXISTS raw_transcript;

-- 3. Migrate existing ai_keywords → ai_themes (safe — no-op if no data)
UPDATE journal_entries
  SET ai_themes = ai_keywords
  WHERE cardinality(ai_themes) = 0
    AND ai_keywords IS NOT NULL
    AND cardinality(ai_keywords) > 0;

-- 4. Mark any existing AI data as legacy version
UPDATE journal_entries
  SET ai_analysis_version = 'legacy'
  WHERE ai_summary IS NOT NULL
    AND ai_analysis_version IS NULL;
