-- ============================================
-- Nancy OS — 011: Identity Layer v2
-- Extends user_id auto-fill trigger to all
-- tables not covered by migration 005.
-- Defense-in-depth: client always sets user_id
-- explicitly; this trigger is the safety net.
-- ============================================

-- Trigger function already exists from 005:
--   set_user_id_on_insert()
--   Sets NEW.user_id := auth.uid() IF NULL

-- ── Planning tables ──

DROP TRIGGER IF EXISTS trg_set_user_id_goals ON goals;
CREATE TRIGGER trg_set_user_id_goals
  BEFORE INSERT ON goals
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id_tasks ON tasks;
CREATE TRIGGER trg_set_user_id_tasks
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

-- ── Habit tables ──

DROP TRIGGER IF EXISTS trg_set_user_id_habits ON habits;
CREATE TRIGGER trg_set_user_id_habits
  BEFORE INSERT ON habits
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id_habit_records ON habit_records;
CREATE TRIGGER trg_set_user_id_habit_records
  BEFORE INSERT ON habit_records
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

-- ── Memory & Feedback tables ──

DROP TRIGGER IF EXISTS trg_set_user_id_memory_feedback ON memory_feedback;
CREATE TRIGGER trg_set_user_id_memory_feedback
  BEFORE INSERT ON memory_feedback
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id_agent_feedback ON agent_feedback;
CREATE TRIGGER trg_set_user_id_agent_feedback
  BEFORE INSERT ON agent_feedback
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();
