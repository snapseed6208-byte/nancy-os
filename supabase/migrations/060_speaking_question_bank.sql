-- ============================================
-- 060: Speaking Question Bank V2
-- Static question bank with history tracking
-- ============================================

-- 1. Speaking Questions table
CREATE TABLE IF NOT EXISTS speaking_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  normalized_question TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ielts', 'daily', 'professional', 'personal_growth')),
  topic TEXT NOT NULL CHECK (topic IN (
    'life_routine', 'food_health', 'travel_culture', 'people_relationships',
    'study_learning', 'work_career', 'technology', 'entertainment',
    'emotions', 'goals_future', 'experiences', 'opinions'
  )),
  part TEXT CHECK (part IN ('part1', 'part2', 'part3')),
  context TEXT,
  cue_points JSONB,
  tags TEXT[] DEFAULT '{}',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  import_batch_id UUID,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sq_user_mode_topic ON speaking_questions(user_id, mode, topic);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sq_user_content_hash ON speaking_questions(user_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_sq_user_part ON speaking_questions(user_id, part);
CREATE INDEX IF NOT EXISTS idx_sq_user_active ON speaking_questions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sq_normalized ON speaking_questions(user_id, normalized_question);

-- RLS
ALTER TABLE speaking_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own speaking_questions" ON speaking_questions FOR ALL USING (auth.uid() = user_id);

-- 2. Speaking Question History table
CREATE TABLE IF NOT EXISTS speaking_question_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES speaking_questions(id) ON DELETE CASCADE,
  session_id UUID REFERENCES speaking_sessions(id) ON DELETE SET NULL,
  practiced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fluency_score REAL,
  grammar_score REAL,
  vocabulary_score REAL,
  naturalness_score REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sqh_user_question ON speaking_question_history(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_sqh_user_practiced ON speaking_question_history(user_id, practiced_at);
CREATE INDEX IF NOT EXISTS idx_sqh_session ON speaking_question_history(session_id);

-- RLS
ALTER TABLE speaking_question_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own question history" ON speaking_question_history FOR ALL USING (auth.uid() = user_id);

-- 3. Speaking Import Batches table
CREATE TABLE IF NOT EXISTS speaking_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT,
  total_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sib_user_created ON speaking_import_batches(user_id, created_at);

-- RLS
ALTER TABLE speaking_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own import batches" ON speaking_import_batches FOR ALL USING (auth.uid() = user_id);

-- 4. Add question_id to speaking_sessions (nullable FK, links session to static question)
ALTER TABLE speaking_sessions ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES speaking_questions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_speaking_sessions_question ON speaking_sessions(question_id);
