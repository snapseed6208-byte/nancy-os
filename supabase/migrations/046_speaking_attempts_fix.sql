-- ============================================
-- 046: speaking_attempts column backfill + Storage RLS
-- Fixes production DB drift from migrations 001/019/043
-- ============================================

-- ── 1. Columns from 001_full_schema that may be missing ──
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS audio_duration REAL;

-- ── 2. Columns from 019_phase1.5_fixes (AI traceability) ──
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS ai_model TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS ai_prompt_version TEXT;

-- ── 3. Columns from 043_speaking_upgrades ──
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS reference_answer TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS expressions_used JSONB DEFAULT '[]';
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS expressions_missed JSONB DEFAULT '[]';

-- ── 4. Storage RLS for speaking-audio bucket ──
-- Upload: authenticated users only
DROP POLICY IF EXISTS "Users can upload speaking-audio" ON storage.objects;
CREATE POLICY "Users can upload speaking-audio" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND bucket_id = 'speaking-audio'
  );

-- Read: public (for audio playback in history)
DROP POLICY IF EXISTS "Public read speaking-audio" ON storage.objects;
CREATE POLICY "Public read speaking-audio" ON storage.objects
  FOR SELECT USING (bucket_id = 'speaking-audio');
