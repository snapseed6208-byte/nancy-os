-- ============================================
-- 052: Capture Inbox — multi-modal content type support
-- Enables future content types (image, audio, link)
-- without further schema changes.
-- ============================================

ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]';

-- Enforce valid content types
ALTER TABLE public.ideas DROP CONSTRAINT IF EXISTS ideas_content_type_check;
ALTER TABLE public.ideas ADD CONSTRAINT ideas_content_type_check
  CHECK (content_type IN ('text', 'image', 'audio', 'link'));

-- Verify
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'ideas'
ORDER BY ordinal_position;
