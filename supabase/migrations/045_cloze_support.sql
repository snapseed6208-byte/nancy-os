-- ============================================
-- 045: Cloze test support for Expression Review
-- Add cloze_sentence column for pre-generated fill-in-the-blank sentences
-- ============================================

ALTER TABLE public.expressions ADD COLUMN IF NOT EXISTS cloze_sentence TEXT;
