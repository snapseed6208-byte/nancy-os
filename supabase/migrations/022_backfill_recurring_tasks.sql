-- ============================================
-- 022: Backfill — Convert old one_time tasks to recurring
-- Based on title keyword matching
-- ============================================

-- 1. Daily recurring: 每天 / 每日 / 每天保证 / 每日记录
UPDATE tasks
SET
  task_type = 'recurring',
  frequency_type = 'daily',
  target_count = 1,
  completed_count = CASE WHEN status = 'done' THEN 1 ELSE 0 END,
  cycle_start_date = CURRENT_DATE
WHERE task_type = 'one_time'
  AND status != 'done'
  AND (
    title LIKE '%每天%'
    OR title LIKE '%每日%'
  );

-- 2. Weekly recurring: 每周X次 (extract number between 每周 and 次)
-- Matches: "每周3次有氧运动", "每周进行2次力量训练", "每周 2 次"
-- Uses broader regex to handle intervening characters like "进行"
UPDATE tasks
SET
  task_type = 'recurring',
  frequency_type = 'weekly',
  target_count = CASE
    WHEN title ~ '每周.*?(\d+)\s*次' THEN
      (regexp_match(title, '每周.*?(\d+)\s*次'))[1]::int
    ELSE 1
  END,
  completed_count = CASE WHEN status = 'done' THEN
    CASE
      WHEN title ~ '每周.*?(\d+)\s*次' THEN
        (regexp_match(title, '每周.*?(\d+)\s*次'))[1]::int
      ELSE 1
    END
    ELSE 0
  END,
  cycle_start_date = CURRENT_DATE
WHERE task_type = 'one_time'
  AND status != 'done'
  AND title ~ '每周.*?(\d+)\s*次';

-- 3. Weekly recurring without explicit number: "每周测量" "每周进行" etc.
-- Default target_count=1
UPDATE tasks
SET
  task_type = 'recurring',
  frequency_type = 'weekly',
  target_count = 1,
  completed_count = CASE WHEN status = 'done' THEN 1 ELSE 0 END,
  cycle_start_date = CURRENT_DATE
WHERE task_type = 'one_time'
  AND status != 'done'
  AND title LIKE '%每周%'
  AND title !~ '每周.*?(\d+)\s*次';  -- exclude already converted

-- 4. Monthly recurring: 每月
UPDATE tasks
SET
  task_type = 'recurring',
  frequency_type = 'monthly',
  target_count = 1,
  completed_count = CASE WHEN status = 'done' THEN 1 ELSE 0 END,
  cycle_start_date = CURRENT_DATE
WHERE task_type = 'one_time'
  AND status != 'done'
  AND title LIKE '%每月%';

-- 5. Verify: show converted counts
DO $$
DECLARE
  daily_count int;
  weekly_count int;
  monthly_count int;
  one_time_count int;
BEGIN
  SELECT COUNT(*) INTO daily_count FROM tasks WHERE task_type = 'recurring' AND frequency_type = 'daily';
  SELECT COUNT(*) INTO weekly_count FROM tasks WHERE task_type = 'recurring' AND frequency_type = 'weekly';
  SELECT COUNT(*) INTO monthly_count FROM tasks WHERE task_type = 'recurring' AND frequency_type = 'monthly';
  SELECT COUNT(*) INTO one_time_count FROM tasks WHERE task_type = 'one_time';

  RAISE NOTICE 'Backfill complete: daily=%, weekly=%, monthly=%, one_time=%',
    daily_count, weekly_count, monthly_count, one_time_count;
END $$;
