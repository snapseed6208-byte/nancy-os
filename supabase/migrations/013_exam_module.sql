-- ============================================
-- Nancy OS — Exam / Study Module
-- Tracks exams, courses, and study sessions
-- ============================================

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'self_study' CHECK (category IN ('ielts', 'course', 'certificate', 'self_study')),
  target_score TEXT,
  exam_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own exams"
  ON exams FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_exams_user_status ON exams(user_id, status);

CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  topic TEXT,
  score DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own study_sessions"
  ON study_sessions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON study_sessions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_study_sessions_exam ON study_sessions(exam_id);

-- Trigger defense: auto-fill user_id on INSERT (reuses set_user_id_on_insert from 005)
DROP TRIGGER IF EXISTS trg_set_user_id_exams ON exams;
CREATE TRIGGER trg_set_user_id_exams
  BEFORE INSERT ON exams
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id_study_sessions ON study_sessions;
CREATE TRIGGER trg_set_user_id_study_sessions
  BEFORE INSERT ON study_sessions
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();
