-- ============================================
-- 026: Daily Health Checklists
-- AI-powered daily health checklist with baseline + AI tips
-- ============================================

CREATE TABLE IF NOT EXISTS daily_health_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  generated_by TEXT DEFAULT 'mixed' CHECK (generated_by IN ('ai', 'manual', 'mixed')),
  ai_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS daily_health_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID NOT NULL REFERENCES daily_health_checklists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('water', 'workout', 'diet', 'sleep', 'recovery', 'habit')),
  item_type TEXT NOT NULL DEFAULT 'baseline' CHECK (item_type IN ('baseline', 'ai')),
  sort_order SMALLINT DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  linked_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE daily_health_checklists IS 'Daily health checklist container — one per user per day';
COMMENT ON TABLE daily_health_items IS 'Individual checklist items — baseline (auto-detect) + AI tips';

ALTER TABLE daily_health_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_health_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own daily_health_checklists"
  ON daily_health_checklists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own daily_health_items"
  ON daily_health_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_health_checklists_user_date
  ON daily_health_checklists (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_health_items_checklist
  ON daily_health_items (checklist_id);

CREATE INDEX IF NOT EXISTS idx_daily_health_items_user_status
  ON daily_health_items (user_id, is_completed, completed_at);
