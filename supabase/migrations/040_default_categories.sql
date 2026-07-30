-- Migration 040: Seed 11 default categories for all existing users
-- Category/tag separation overhaul — every user gets these defaults

INSERT INTO public.categories (user_id, name, icon, color)
SELECT u.id, d.name, d.icon, d.color
FROM auth.users u
CROSS JOIN (VALUES
  ('学习成长', '📚', 'text-accent-sky'),
  ('工作职业', '💼', 'text-accent-rose'),
  ('健康健身', '💪', 'text-emerald-600'),
  ('饮食生活', '🍽️', 'text-amber-600'),
  ('生活技巧', '🔧', 'text-purple-600'),
  ('影视娱乐', '🎬', 'text-indigo-600'),
  ('财商投资', '💰', 'text-teal-600'),
  ('思维认知', '🧠', 'text-sage-deep'),
  ('人际关系', '🤝', 'text-accent-warm'),
  ('旅行体验', '✈️', 'text-cyan-600'),
  ('灵感收藏', '💡', 'text-yellow-600')
) AS d(name, icon, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.user_id = u.id AND c.name = d.name
);
