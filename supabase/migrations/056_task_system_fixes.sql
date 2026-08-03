-- ============================================
-- 056: Task System Fixes
-- 1. Ideas status → pending/converted/processed/dismissed
-- 2. Ideas → Task linkage (related_task_id)
-- 3. Tasks → WeeklyTheme linkage (weekly_theme_id)
-- 4. Performance indexes
-- ============================================

-- ── 1. ideas status constraint ──

-- Update default
ALTER TABLE public.ideas ALTER COLUMN status SET DEFAULT 'pending';

-- Backfill existing statuses to new values
UPDATE public.ideas SET status = 'pending' WHERE status = 'inbox';
UPDATE public.ideas SET status = 'dismissed' WHERE status = 'archived';
-- Catch-all: any status not in the new constraint → pending
UPDATE public.ideas SET status = 'pending' WHERE status NOT IN ('pending', 'converted', 'processed', 'dismissed');

-- Add CHECK constraint (drop first for idempotency)
ALTER TABLE public.ideas DROP CONSTRAINT IF EXISTS ideas_status_check;
ALTER TABLE public.ideas ADD CONSTRAINT ideas_status_check
  CHECK (status IN ('pending', 'converted', 'processed', 'dismissed'));

-- ── 2. ideas → tasks foreign key ──
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS related_task_id UUID
  REFERENCES tasks(id) ON DELETE SET NULL;

-- ── 3. tasks → weekly_themes foreign key ──
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS weekly_theme_id UUID
  REFERENCES weekly_themes(id) ON DELETE SET NULL;

-- ── 4. Indexes ──
CREATE INDEX IF NOT EXISTS idx_ideas_status ON public.ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_related_task ON public.ideas(related_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_weekly_theme ON tasks(weekly_theme_id);

-- ── Verify ──
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('ideas', 'tasks')
  AND column_name IN ('status', 'related_task_id', 'weekly_theme_id')
ORDER BY table_name, ordinal_position;
