export type ReaderBook = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  language: string;
  file_name: string;
  file_size: number;
  chapter_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  reading_progress?: ReaderProgress | null;
};

export type ReaderChapter = {
  id: string;
  book_id: string;
  user_id: string;
  chapter_index: number;
  title: string;
  href: string | null;
  content: string;
  word_count: number;
  created_at: string;
};

export type ReaderProgress = {
  id: string;
  user_id: string;
  book_id: string;
  chapter_id: string | null;
  chapter_index: number;
  sentence_index: number;
  scroll_offset: number;
  percentage: number;
  updated_at: string;
};

export type ParsedEpubChapter = {
  title: string;
  href: string;
  content: string;
  wordCount: number;
};

export type ParsedEpub = {
  title: string;
  author: string | null;
  language: string;
  identifier: string | null;
  chapters: ParsedEpubChapter[];
};

export type ReaderKeyExpression = {
  expression: string;
  chinese: string;
  explanation: string;
};

export type ReaderSentenceAnalysis = {
  chinese_understanding: string;
  key_expressions: ReaderKeyExpression[];
  language_explanation: string;
  speaking_examples: string[];
};
