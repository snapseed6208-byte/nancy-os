import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, ChevronRight, Clock3, FileText, Library, Play } from "lucide-react";
import { useReaderBooks, useReadingArticles } from "@/lib/hooks/useEnglishReader";

export default function EnglishReadingHub() {
  const [, navigate] = useLocation();
  const booksQuery = useReaderBooks();
  const articlesQuery = useReadingArticles();
  const books = booksQuery.data ?? [];
  const articles = articlesQuery.data ?? [];
  const activeSources = books.filter((book) => (book.reading_progress?.percentage || 0) > 0 && (book.reading_progress?.percentage || 0) < 100).length
    + articles.filter((article) => (article.read_progress || 0) > 0 && (article.read_progress || 0) < 1).length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentCount = books.filter((book) => (book.reading_progress?.percentage || 0) > 0 && new Date(book.reading_progress?.updated_at || 0).getTime() >= weekAgo).length
    + articles.filter((article) => new Date(article.updated_at).getTime() >= weekAgo && (article.read_progress || 0) > 0).length;
  const latestBook = [...books].filter((book) => (book.reading_progress?.percentage || 0) > 0).sort((a, b) => new Date(b.reading_progress!.updated_at).getTime() - new Date(a.reading_progress!.updated_at).getTime())[0];
  const latestArticle = [...articles].filter((article) => article.raw_content && (article.read_progress || 0) > 0).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  const continueArticle = latestArticle && (!latestBook || new Date(latestArticle.updated_at) > new Date(latestBook.reading_progress!.updated_at));
  const hasContinue = Boolean(latestBook || latestArticle);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <button type="button" onClick={() => navigate("/english")} title="返回 English OS" className="h-9 w-9 shrink-0 rounded-lg bg-ink/5 flex items-center justify-center hover:bg-ink/10"><ArrowLeft size={17} /></button>
        <div>
          <p className="text-xs text-ink-lighter">English OS</p>
          <h1 className="text-2xl font-semibold mt-0.5">英文阅读</h1>
          <p className="text-sm text-ink-light mt-1">真实语料输入 · AI 辅助理解 · 表达积累</p>
        </div>
      </header>

      <section className="border-y border-border py-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="书籍" value={books.length} />
        <Stat label="正在读" value={activeSources} />
        <Stat label="近 7 日阅读" value={recentCount} />
      </section>

      <button
        type="button"
        onClick={() => {
          if (continueArticle && latestArticle) navigate(`/english/reading/article/${latestArticle.id}`);
          else if (latestBook) navigate(`/english/reading/book/${latestBook.id}`);
          else navigate("/english/reading/library");
        }}
        className="w-full h-12 px-4 rounded-lg bg-ink text-white flex items-center justify-center gap-2 text-sm font-semibold"
      >
        <Play size={16} />{hasContinue ? "继续阅读" : "导入一本书开始阅读"}
      </button>

      <section className="border-t border-border">
        <HubRow icon={Library} title="我的书架" description={`${books.length} 本 EPUB 原著`} onClick={() => navigate("/english/reading/library")} />
        <HubRow icon={FileText} title="原文精读" description={`${articles.length} 篇文章 · 支持正文或 URL`} onClick={() => navigate("/english/reading/articles")} />
        <HubRow icon={Clock3} title="阅读记录" description="最近打开的书籍与文章" onClick={() => navigate("/english/reading/history")} />
      </section>

      {(booksQuery.error || articlesQuery.error) && <p className="text-sm text-red-600">阅读数据加载失败，请稍后重试。</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div><p className="text-xl font-semibold">{value}</p><p className="text-[11px] text-ink-lighter mt-1">{label}</p></div>;
}

function HubRow({ icon: Icon, title, description, onClick }: { icon: typeof BookOpen; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full min-h-20 border-b border-border flex items-center gap-3 text-left py-3 hover:bg-ink/[0.025]">
      <span className="h-10 w-10 shrink-0 rounded-lg bg-sage-light text-sage-deep flex items-center justify-center"><Icon size={19} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-ink-lighter mt-1 truncate">{description}</span></span>
      <ChevronRight size={16} className="text-ink-lighter" />
    </button>
  );
}
