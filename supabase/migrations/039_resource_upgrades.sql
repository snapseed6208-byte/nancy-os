-- Migration 039: Resource table upgrades for 3-layer knowledge system
-- Layer 1: Original Source preservation
-- Layer 2: AI Understanding enrichment
-- Layer 3: Personal Knowledge tracking
-- Part of Resource Inbox → Personal AI Knowledge Base overhaul

-- Layer 1: Original Source
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS source_platform TEXT;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS source_author TEXT;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS source_title TEXT;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS source_cover TEXT;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS raw_content TEXT;

-- Layer 2: AI Understanding (enhanced)
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS ai_important_quotes JSONB DEFAULT '[]';
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS ai_recommended_category JSONB;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS ai_applicable_scenarios JSONB DEFAULT '[]';
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS ai_related_knowledge JSONB DEFAULT '[]';
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS ai_source_extracted_at TIMESTAMPTZ;

-- Layer 3: Personal Knowledge
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'saved';
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS user_notes TEXT;

-- Category linking
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources(user_id, category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resources_status ON public.resources(user_id, status);
CREATE INDEX IF NOT EXISTS idx_resources_source_platform ON public.resources(user_id, source_platform) WHERE source_platform IS NOT NULL;
