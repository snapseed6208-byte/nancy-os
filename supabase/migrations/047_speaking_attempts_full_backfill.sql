-- ============================================
-- 047: speaking_attempts FULL column backfill
-- Production table is missing multiple 001 columns.
-- Add ALL columns from 001/019/043 that might be missing.
-- ============================================

-- ── 001_full_schema columns (all nullable TEXT/REAL) ──
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS transcribed_text TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS main_problems TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS useful_corrections TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS better_chunks TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS one_better_example TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS fluency_score REAL;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS grammar_score REAL;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS vocabulary_score REAL;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS naturalness_score REAL;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS audio_duration REAL;

-- ── 019_phase1.5_fixes (AI traceability) ──
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS ai_model TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS ai_prompt_version TEXT;

-- ── 043_speaking_upgrades ──
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS reference_answer TEXT;
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS expressions_used JSONB DEFAULT '[]';
ALTER TABLE speaking_attempts ADD COLUMN IF NOT EXISTS expressions_missed JSONB DEFAULT '[]';
