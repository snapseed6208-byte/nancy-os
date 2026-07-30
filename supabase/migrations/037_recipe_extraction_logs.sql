-- Migration 037: Recipe extraction audit log
-- Tracks every content extraction attempt for observability and debugging
-- Part of Phase 2.5-E

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recipe_extraction_logs'
  ) THEN
    CREATE TABLE public.recipe_extraction_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
      source_type TEXT,
      extractor TEXT NOT NULL DEFAULT 'source-extractor-agent',
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_extraction_logs_recipe ON public.recipe_extraction_logs(recipe_id);
    CREATE INDEX idx_extraction_logs_created ON public.recipe_extraction_logs(created_at DESC);
  END IF;
END $$;

-- Enable RLS (no-op if already enabled)
ALTER TABLE public.recipe_extraction_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can view own extraction logs'
      AND tablename = 'recipe_extraction_logs'
  ) THEN
    CREATE POLICY "Users can view own extraction logs" ON public.recipe_extraction_logs
      FOR SELECT USING (
        auth.uid() = (SELECT user_id FROM public.recipes WHERE id = recipe_id)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Service role can manage extraction logs'
      AND tablename = 'recipe_extraction_logs'
  ) THEN
    CREATE POLICY "Service role can manage extraction logs" ON public.recipe_extraction_logs
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
