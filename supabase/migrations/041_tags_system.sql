-- Migration 041: Tags system + categories.type
-- Category = 一级知识领域 (system/custom)
-- Tag = 内容关键词 (user-scoped, many-to-many via resource_tags)

-- 1. Add type column to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'custom';

-- Mark the 11 default categories as system
UPDATE public.categories SET type = 'system' WHERE name IN (
  '学习成长', '工作职业', '健康健身', '饮食生活', '生活技巧',
  '影视娱乐', '财商投资', '思维认知', '人际关系', '旅行体验', '灵感收藏'
);

-- 2. Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, user_id)
);

-- 3. Create resource_tags junction table
CREATE TABLE IF NOT EXISTS public.resource_tags (
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

-- 4. RLS for tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own tags' AND tablename = 'tags'
  ) THEN
    CREATE POLICY "Users can manage own tags" ON public.tags
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. RLS for resource_tags
ALTER TABLE public.resource_tags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own resource_tags' AND tablename = 'resource_tags'
  ) THEN
    CREATE POLICY "Users can manage own resource_tags" ON public.resource_tags
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.resources r WHERE r.id = resource_id AND r.user_id = auth.uid())
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.resources r WHERE r.id = resource_id AND r.user_id = auth.uid())
      );
  END IF;
END $$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_tags_user ON public.tags(user_id, name);
CREATE INDEX IF NOT EXISTS idx_resource_tags_resource ON public.resource_tags(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_tags_tag ON public.resource_tags(tag_id);
