import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, BookmarkPlus, Check, ChevronDown, ChevronLeft, ChevronRight,
  Loader2, Minus, Plus, Sparkles, X,
} from "lucide-react";
import {
  useAnalyzeReaderSentence,
  useReaderBook,
  useSaveReaderExpression,
  useSaveReaderProgress,
} from "@/lib/hooks/useEnglishReader";
import { readerProgressPercentage, splitReaderSentences } from "@/lib/reader/sentences";
import type { ReaderKeyExpression, ReaderSentenceAnalysis } from "@/lib/reader/types";
import type { ReactNode } from "react";

type SentenceItem = { text: string; index: number };

export default function EnglishReader() {
  const [, params] = useRoute("/english/reader/:bookId");
  const bookId = params?.bookId || "";
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useReaderBook(bookId);
  const saveProgress = useSaveReaderProgress(bookId);
  const analyze = useAnalyzeReaderSentence();
  const saveExpression = useSaveReaderExpression();
  const initialized = useRef(false);
  const scrollTimer = useRef<number | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [fontSize, setFontSize] = useState(19);
  const [showChapters, setShowChapters] = useState(false);
  const [selected, setSelected] = useState<SentenceItem | null>(null);
  const [savedExpressions, setSavedExpressions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    setChapterIndex(Math.min(data.progress?.chapter_index || 0, Math.max(0, data.chapters.length - 1)));
    window.setTimeout(() => window.scrollTo({ top: data.progress?.scroll_offset || 0 }), 0);
  }, [data]);

  const chapter = data?.chapters[chapterIndex];
  const paragraphs = useMemo(() => {
    let sentenceIndex = 0;
    return (chapter?.content || "").split(/\n{2,}/).map((paragraph) =>
      splitReaderSentences(paragraph).map((text) => ({ text, index: sentenceIndex++ })),
    ).filter((items) => items.length > 0);
  }, [chapter?.content]);
  const flatSentences = useMemo(() => paragraphs.flat(), [paragraphs]);

  const persistProgress = (sentenceIndex: number, scrollOffset = window.scrollY) => {
    if (!chapter || !data) return;
    saveProgress.mutate({
      chapterId: chapter.id,
      chapterIndex,
      sentenceIndex,
      scrollOffset,
      percentage: readerProgressPercentage(chapterIndex, data.chapters.length),
    });
  };

  useEffect(() => {
    const handleScroll = () => {
      if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
      scrollTimer.current = window.setTimeout(() => {
        persistProgress(selected?.index || 0, window.scrollY);
      }, 900);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    };
  });

  const changeChapter = (nextIndex: number) => {
    if (!data || nextIndex < 0 || nextIndex >= data.chapters.length) return;
    setChapterIndex(nextIndex);
    setSelected(null);
    analyze.reset();
    setShowChapters(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const next = data.chapters[nextIndex];
    saveProgress.mutate({
      chapterId: next.id,
      chapterIndex: nextIndex,
      sentenceIndex: 0,
      scrollOffset: 0,
      percentage: readerProgressPercentage(nextIndex, data.chapters.length),
    });
  };

  const selectSentence = (item: SentenceItem) => {
    if (!data || !chapter) return;
    setSelected(item);
    setSavedExpressions(new Set());
    persistProgress(item.index);
    const start = Math.max(0, item.index - 2);
    const context = flatSentences.slice(start, item.index + 3).map((sentence) => sentence.text).join(" ");
    analyze.mutate({ sentence: item.text, context, bookTitle: data.book.title });
  };

  if (isLoading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 size={24} className="animate-spin text-ink-lighter" /></div>;
  if (error || !data || !chapter) return <p className="text-sm text-red-600">{(error as Error)?.message || "书籍内容不存在"}</p>;

  return (
    <div className="-mt-2 pb-20">
      <header className="sticky top-14 lg:top-0 z-20 bg-warm-cream/95 backdrop-blur border-b border-border -mx-4 px-3 py-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate("/english/reading")} title="返回书架" className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-ink/5">
            <ArrowLeft size={18} />
          </button>
          <button type="button" onClick={() => setShowChapters((value) => !value)} className="min-w-0 flex-1 text-left px-1">
            <span className="block text-xs text-ink-lighter truncate">{data.book.title}</span>
            <span className="flex items-center gap-1 text-sm font-medium truncate">{chapter.title}<ChevronDown size={13} /></span>
          </button>
          <button type="button" onClick={() => setFontSize((value) => Math.max(17, value - 1))} title="减小字号" className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-ink/5"><Minus size={15} /></button>
          <button type="button" onClick={() => setFontSize((value) => Math.min(23, value + 1))} title="增大字号" className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-ink/5"><Plus size={15} /></button>
        </div>
        {showChapters && (
          <div className="absolute left-3 right-3 top-full mt-1 max-h-72 overflow-y-auto bg-card border border-border rounded-lg shadow-lg p-1">
            {data.chapters.map((item) => (
              <button key={item.id} type="button" onClick={() => changeChapter(item.chapter_index)} className={`w-full text-left px-3 py-2.5 rounded-md text-sm ${item.chapter_index === chapterIndex ? "bg-sage-light text-sage-deep font-medium" : "hover:bg-ink/5"}`}>
                <span className="text-[10px] text-ink-lighter mr-2">{item.chapter_index + 1}</span>{item.title}
              </button>
            ))}
          </div>
        )}
      </header>

      <article className="pt-8 max-w-xl mx-auto">
        <p className="text-xs uppercase text-ink-lighter">Chapter {chapterIndex + 1} of {data.chapters.length}</p>
        <h1 className="text-xl font-semibold mt-2 mb-8">{chapter.title}</h1>
        <div className="font-serif text-ink" style={{ fontSize, lineHeight: 1.95 }}>
          {paragraphs.map((items, paragraphIndex) => (
            <p key={paragraphIndex} className="mb-6">
              {items.map((item) => (
                <button
                  key={item.index}
                  type="button"
                  onClick={() => selectSentence(item)}
                  className={`inline text-left rounded-sm px-0.5 -mx-0.5 transition-colors ${selected?.index === item.index ? "bg-sage-light" : "hover:bg-sage-light/60"}`}
                >
                  {item.text}{" "}
                </button>
              ))}
            </p>
          ))}
        </div>
      </article>

      <footer className="border-t border-border mt-10 pt-5 flex items-center justify-between">
        <button type="button" disabled={chapterIndex === 0} onClick={() => changeChapter(chapterIndex - 1)} className="h-10 px-3 rounded-lg border border-border inline-flex items-center gap-2 text-sm disabled:opacity-30"><ChevronLeft size={16} />上一章</button>
        <span className="text-xs text-ink-lighter">{readerProgressPercentage(chapterIndex, data.chapters.length)}%</span>
        <button type="button" disabled={chapterIndex === data.chapters.length - 1} onClick={() => changeChapter(chapterIndex + 1)} className="h-10 px-3 rounded-lg bg-ink text-white inline-flex items-center gap-2 text-sm disabled:opacity-30">下一章<ChevronRight size={16} /></button>
      </footer>

      {selected && (
        <AnalysisPanel
          sentence={selected.text}
          analysis={analyze.data}
          loading={analyze.isPending}
          error={analyze.error as Error | null}
          saved={savedExpressions}
          saving={saveExpression.isPending}
          onClose={() => { setSelected(null); analyze.reset(); }}
          onSave={(expression) => {
            if (!analyze.data) return;
            saveExpression.mutate({
              bookId,
              chapterId: chapter.id,
              sentence: selected.text,
              expression,
              languageExplanation: analyze.data.language_explanation,
              speakingExample: analyze.data.speaking_examples[0] || "",
              analysis: analyze.data,
            }, {
              onSuccess: () => setSavedExpressions((current) => new Set(current).add(expression.expression)),
            });
          }}
        />
      )}
    </div>
  );
}

function AnalysisPanel({ sentence, analysis, loading, error, saved, saving, onClose, onSave }: {
  sentence: string;
  analysis: ReaderSentenceAnalysis | undefined;
  loading: boolean;
  error: Error | null;
  saved: Set<string>;
  saving: boolean;
  onClose: () => void;
  onSave: (expression: ReaderKeyExpression) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 lg:left-auto lg:right-6 lg:w-[390px] bg-card border-t lg:border border-border lg:rounded-lg shadow-2xl max-h-[72vh] overflow-y-auto safe-bottom">
      <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center gap-2">
        <Sparkles size={16} className="text-sage-deep" />
        <span className="text-sm font-semibold">句子理解</span>
        <button type="button" onClick={onClose} title="关闭" className="ml-auto h-8 w-8 rounded-md flex items-center justify-center hover:bg-ink/5"><X size={16} /></button>
      </div>
      <div className="p-4 space-y-5">
        <blockquote className="text-sm font-serif leading-7 border-l-2 border-sage pl-3">{sentence}</blockquote>
        {loading && <div className="py-8 flex items-center justify-center gap-2 text-sm text-ink-lighter"><Loader2 size={17} className="animate-spin" />正在分析</div>}
        {error && <p className="text-sm text-red-600">{error.message}</p>}
        {analysis && (
          <>
            <AnalysisSection title="中文理解"><p>{analysis.chinese_understanding}</p></AnalysisSection>
            <AnalysisSection title="重点表达">
              {analysis.key_expressions.length === 0 ? <p className="text-ink-lighter">这句话没有需要单独收藏的表达。</p> : analysis.key_expressions.map((item) => (
                <div key={item.expression} className="border-b border-border last:border-0 py-3 first:pt-0 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink">{item.expression}</p>
                    <p className="text-xs text-sage-deep mt-0.5">{item.chinese}</p>
                    <p className="text-xs text-ink-light mt-1.5 leading-5">{item.explanation}</p>
                  </div>
                  <button type="button" disabled={saving || saved.has(item.expression)} onClick={() => onSave(item)} title="收藏到表达库" className="h-9 w-9 shrink-0 rounded-md border border-border flex items-center justify-center disabled:bg-sage-light disabled:text-sage-deep">
                    {saved.has(item.expression) ? <Check size={16} /> : <BookmarkPlus size={16} />}
                  </button>
                </div>
              ))}
            </AnalysisSection>
            <AnalysisSection title="语言解释"><p>{analysis.language_explanation}</p></AnalysisSection>
            <AnalysisSection title="口语迁移">
              <div className="space-y-2">{analysis.speaking_examples.map((example) => <p key={example} className="bg-warm-cream rounded-md px-3 py-2">{example}</p>)}</div>
            </AnalysisSection>
          </>
        )}
      </div>
    </div>
  );
}

function AnalysisSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="text-sm leading-6"><h2 className="text-xs font-semibold text-ink-lighter mb-2">{title}</h2>{children}</section>;
}
