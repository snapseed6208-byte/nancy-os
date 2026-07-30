-- ============================================
-- Migration 028: AI Insights & Suggestions
-- Adds deeper AI understanding fields to journal_entries
-- ============================================

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_suggestions JSONB DEFAULT '[]';
