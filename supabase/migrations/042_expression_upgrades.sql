-- Migration 042: Expression system upgrades
-- Adds enhanced learning fields, SRS state, and category support

-- 1. Enhanced learning fields (AI-extracted)
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS usage_note TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS memory_tip TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS common_mistakes TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS context TEXT;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS common_patterns TEXT;

-- 2. Difficulty level (verify and add constraint)
-- Column was added in migration 016, but never got a CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expressions_difficulty_check'
  ) THEN
    ALTER TABLE public.expressions ADD CONSTRAINT expressions_difficulty_check
      CHECK (difficulty_level IS NULL OR difficulty_level IN ('beginner', 'intermediate', 'advanced'));
  END IF;
END $$;

-- 3. Category support (leverage existing categories table)
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS category_id UUID
  REFERENCES public.categories(id) ON DELETE SET NULL;

-- 4. SRS state machine
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS ease_factor REAL DEFAULT 2.5;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS repetitions INTEGER DEFAULT 0;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;
ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'active';

-- 5. Seed English-specific categories for existing users
INSERT INTO public.categories (user_id, name, icon, color, type)
SELECT u.id, d.name, d.icon, d.color, 'system'
FROM auth.users u
CROSS JOIN (VALUES
  ('生活', '🏠', 'text-accent-sky'),
  ('工作', '💼', 'text-accent-rose'),
  ('社交', '🤝', 'text-accent-warm'),
  ('情绪', '😊', 'text-amber-600'),
  ('旅行', '✈️', 'text-cyan-600'),
  ('学习', '📚', 'text-sage-deep'),
  ('商务', '📊', 'text-indigo-600'),
  ('影视', '🎬', 'text-purple-600')
) AS d(name, icon, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.user_id = u.id AND c.name = d.name
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_expressions_category ON public.expressions(category_id);
CREATE INDEX IF NOT EXISTS idx_expressions_review_status ON public.expressions(user_id, review_status);
CREATE INDEX IF NOT EXISTS idx_expressions_last_reviewed ON public.expressions(user_id, last_reviewed_at);
