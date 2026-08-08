-- ============================================
-- Phase 3.1: Material Card — cognitive buffer layer
-- Stores AI-generated material card in resources.ai_analysis JSONB
-- ============================================

ALTER TABLE resources ADD COLUMN IF NOT EXISTS ai_analysis JSONB;

COMMENT ON COLUMN resources.ai_analysis IS 'Phase 3.1 Material Card: { material_card: { title, core_argument, key_arguments, key_examples, expression_angles, recommended_skill, training_reason } }';
