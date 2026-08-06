-- ============================================
-- Migration 070: Chinese STT metadata columns
-- Adds transcript_source and stt_success to chinese_speaking_attempts.
-- ============================================

ALTER TABLE chinese_speaking_attempts
ADD COLUMN IF NOT EXISTS transcript_source TEXT;

ALTER TABLE chinese_speaking_attempts
ADD COLUMN IF NOT EXISTS stt_success BOOLEAN;

COMMENT ON COLUMN chinese_speaking_attempts.transcript_source IS 'How the final transcript was obtained: aliyun_realtime, browser_chinese, user_manual, or none';
COMMENT ON COLUMN chinese_speaking_attempts.stt_success IS 'Whether STT produced a valid transcript (true) or failed/returned empty (false)';
