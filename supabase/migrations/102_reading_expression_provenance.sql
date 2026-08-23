-- Reading System: idempotent direct save and EPUB/article provenance.
-- Existing books, expressions, links, and the v1 RPC remain intact.

ALTER TABLE public.saved_reading_expressions
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'epub',
  ADD COLUMN IF NOT EXISTS source_title TEXT,
  ADD COLUMN IF NOT EXISTS chapter_title TEXT,
  ADD COLUMN IF NOT EXISTS resource_id UUID;

ALTER TABLE public.saved_reading_expressions
  DROP CONSTRAINT IF EXISTS saved_reading_expressions_source_kind_check;

ALTER TABLE public.saved_reading_expressions
  ADD CONSTRAINT saved_reading_expressions_source_kind_check
  CHECK (source_kind IN ('epub', 'article'));

ALTER TABLE public.saved_reading_expressions ALTER COLUMN book_id DROP NOT NULL;
ALTER TABLE public.saved_reading_expressions
  DROP CONSTRAINT IF EXISTS saved_reading_expressions_book_id_fkey;
ALTER TABLE public.saved_reading_expressions
  ADD CONSTRAINT saved_reading_expressions_book_id_fkey
  FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

ALTER TABLE public.saved_reading_expressions
  DROP CONSTRAINT IF EXISTS saved_reading_expressions_resource_id_fkey;
ALTER TABLE public.saved_reading_expressions
  ADD CONSTRAINT saved_reading_expressions_resource_id_fkey
  FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE;

ALTER TABLE public.saved_reading_expressions
  ADD CONSTRAINT saved_reading_expressions_source_invariant_check
  CHECK (
    (
      source_kind = 'epub'
      AND book_id IS NOT NULL
      AND resource_id IS NULL
    )
    OR
    (
      source_kind = 'article'
      AND resource_id IS NOT NULL
      AND book_id IS NULL
      AND chapter_id IS NULL
    )
  );

-- Replace the v1 text-based identity with source sentence provenance.
ALTER TABLE public.saved_reading_expressions
  DROP CONSTRAINT IF EXISTS saved_reading_expressions_user_id_book_id_chapter_id_expression_text_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_reading_expressions_epub_sentence_unique
  ON public.saved_reading_expressions (
    user_id,
    expression_id,
    book_id,
    COALESCE(chapter_id, '00000000-0000-0000-0000-000000000000'::uuid),
    LOWER(REGEXP_REPLACE(TRIM(sentence_text), '\s+', ' ', 'g'))
  )
  WHERE source_kind = 'epub';

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_reading_expressions_article_sentence_unique
  ON public.saved_reading_expressions (
    user_id,
    expression_id,
    resource_id,
    LOWER(REGEXP_REPLACE(TRIM(sentence_text), '\s+', ' ', 'g'))
  )
  WHERE source_kind = 'article';

CREATE INDEX IF NOT EXISTS idx_saved_reading_expressions_resource
  ON public.saved_reading_expressions(user_id, resource_id, created_at DESC)
  WHERE resource_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.save_reading_expression_v2(
  p_source_kind TEXT,
  p_source_title TEXT,
  p_book_id UUID,
  p_chapter_id UUID,
  p_chapter_title TEXT,
  p_resource_id UUID,
  p_sentence_text TEXT,
  p_expression_text TEXT,
  p_chinese TEXT,
  p_language_explanation TEXT,
  p_example_sentence TEXT,
  p_analysis JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_expression_id UUID;
  v_link_id UUID;
  v_normalized TEXT;
  v_sentence_normalized TEXT;
  v_source_title TEXT;
  v_chapter_title TEXT;
  v_created BOOLEAN := FALSE;
  v_linked BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_source_kind IS NULL OR p_source_kind NOT IN ('epub', 'article') THEN
    RAISE EXCEPTION 'Unsupported reading source';
  END IF;

  IF NULLIF(TRIM(p_expression_text), '') IS NULL
    OR NULLIF(TRIM(p_sentence_text), '') IS NULL
    OR NULLIF(TRIM(p_chinese), '') IS NULL THEN
    RAISE EXCEPTION 'Expression, meaning, and source sentence are required';
  END IF;

  v_normalized := LOWER(REGEXP_REPLACE(TRIM(p_expression_text), '\s+', ' ', 'g'));
  v_sentence_normalized := LOWER(REGEXP_REPLACE(TRIM(p_sentence_text), '\s+', ' ', 'g'));

  IF p_source_kind = 'epub' THEN
    SELECT title INTO v_source_title
    FROM public.books
    WHERE id = p_book_id AND user_id = v_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Book not found';
    END IF;

    IF p_chapter_id IS NOT NULL THEN
      SELECT title INTO v_chapter_title
      FROM public.chapters
      WHERE id = p_chapter_id AND book_id = p_book_id AND user_id = v_user_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Chapter not found';
      END IF;
    END IF;
  ELSE
    SELECT title INTO v_source_title
    FROM public.resources
    WHERE id = p_resource_id AND user_id = v_user_id
      AND module = 'english' AND resource_type = 'article';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article not found';
    END IF;
  END IF;

  -- Serialize equivalent saves for this user so rapid taps cannot create duplicates.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || v_normalized, 0));

  SELECT id INTO v_expression_id
  FROM public.expressions
  WHERE user_id = v_user_id
    AND LOWER(REGEXP_REPLACE(TRIM(english), '\s+', ' ', 'g')) = v_normalized
    AND COALESCE(archived, FALSE) = FALSE
  ORDER BY created_at
  LIMIT 1;

  IF v_expression_id IS NULL THEN
    INSERT INTO public.expressions (
      user_id, english, chinese, type, example_sentence, scene, status,
      source_text, notes, imported_from, source
    ) VALUES (
      v_user_id,
      TRIM(p_expression_text),
      TRIM(p_chinese),
      'chunk',
      NULLIF(TRIM(p_example_sentence), ''),
      'reading',
      'collected',
      p_sentence_text,
      NULLIF(TRIM(p_language_explanation), ''),
      'english_reader',
      'reader'
    )
    RETURNING id INTO v_expression_id;
    v_created := TRUE;
  END IF;

  SELECT id INTO v_link_id
  FROM public.saved_reading_expressions
  WHERE user_id = v_user_id
    AND expression_id = v_expression_id
    AND source_kind = p_source_kind
    AND LOWER(REGEXP_REPLACE(TRIM(sentence_text), '\s+', ' ', 'g')) = v_sentence_normalized
    AND (
      (p_source_kind = 'epub' AND book_id = p_book_id AND chapter_id IS NOT DISTINCT FROM p_chapter_id)
      OR (p_source_kind = 'article' AND resource_id = p_resource_id)
    )
  LIMIT 1;

  IF v_link_id IS NULL THEN
    INSERT INTO public.saved_reading_expressions (
      user_id, book_id, chapter_id, resource_id, expression_id,
      sentence_text, expression_text, analysis,
      source_kind, source_title, chapter_title
    ) VALUES (
      v_user_id,
      CASE WHEN p_source_kind = 'epub' THEN p_book_id ELSE NULL END,
      CASE WHEN p_source_kind = 'epub' THEN p_chapter_id ELSE NULL END,
      CASE WHEN p_source_kind = 'article' THEN p_resource_id ELSE NULL END,
      v_expression_id,
      p_sentence_text,
      TRIM(p_expression_text),
      COALESCE(p_analysis, '{}'::jsonb),
      p_source_kind,
      COALESCE(NULLIF(TRIM(p_source_title), ''), v_source_title),
      COALESCE(NULLIF(TRIM(p_chapter_title), ''), v_chapter_title)
    )
    RETURNING id INTO v_link_id;
    v_linked := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'expression_id', v_expression_id,
    'association_id', v_link_id,
    'created', v_created,
    'linked', v_linked,
    'expression_created', v_created,
    'association_created', v_linked
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_reading_expression_v2(
  TEXT, TEXT, UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;
