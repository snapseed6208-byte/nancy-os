-- Fix ai_review_status CHECK constraint to allow 'confirmed'
-- The old constraint was created manually in Supabase Dashboard and doesn't include 'confirmed'
-- Valid states: pending (AI generated), confirmed (user approved), rejected (user declined)
-- 'edited' is removed — editing implies approval, so it uses 'confirmed' instead

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_ai_review_status_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_ai_review_status_check
  CHECK (ai_review_status IS NULL OR ai_review_status IN ('pending', 'confirmed', 'rejected'));
