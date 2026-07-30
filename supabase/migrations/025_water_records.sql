-- ============================================
-- 025: Water Intake Tracking
-- Lightweight hydration logging for Home dashboard
-- ============================================

CREATE TABLE IF NOT EXISTS water_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_ml INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE water_records ADD CONSTRAINT check_amount_positive CHECK (amount_ml > 0);

COMMENT ON TABLE water_records IS 'Individual water intake entries for hydration tracking';
COMMENT ON COLUMN water_records.amount_ml IS 'Amount consumed in milliliters (1-5000)';
COMMENT ON COLUMN water_records.recorded_at IS 'When the user consumed the water';

ALTER TABLE water_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own water_records"
  ON water_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_water_records_user_date
  ON water_records (user_id, recorded_at DESC);
