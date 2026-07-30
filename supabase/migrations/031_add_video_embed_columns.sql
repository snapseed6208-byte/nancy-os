-- ============================================
-- Migration 031: Video embed support for workout_videos
-- Adds video_id, embed_url, thumbnail_url for internal video playback
-- ============================================

ALTER TABLE workout_videos
  ADD COLUMN IF NOT EXISTS video_id TEXT,
  ADD COLUMN IF NOT EXISTS embed_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN workout_videos.video_id IS 'Platform-specific video ID: B站 BV号, YouTube 11-char ID';
COMMENT ON COLUMN workout_videos.embed_url IS 'iframe embed URL for B站 player.bilibili.com and YouTube /embed';
COMMENT ON COLUMN workout_videos.thumbnail_url IS 'Thumbnail image URL, auto-populated for YouTube';
