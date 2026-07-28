-- ============================================
-- Nancy OS — 005: Phase 3.5 Data Stability Fixes
-- User Identity Layer — DB trigger fallback
-- ============================================

-- Trigger function: auto-populate user_id from auth.uid() on INSERT
-- This is a DEFENSE-IN-DEPTH fallback. The client should always
-- explicitly set user_id, but this trigger catches any missed cases.
CREATE OR REPLACE FUNCTION set_user_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to all Life Trace + English tables that have user_id

-- Life Trace tables
DROP TRIGGER IF EXISTS trg_set_user_id_ideas ON ideas;
CREATE TRIGGER trg_set_user_id_ideas
  BEFORE INSERT ON ideas
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id_journal_entries ON journal_entries;
CREATE TRIGGER trg_set_user_id_journal_entries
  BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id_mood_records ON mood_records;
CREATE TRIGGER trg_set_user_id_mood_records
  BEFORE INSERT ON mood_records
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id_money_records ON money_records;
CREATE TRIGGER trg_set_user_id_money_records
  BEFORE INSERT ON money_records
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

-- English OS tables
DROP TRIGGER IF EXISTS trg_set_user_id_expressions ON expressions;
CREATE TRIGGER trg_set_user_id_expressions
  BEFORE INSERT ON expressions
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id_expression_reviews ON expression_reviews;
CREATE TRIGGER trg_set_user_id_expression_reviews
  BEFORE INSERT ON expression_reviews
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id_speaking_sessions ON speaking_sessions;
CREATE TRIGGER trg_set_user_id_speaking_sessions
  BEFORE INSERT ON speaking_sessions
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id_speaking_attempts ON speaking_attempts;
CREATE TRIGGER trg_set_user_id_speaking_attempts
  BEFORE INSERT ON speaking_attempts
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();
