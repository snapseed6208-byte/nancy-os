import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, FileText, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { useDeleteReadingArticle, useImportReadingArticle, useReadingArticles } from "@/lib/hooks/useEnglishReader";

export default function EnglishArticleLibrary() {
  const [, navigate] = useLocation();
  const { data: articles = [], isLoading, error } = useReadingArticles();
  const importArticle = useImportReadingArticle();
  const deleteArticle = useDeleteReadingArticle();
  const [showImport, setShowImport] = useState(false);
  const [mode, setMode] = useState<"text" | "url">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [formError, setFormError] = useState("");

  const submit = async () => {
    const input = content.trim();
    if (!input) return;
    if (mode === "url" && !/^https?:\/\//i.test(input)) {
      setFormError("请输入完整的 http 或 https 链接");
      return;
    }
    setFormError("");
    try {
      const result = await importArticle.mutateAsync({
        title,
        url: mode === "url" ? input : undefined,
        text: mode === "text" ? input : undefined,
      });
      navigate(`/english/reading/article/${result.resourceId}`);
    } catch (failure) {
      setFormError((failure as Error).message || "文章导入失败");
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => navigate("/english/reading")} title="返回英文阅读" className="h-9 w-9 shrink-0 rounded-lg bg-ink/5 flex items-center justify-center"><ArrowLeft size={17} /></button>
          <div><p className="text-xs text-ink-lighter">英文阅读</p><h1 className="text-2xl font-semibold mt-0.5">原文精读</h1><p className="text-sm text-ink-light mt-1">粘贴正文或导入网页</p></div>
        </div>
        <button type="button" onClick={() => setShowImport((value) => !value)} title="添加文章" className="h-10 w-10 shrink-0 rounded-lg bg-ink text-white flex items-center justify-center"><Plus size={18} /></button>
      </header>

      {showImport && (
        <section className="border-y border-border py-4 space-y-3">
          <div className="inline-flex rounded-lg bg-ink/5 p-1">
            <button type="button" onClick={() => { setMode("text"); setContent(""); }} className={`h-8 px-3 rounded-md text-xs ${mode === "text" ? "bg-card shadow-sm font-medium" : "text-ink-lighter"}`}>粘贴正文</button>
            <button type="button" onClick={() => { setMode("url"); setContent(""); }} className={`h-8 px-3 rounded-md text-xs ${mode === "url" ? "bg-card shadow-sm font-medium" : "text-ink-lighter"}`}>粘贴 URL</button>
          </div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="文章标题（可选）" className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm outline-none focus:border-sage" />
          <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={mode === "text" ? 9 : 2} placeholder={mode === "text" ? "粘贴完整英文正文" : "https://example.com/article"} className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm leading-6 outline-none focus:border-sage resize-y" />
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <button type="button" onClick={() => void submit()} disabled={importArticle.isPending || !content.trim()} className="h-10 px-4 rounded-lg bg-sage-light text-sage-deep text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            {importArticle.isPending ? <Loader2 size={15} className="animate-spin" /> : mode === "url" ? <Link2 size={15} /> : <FileText size={15} />}
            {mode === "url" ? "提取正文" : "开始阅读"}
          </button>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
      {!isLoading && articles.length === 0 ? <p className="py-16 text-center text-sm text-ink-lighter">还没有精读文章</p> : (
        <div className="border-t border-border">
          {articles.map((article) => (
            <div key={article.id} className="border-b border-border flex items-center gap-2 py-3">
              <button type="button" onClick={() => navigate(`/english/reading/article/${article.id}`)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                <span className="h-10 w-10 shrink-0 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center"><FileText size={18} /></span>
                <span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{article.title}</span><span className="block text-xs text-ink-lighter mt-1 truncate">{article.raw_content ? `${Math.round((article.read_progress || 0) * 100)}% · ${article.source_url || "手动正文"}` : "等待粘贴正文"}</span></span>
                <ChevronRight size={15} className="text-ink-lighter" />
              </button>
              <button type="button" onClick={() => { if (window.confirm(`移除《${article.title}》？`)) deleteArticle.mutate(article.id); }} title="移除文章" className="h-8 w-8 shrink-0 flex items-center justify-center text-ink-lighter hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
