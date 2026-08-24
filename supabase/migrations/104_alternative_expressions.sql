-- Replace the retired runtime connection cache with import-time alternatives.

ALTER TABLE public.expressions
  ADD COLUMN IF NOT EXISTS alternative_expressions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.expressions
  ADD CONSTRAINT expressions_alternative_expressions_array
  CHECK (jsonb_typeof(alternative_expressions) = 'array');

COMMENT ON COLUMN public.expressions.alternative_expressions IS
  'Import-time alternative expressions: [{"expression":"...","difference":"..."}].';

DROP TABLE IF EXISTS public.expression_connection_cache;
