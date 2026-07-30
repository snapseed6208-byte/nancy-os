-- ============================================
-- Migration 032: Workout metadata + AI analysis tracking
-- Adds equipment, tags, ai_analysis_status to workout_videos
-- ============================================

ALTER TABLE workout_videos
  ADD COLUMN IF NOT EXISTS equipment TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS ai_analysis_status TEXT DEFAULT 'pending';

COMMENT ON COLUMN workout_videos.equipment IS '训练器材：哑铃/弹力带/自重/杠铃/瑜伽垫等';
COMMENT ON COLUMN workout_videos.tags IS 'AI 生成的训练标签，3-6个中文标签';
COMMENT ON COLUMN workout_videos.ai_analysis_status IS 'AI 解析状态: pending/completed/failed';
