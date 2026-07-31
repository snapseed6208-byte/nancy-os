-- ============================================
-- 048: speaking-audio bucket public flag fix
-- getPublicUrl requires bucket.public = true for
-- unauthenticated audio playback in <audio> tag
-- ============================================

UPDATE storage.buckets SET public = true WHERE id = 'speaking-audio';

-- Verify: should return public = true
SELECT id, name, public FROM storage.buckets WHERE id = 'speaking-audio';
