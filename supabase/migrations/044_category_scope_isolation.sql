-- ============================================
-- 044: Category scope isolation
-- Split categories into resource_categories and expression_categories
-- ============================================

-- 1. Add scope column
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'resource';

-- 2. Mark existing English categories as expression scope
UPDATE public.categories SET scope = 'expression'
WHERE name IN ('生活', '工作', '社交', '情绪', '旅行', '学习', '商务', '影视');

-- 3. All others remain resource scope (default)
-- This includes the 11 default resource categories:
--   学习成长, 工作职业, 健康健身, 饮食生活, 生活技巧,
--   影视娱乐, 财商投资, 思维认知, 人际关系, 旅行体验, 灵感收藏

-- 4. Add check constraint
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_scope_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_scope_check
  CHECK (scope IN ('resource', 'expression'));

-- 5. Index for scope-filtered queries
CREATE INDEX IF NOT EXISTS idx_categories_scope ON public.categories(user_id, scope);
