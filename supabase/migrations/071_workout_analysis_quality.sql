-- ============================================
-- Migration 071: AI analysis quality tracking for workout_videos
-- Adds analysis_source, analysis_confidence, description columns
-- ============================================

ALTER TABLE workout_videos
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS analysis_source TEXT DEFAULT 'url_only',
  ADD COLUMN IF NOT EXISTS analysis_confidence TEXT DEFAULT 'medium';

COMMENT ON COLUMN workout_videos.description IS 'AI-generated description of the workout';
COMMENT ON COLUMN workout_videos.analysis_source IS 'Data source for AI analysis: url_only, api_metadata, full_page, manual';
COMMENT ON COLUMN workout_videos.analysis_confidence IS 'Confidence in AI analysis: high, medium, low';
