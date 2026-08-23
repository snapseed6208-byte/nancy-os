import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Loader2, Minus, Plus } from "lucide-react";
import ReadingExperience, { type ReadingSentenceItem } from "@/components/english/reading/ReadingExperience";
import { useReaderBook, useSaveReaderExpression, useSaveReaderProgress } from "@/lib/hooks/useEnglishReader";
import { readerProgressPercentage } from "@/lib/reader/sentences";

export default function EnglishReader() {
  const [, canonicalParams] = useRoute("/english/reading/book/:bookId");
  const [, legacyParams] = useRoute("/english/reader/:bookId");
  const bookId = canonicalParams?.bookId || legacyParams?.bookId || "";
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useReaderBook(bookId);
  const saveProgress = useSaveReaderProgress(bookId);
  const saveExpression = useSaveReaderExpression();
  const initialized = useRef(false);
  const scrollTimer = useRef<number | null>(null);
  const latestSentenceIndex = useRef(0);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [fontSize, setFontSize] = useState(19);
  const [showChapters, setShowChapters] = useState(false);

  useEffect(() => {
    initialized.current = false;
    latestSentenceIndex.current = 0;
    setChapterIndex(0);
  }, [bookId]);

  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    const restoredChapter = Math.min(data.progress?.chapter_index || 0, Math.max(0, data.chapters.length - 1));
    latestSentenceIndex.current = data.progress?.sentence_index || 0;
    setChapterIndex(restoredChapter);
    window.setTimeout(() => window.scrollTo({ top: data.progress?.scroll_offset || 0 }), 0);
  }, [data]);

  const chapter = data?.chapters[chapterIndex];

  const persistProgress = (sentenceIndex: number, scrollOffset = window.scrollY) => {
    if (!chapter || !data) return;
    latestSentenceIndex.current = sentenceIndex;
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
      scrollTimer.current = window.setTimeout(() => persistProgress(latestSentenceIndex.current, window.scrollY), 900);
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
    setShowChapters(false);
    latestSentenceIndex.current = 0;
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

  if (isLoading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 size={24} className="animate-spin text-ink-lighter" /></div>;
  if (error || !data || !chapter) return <p className="text-sm text-red-600">{(error as Error)?.message || "书籍内容不存在"}</p>;

  return (
    <div className="-mt-2 pb-20">
      <header className="sticky top-14 lg:top-0 z-20 bg-warm-cream/95 backdrop-blur border-b border-border -mx-4 px-3 py-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate("/english/reading/library")} title="返回书架" className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-ink/5"><ArrowLeft size={18} /></button>
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
        <ReadingExperience
          content={chapter.content}
          fontSize={fontSize}
          sourceKey={`epub:${bookId}:${chapter.id}`}
          sourceKind="epub"
          sourceTitle={data.book.title}
          onSentenceActivate={(item: ReadingSentenceItem) => persistProgress(item.index)}
          onSaveExpression={(expression, analysis, sentence) => saveExpression.mutateAsync({
            sourceKind: "epub",
            sourceTitle: data.book.title,
            bookId,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            sentence,
            expression,
            languageExplanation: analysis.language_explanation,
            speakingExample: analysis.speaking_examples[0] || "",
            analysis,
          })}
        />
      </article>

      <footer className="border-t border-border mt-10 pt-5 flex items-center justify-between">
        <button type="button" disabled={chapterIndex === 0} onClick={() => changeChapter(chapterIndex - 1)} className="h-10 px-3 rounded-lg border border-border inline-flex items-center gap-2 text-sm disabled:opacity-30"><ChevronLeft size={16} />上一章</button>
        <span className="text-xs text-ink-lighter">{readerProgressPercentage(chapterIndex, data.chapters.length)}%</span>
        <button type="button" disabled={chapterIndex === data.chapters.length - 1} onClick={() => changeChapter(chapterIndex + 1)} className="h-10 px-3 rounded-lg bg-ink text-white inline-flex items-center gap-2 text-sm disabled:opacity-30">下一章<ChevronRight size={16} /></button>
      </footer>
    </div>
  );
}
