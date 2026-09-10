import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeAI } from "@/lib/ai/aiService";
import { getUserId } from "@/lib/auth";
import { parseEpubFile } from "@/lib/reader/epubParser";
import { encodeReaderContent } from "@/lib/reader/content";
import type {
  ReadingArticle,
  ReadingExpressionSaveResult,
  ReadingExpressionSource,
  ReadingSourceKind,
  ReaderBook,
  ReaderChapter,
  ReaderKeyExpression,
  ReaderProgress,
  ReaderSentenceAnalysis,
} from "@/lib/reader/types";
import { supabase } from "@/lib/supabase";

const readerKeys = {
  books: ["reader", "books"] as const,
  book: (bookId: string) => ["reader", "book", bookId] as const,
  articles: ["reader", "articles"] as const,
  article: (resourceId: string) => ["reader", "article", resourceId] as const,
  expressionSource: (expressionId: string) => ["reader", "expression-source", expressionId] as const,
};

const sentenceAnalysisCache = new Map<string, ReaderSentenceAnalysis>();
const sentenceAnalysisFlights = new Map<string, Promise<ReaderSentenceAnalysis>>();

function normalizedExpression(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

async function fetchReaderBooks(): Promise<ReaderBook[]> {
  const userId = await getUserId();
  const [{ data: books, error: booksError }, { data: progress, error: progressError }] = await Promise.all([
    supabase.from("books").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from("reading_progress").select("*").eq("user_id", userId),
  ]);
  if (booksError) throw booksError;
  if (progressError) throw progressError;
  const progressByBook = new Map((progress || []).map((item) => [item.book_id as string, item as ReaderProgress]));
  return (books || []).map((book) => ({
    ...(book as ReaderBook),
    reading_progress: progressByBook.get(book.id as string) || null,
  }));
}

export function useReaderBooks() {
  return useQuery({ queryKey: readerKeys.books, queryFn: fetchReaderBooks });
}

async function fetchReaderBook(bookId: string): Promise<{
  book: ReaderBook;
  chapters: ReaderChapter[];
  progress: ReaderProgress | null;
}> {
  const userId = await getUserId();
  const [bookResult, chaptersResult, progressResult] = await Promise.all([
    supabase.from("books").select("*").eq("id", bookId).eq("user_id", userId).single(),
    supabase.from("chapters").select("*").eq("book_id", bookId).eq("user_id", userId).order("chapter_index"),
    supabase.from("reading_progress").select("*").eq("book_id", bookId).eq("user_id", userId).maybeSingle(),
  ]);
  if (bookResult.error) throw bookResult.error;
  if (chaptersResult.error) throw chaptersResult.error;
  if (progressResult.error) throw progressResult.error;
  return {
    book: bookResult.data as ReaderBook,
    chapters: (chaptersResult.data || []) as ReaderChapter[],
    progress: progressResult.data as ReaderProgress | null,
  };
}

export function useReaderBook(bookId: string) {
  return useQuery({
    queryKey: readerKeys.book(bookId),
    queryFn: () => fetchReaderBook(bookId),
    enabled: Boolean(bookId),
  });
}

export function useImportEpub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const userId = await getUserId();
      const parsed = await parseEpubFile(file);
      const { data: book, error: bookError } = await supabase
        .from("books")
        .insert({
          user_id: userId,
          title: parsed.title,
          author: parsed.author,
          language: parsed.language,
          file_name: file.name,
          file_size: file.size,
          chapter_count: parsed.chapters.length,
          metadata: { identifier: parsed.identifier, parser: "client_jszip_v2" },
        })
        .select()
        .single();
      if (bookError) throw bookError;

      try {
        const chapterRows = parsed.chapters.map((chapter, chapterIndex) => ({
          user_id: userId,
          book_id: book.id,
          chapter_index: chapterIndex,
          title: chapter.title,
          href: chapter.href,
          content: encodeReaderContent(chapter.content, chapter.blocks),
          word_count: chapter.wordCount,
        }));
        for (let index = 0; index < chapterRows.length; index += 20) {
          const { error } = await supabase.from("chapters").insert(chapterRows.slice(index, index + 20));
          if (error) throw error;
        }
        const { error: progressError } = await supabase.from("reading_progress").insert({
          user_id: userId,
          book_id: book.id,
          chapter_index: 0,
          sentence_index: 0,
          percentage: 0,
        });
        if (progressError) throw progressError;
      } catch (error) {
        await supabase.from("books").delete().eq("id", book.id).eq("user_id", userId);
        throw error;
      }
      return book as ReaderBook;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: readerKeys.books }),
  });
}

export function useDeleteReaderBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookId: string) => {
      const userId = await getUserId();
      const { error } = await supabase.from("books").delete().eq("id", bookId).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: readerKeys.books }),
  });
}

export function useSaveReaderProgress(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      chapterId: string;
      chapterIndex: number;
      sentenceIndex: number;
      scrollOffset: number;
      percentage: number;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase.from("reading_progress").upsert({
        user_id: userId,
        book_id: bookId,
        chapter_id: input.chapterId,
        chapter_index: input.chapterIndex,
        sentence_index: input.sentenceIndex,
        scroll_offset: input.scrollOffset,
        percentage: input.percentage,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,book_id" }).select().single();
      if (error) throw error;
      await supabase.from("books").update({ updated_at: new Date().toISOString() }).eq("id", bookId).eq("user_id", userId);
      return data as ReaderProgress;
    },
    onSuccess: (progress) => {
      queryClient.setQueryData(readerKeys.book(bookId), (current: ReturnType<typeof fetchReaderBook> extends Promise<infer T> ? T : never) => (
        current ? { ...current, progress } : current
      ));
      queryClient.invalidateQueries({ queryKey: readerKeys.books });
    },
  });
}

export function useAnalyzeReaderSentence() {
  return useMutation({
    mutationFn: async (input: {
      sentence: string;
      context: string;
      sourceTitle: string;
      sourceKind: ReadingSourceKind;
      cacheKey: string;
      force?: boolean;
    }) => {
      if (!input.force) {
        const cached = sentenceAnalysisCache.get(input.cacheKey);
        if (cached) return cached;
        const flight = sentenceAnalysisFlights.get(input.cacheKey);
        if (flight) return flight;
      }

      const flight = (async () => {
        const result = await invokeAI<ReaderSentenceAnalysis>("english-reader-agent", {
          sentence: input.sentence,
          context: input.context,
          sourceTitle: input.sourceTitle,
          sourceKind: input.sourceKind,
        }, { timeout: 45_000 });
        if (!result.success) throw new Error(result.error);
        if (sentenceAnalysisCache.size >= 200) {
          const oldestKey = sentenceAnalysisCache.keys().next().value;
          if (oldestKey) sentenceAnalysisCache.delete(oldestKey);
        }
        sentenceAnalysisCache.set(input.cacheKey, result.data);
        return result.data;
      })();

      sentenceAnalysisFlights.set(input.cacheKey, flight);
      try {
        return await flight;
      } finally {
        if (sentenceAnalysisFlights.get(input.cacheKey) === flight) sentenceAnalysisFlights.delete(input.cacheKey);
      }
    },
  });
}

export function useSaveReaderExpression() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sourceKind: ReadingSourceKind;
      sourceTitle: string;
      bookId?: string;
      chapterId?: string;
      chapterTitle?: string;
      resourceId?: string;
      sentence: string;
      expression: ReaderKeyExpression;
      languageExplanation: string;
      speakingExample: string;
      analysis: ReaderSentenceAnalysis;
    }) => {
      const sourceExpression = input.expression.source_expression || input.expression.expression;
      if (!normalizedExpression(input.sentence).includes(normalizedExpression(sourceExpression))) {
        throw new Error("AI 推荐表达不在原句中，已阻止保存");
      }
      const { data, error } = await supabase.rpc("save_reading_expression_v2", {
        p_source_kind: input.sourceKind,
        p_source_title: input.sourceTitle,
        p_book_id: input.bookId || null,
        p_chapter_id: input.chapterId || null,
        p_chapter_title: input.chapterTitle || null,
        p_resource_id: input.resourceId || null,
        p_sentence_text: input.sentence,
        p_expression_text: sourceExpression,
        p_chinese: input.expression.chinese,
        p_language_explanation: [input.expression.contextual_meaning, input.expression.usage_note, input.expression.explanation, input.languageExplanation].filter(Boolean).join("\n"),
        p_example_sentence: input.expression.speaking_example || input.speakingExample,
        p_analysis: input.analysis,
      });
      if (error) throw error;
      return data as unknown as ReadingExpressionSaveResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expressions"] });
      queryClient.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

async function fetchReadingArticles(): Promise<ReadingArticle[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("resources")
    .select("id,user_id,title,source_url,source_author,raw_content,parse_status,read_progress,metadata,created_at,updated_at")
    .eq("user_id", userId)
    .eq("module", "english")
    .eq("resource_type", "article")
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as ReadingArticle[];
}

export function useReadingArticles() {
  return useQuery({ queryKey: readerKeys.articles, queryFn: fetchReadingArticles });
}

async function fetchReadingArticle(resourceId: string): Promise<ReadingArticle> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("resources")
    .select("id,user_id,title,source_url,source_author,raw_content,parse_status,read_progress,metadata,created_at,updated_at")
    .eq("id", resourceId)
    .eq("user_id", userId)
    .eq("module", "english")
    .eq("resource_type", "article")
    .single();
  if (error) throw error;
  return data as unknown as ReadingArticle;
}

export function useReadingArticle(resourceId: string) {
  return useQuery({
    queryKey: readerKeys.article(resourceId),
    queryFn: () => fetchReadingArticle(resourceId),
    enabled: Boolean(resourceId),
  });
}

type ReadingArticleExtractResult = {
  resource_id: string;
  title: string;
  extracted_text: string;
  extract_error: string | null;
  source_url: string;
  parse_status: "extracted" | "extract_failed";
};

export function useImportReadingArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; url?: string; text?: string }) => {
      const userId = await getUserId();
      const result = await invokeAI<ReadingArticleExtractResult>("resource-extract", {
        url: input.url || undefined,
        text: input.text || undefined,
        module: "english",
      }, { timeout: 30_000 });
      if (!result.success) throw new Error(result.error);

      const hasContent = Boolean(result.data.extracted_text.trim());
      const title = input.title.trim() || result.data.title.trim() || "未命名文章";
      const { error } = await supabase.from("resources").update({
        title,
        module: "english",
        resource_type: "article",
        content_type: "article",
        raw_content: hasContent ? result.data.extracted_text : null,
        parse_status: hasContent ? "extracted" : "extract_failed",
        metadata: {
          reading_source: "article",
          extraction_error: result.data.extract_error || (hasContent ? null : "正文为空"),
        },
        updated_at: new Date().toISOString(),
      })
        .eq("id", result.data.resource_id)
        .eq("user_id", userId);
      if (error) throw error;
      return { resourceId: result.data.resource_id, hasContent };
    },
    onSuccess: ({ resourceId }) => {
      queryClient.invalidateQueries({ queryKey: readerKeys.articles });
      queryClient.invalidateQueries({ queryKey: readerKeys.article(resourceId) });
    },
  });
}

export function useUpdateReadingArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { resourceId: string; title?: string; content?: string; progress?: number }) => {
      const userId = await getUserId();
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) updates.title = input.title.trim() || "未命名文章";
      if (input.content !== undefined) {
        updates.raw_content = input.content.trim();
        updates.parse_status = input.content.trim() ? "extracted" : "extract_failed";
      }
      if (input.progress !== undefined) updates.read_progress = Math.min(1, Math.max(0, input.progress));
      const { error } = await supabase.from("resources").update(updates)
        .eq("id", input.resourceId)
        .eq("user_id", userId)
        .eq("module", "english")
        .eq("resource_type", "article");
      if (error) throw error;
      return input.resourceId;
    },
    onSuccess: (resourceId) => {
      queryClient.invalidateQueries({ queryKey: readerKeys.articles });
      queryClient.invalidateQueries({ queryKey: readerKeys.article(resourceId) });
    },
  });
}

export function useDeleteReadingArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (resourceId: string) => {
      const userId = await getUserId();
      const { error } = await supabase.from("resources").update({ is_archived: true })
        .eq("id", resourceId)
        .eq("user_id", userId)
        .eq("module", "english")
        .eq("resource_type", "article");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: readerKeys.articles }),
  });
}

export function useReadingExpressionSource(expressionId: string | undefined) {
  return useQuery({
    queryKey: readerKeys.expressionSource(expressionId || ""),
    enabled: Boolean(expressionId),
    queryFn: async (): Promise<ReadingExpressionSource | null> => {
      const { data, error } = await supabase
        .from("saved_reading_expressions")
        .select("id,source_kind,source_title,chapter_title,sentence_text,book_id,chapter_id,resource_id,books(title),chapters(title),resources(title)")
        .eq("expression_id", expressionId!)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as ReadingExpressionSource & {
        books: { title: string } | null;
        chapters: { title: string } | null;
        resources: { title: string } | null;
      };
      return {
        id: row.id,
        source_kind: row.source_kind,
        source_title: row.source_title || row.books?.title || row.resources?.title || null,
        chapter_title: row.chapter_title || row.chapters?.title || null,
        sentence_text: row.sentence_text,
        book_id: row.book_id,
        chapter_id: row.chapter_id,
        resource_id: row.resource_id,
      };
    },
  });
}
