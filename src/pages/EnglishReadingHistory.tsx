import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, ChevronRight, FileText } from "lucide-react";
import { useReaderBooks, useReadingArticles } from "@/lib/hooks/useEnglishReader";

function relativeDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "今天";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "昨天";
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export default function EnglishReadingHistory() {
  const [, navigate] = useLocation();
  const { data: books = [] } = useReaderBooks();
  const { data: articles = [] } = useReadingArticles();
  const items = [
    ...books.filter((book) => (book.reading_progress?.percentage || 0) > 0).map((book) => ({
      id: book.id, kind: "book" as const, title: book.title,
      detail: `Chapter ${(book.reading_progress?.chapter_index || 0) + 1} · ${Math.round(book.reading_progress?.percentage || 0)}%`,
      updatedAt: book.reading_progress!.updated_at,
    })),
    ...articles.filter((article) => article.raw_content && (article.read_progress || 0) > 0).map((article) => ({
      id: article.id, kind: "article" as const, title: article.title,
      detail: article.read_progress ? `${Math.round(article.read_progress * 100)}%` : "已保存",
      updatedAt: article.updated_at,
    })),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => navigate("/english/reading")} title="返回英文阅读" className="h-9 w-9 rounded-lg bg-ink/5 flex items-center justify-center"><ArrowLeft size={17} /></button>
        <div><p className="text-xs text-ink-lighter">英文阅读</p><h1 className="text-2xl font-semibold mt-0.5">最近阅读</h1></div>
      </header>
      {items.length === 0 ? <p className="py-16 text-center text-sm text-ink-lighter">还没有阅读记录</p> : (
        <div className="border-t border-border">
          {items.map((item) => (
            <button key={`${item.kind}:${item.id}`} type="button" onClick={() => navigate(item.kind === "book" ? `/english/reading/book/${item.id}` : `/english/reading/article/${item.id}`)} className="w-full min-h-18 border-b border-border flex items-center gap-3 text-left py-3">
              <span className="h-9 w-9 rounded-lg bg-ink/5 flex items-center justify-center">{item.kind === "book" ? <BookOpen size={17} /> : <FileText size={17} />}</span>
              <span className="flex-1 min-w-0"><span className="block text-sm font-medium truncate">{item.title}</span><span className="block text-xs text-ink-lighter mt-1">{relativeDate(item.updatedAt)} · {item.detail}</span></span>
              <ChevronRight size={15} className="text-ink-lighter" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
