-- ============================================
-- Migration 100: Workout video source metadata
-- Persists raw platform metadata for retries and source-quality tracking.
-- ============================================

ALTER TABLE workout_videos
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN workout_videos.metadata IS
  'Raw video source metadata: title, description, author, cover, source, fetched_at';
