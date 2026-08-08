-- ============================================
-- 081: Profile Enrichment — Add missing columns
-- Aligns profiles table with production schema reference
-- and UserProfileRow interface in nancy-context.ts
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_field TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS life_theme TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS energy_pattern JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_milestone TEXT;
