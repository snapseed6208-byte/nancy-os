import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeAI } from "@/lib/ai/aiService";
import { getUserId } from "@/lib/auth";
import { parseEpubFile } from "@/lib/reader/epubParser";
import type {
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
};

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
          metadata: { identifier: parsed.identifier, parser: "client_jszip_v1" },
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
          content: chapter.content,
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
    mutationFn: async (input: { sentence: string; context: string; bookTitle: string }) => {
      const result = await invokeAI<ReaderSentenceAnalysis>("english-reader-agent", input, { timeout: 45_000 });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useSaveReaderExpression() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bookId: string;
      chapterId: string;
      sentence: string;
      expression: ReaderKeyExpression;
      languageExplanation: string;
      speakingExample: string;
      analysis: ReaderSentenceAnalysis;
    }) => {
      const { data, error } = await supabase.rpc("save_reading_expression", {
        p_book_id: input.bookId,
        p_chapter_id: input.chapterId,
        p_sentence_text: input.sentence,
        p_expression_text: input.expression.expression,
        p_chinese: input.expression.chinese,
        p_language_explanation: `${input.expression.explanation}\n${input.languageExplanation}`.trim(),
        p_example_sentence: input.speakingExample,
        p_analysis: input.analysis,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expressions"] });
      queryClient.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}
