-- English Reader MVP: EPUB books, chapters, progress, and expression sync.

CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  chapter_count INTEGER NOT NULL DEFAULT 0 CHECK (chapter_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL CHECK (chapter_index >= 0),
  title TEXT NOT NULL,
  href TEXT,
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0 CHECK (word_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(book_id, chapter_index)
);

CREATE TABLE IF NOT EXISTS public.reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  chapter_index INTEGER NOT NULL DEFAULT 0 CHECK (chapter_index >= 0),
  sentence_index INTEGER NOT NULL DEFAULT 0 CHECK (sentence_index >= 0),
  scroll_offset REAL NOT NULL DEFAULT 0 CHECK (scroll_offset >= 0),
  percentage REAL NOT NULL DEFAULT 0 CHECK (percentage BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

CREATE TABLE IF NOT EXISTS public.saved_reading_expressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  expression_id UUID NOT NULL REFERENCES public.expressions(id) ON DELETE CASCADE,
  sentence_text TEXT NOT NULL,
  expression_text TEXT NOT NULL,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id, chapter_id, expression_text)
);

CREATE INDEX IF NOT EXISTS idx_books_user_updated ON public.books(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chapters_book_order ON public.chapters(book_id, chapter_index);
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_updated ON public.reading_progress(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_reading_expressions_user ON public.saved_reading_expressions(user_id, created_at DESC);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reading_expressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own books" ON public.books
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own chapters" ON public.chapters
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own reading progress" ON public.reading_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own saved reading expressions" ON public.saved_reading_expressions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.save_reading_expression(
  p_book_id UUID,
  p_chapter_id UUID,
  p_sentence_text TEXT,
  p_expression_text TEXT,
  p_chinese TEXT,
  p_language_explanation TEXT,
  p_example_sentence TEXT,
  p_analysis JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_expression_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.books WHERE id = p_book_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Book not found';
  END IF;

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

  INSERT INTO public.saved_reading_expressions (
    user_id, book_id, chapter_id, expression_id,
    sentence_text, expression_text, analysis
  ) VALUES (
    v_user_id, p_book_id, p_chapter_id, v_expression_id,
    p_sentence_text, TRIM(p_expression_text), COALESCE(p_analysis, '{}'::jsonb)
  );

  RETURN v_expression_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_reading_expression(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;
