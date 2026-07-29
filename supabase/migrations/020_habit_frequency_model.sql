-- ============================================
-- 020: Habit OS Frequency Model Redesign
-- Replace target_days_per_week with frequency_type + frequency_value
-- ============================================

-- 1. Add new frequency columns
ALTER TABLE habits ADD COLUMN IF NOT EXISTS frequency_type TEXT NOT NULL DEFAULT 'daily'
  CHECK (frequency_type IN ('daily', 'weekly', 'monthly'));

ALTER TABLE habits ADD COLUMN IF NOT EXISTS frequency_value SMALLINT NOT NULL DEFAULT 1
  CHECK (frequency_value > 0);

-- 2. Migrate existing data
-- target_days_per_week = 7 → daily once per day (most common default)
-- target_days_per_week = 1..6 → weekly N times
-- target_days_per_week > 7 → monthly (edge case, treat as weekly with high frequency)
UPDATE habits
SET
  frequency_type = CASE
    WHEN target_days_per_week = 7 THEN 'daily'
    WHEN target_days_per_week <= 6 THEN 'weekly'
    ELSE 'weekly'
  END,
  frequency_value = CASE
    WHEN target_days_per_week = 7 THEN 1
    WHEN target_days_per_week <= 6 THEN target_days_per_week
    ELSE target_days_per_week
  END
WHERE target_days_per_week IS NOT NULL;

-- 3. Drop old column
ALTER TABLE habits DROP COLUMN IF EXISTS target_days_per_week;
