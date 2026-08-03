CREATE TABLE IF NOT EXISTS important_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TEXT,
  event_type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  related_task_id UUID,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imp_events_user_date ON important_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_imp_events_user_pri ON important_events(user_id, priority, event_date);

ALTER TABLE important_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own important_events" ON important_events FOR ALL USING (auth.uid() = user_id);
