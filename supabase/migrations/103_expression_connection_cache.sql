-- Expression Connections MVP: durable per-expression AI cache.

CREATE TABLE IF NOT EXISTS public.expression_connection_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_expression_id UUID NOT NULL REFERENCES public.expressions(id) ON DELETE CASCADE,
  source_updated_at TIMESTAMPTZ NOT NULL,
  candidate_fingerprint TEXT NOT NULL,
  connections JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  prompt_version TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, source_expression_id),
  CONSTRAINT expression_connection_cache_connections_array
    CHECK (jsonb_typeof(connections) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_expression_connection_cache_source
  ON public.expression_connection_cache(user_id, source_expression_id);

ALTER TABLE public.expression_connection_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expression connection cache"
  ON public.expression_connection_cache
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.expression_connection_cache IS
  'Derived AI cache for Expression Connections. Learned/library state is resolved dynamically and is never stored here.';

