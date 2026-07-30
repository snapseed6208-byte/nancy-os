-- Migration 038: User-defined categories system
-- Replaces fixed module-based categorization with customizable categories
-- Part of Resource Inbox → Personal AI Knowledge Base overhaul

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'categories'
  ) THEN
    CREATE TABLE public.categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_categories_user ON public.categories(user_id, created_at DESC);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can manage own categories'
      AND tablename = 'categories'
  ) THEN
    CREATE POLICY "Users can manage own categories" ON public.categories
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Seed default categories for existing users who have resources but no categories
-- (Only runs on new installations; existing users can create their own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can view own categories'
      AND tablename = 'categories'
  ) THEN
    -- Placeholder: default categories are created client-side on first visit
    -- This migration just creates the table infrastructure
    RAISE NOTICE 'Categories table created. Default categories are seeded client-side.';
  END IF;
END $$;
