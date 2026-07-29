-- ============================================
-- 016: English Expression Import System
-- Adds import tracking table + extends expressions
-- ============================================

-- 1. Expression imports tracking table
CREATE TABLE IF NOT EXISTS expression_imports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type   TEXT NOT NULL CHECK (source_type IN ('file', 'text')),
  source_name   TEXT,
  source_hash   TEXT,
  status        TEXT NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing', 'review', 'imported', 'cancelled')),
  stats         JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expression_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own expression_imports"
  ON expression_imports FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_expression_imports_user ON expression_imports(user_id, created_at);

DROP TRIGGER IF EXISTS trg_set_user_id_expression_imports ON expression_imports;
CREATE TRIGGER trg_set_user_id_expression_imports
  BEFORE INSERT ON expression_imports
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

-- 2. Extend expressions table
ALTER TABLE expressions ADD COLUMN IF NOT EXISTS import_batch_id UUID;
ALTER TABLE expressions ADD COLUMN IF NOT EXISTS difficulty_level TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expressions_import_batch_id_fkey'
  ) THEN
    ALTER TABLE expressions
      ADD CONSTRAINT expressions_import_batch_id_fkey
      FOREIGN KEY (import_batch_id) REFERENCES expression_imports(id) ON DELETE SET NULL;
  END IF;
END;
$$;
