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
  blocks?: import("./content").ReaderBlock[];
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
  source_expression?: string;
  alternative_expression?: string | null;
  chinese: string;
  explanation: string;
  contextual_meaning?: string;
  usage_note?: string;
  register?: "spoken" | "neutral" | "written";
  speaking_example?: string | null;
};

export type ReaderSentenceAnalysis = {
  chinese_understanding: string;
  key_expressions: ReaderKeyExpression[];
  language_explanation: string;
  speaking_examples: string[];
};

export type ReadingSourceKind = "epub" | "article";

export type ReadingArticle = {
  id: string;
  user_id: string;
  title: string;
  source_url: string | null;
  source_author: string | null;
  raw_content: string | null;
  parse_status: string | null;
  read_progress: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ReadingExpressionSaveResult = {
  expression_id: string;
  created: boolean;
  linked: boolean;
};

export type ReadingExpressionSource = {
  id: string;
  source_kind: ReadingSourceKind;
  source_title: string | null;
  chapter_title: string | null;
  sentence_text: string;
  book_id: string | null;
  chapter_id: string | null;
  resource_id: string | null;
};
