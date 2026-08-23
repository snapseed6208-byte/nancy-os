import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, ExternalLink, Loader2, Minus, Plus } from "lucide-react";
import ReadingExperience from "@/components/english/reading/ReadingExperience";
import { useReadingArticle, useSaveReaderExpression, useUpdateReadingArticle } from "@/lib/hooks/useEnglishReader";

export default function EnglishArticleReader() {
  const [, params] = useRoute("/english/reading/article/:resourceId");
  const resourceId = params?.resourceId || "";
  const [, navigate] = useLocation();
  const { data: article, isLoading, error } = useReadingArticle(resourceId);
  const updateArticle = useUpdateReadingArticle();
  const saveExpression = useSaveReaderExpression();
  const [fontSize, setFontSize] = useState(19);
  const [fallbackContent, setFallbackContent] = useState("");

  if (isLoading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 size={24} className="animate-spin text-ink-lighter" /></div>;
  if (error || !article) return <p className="text-sm text-red-600">{(error as Error)?.message || "文章不存在"}</p>;

  return (
    <div className="-mt-2 pb-20">
      <header className="sticky top-14 lg:top-0 z-20 bg-warm-cream/95 backdrop-blur border-b border-border -mx-4 px-3 py-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate("/english/reading/articles")} title="返回原文精读" className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-ink/5"><ArrowLeft size={18} /></button>
          <div className="min-w-0 flex-1 px-1"><span className="block text-xs text-ink-lighter">原文精读</span><span className="block text-sm font-medium truncate">{article.title}</span></div>
          {article.source_url && <a href={article.source_url} target="_blank" rel="noreferrer" title="打开原网页" className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-ink/5"><ExternalLink size={15} /></a>}
          <button type="button" onClick={() => setFontSize((value) => Math.max(17, value - 1))} title="减小字号" className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-ink/5"><Minus size={15} /></button>
          <button type="button" onClick={() => setFontSize((value) => Math.min(23, value + 1))} title="增大字号" className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-ink/5"><Plus size={15} /></button>
        </div>
      </header>

      <article className="pt-8 max-w-xl mx-auto">
        <p className="text-xs text-ink-lighter">{article.source_author || (article.source_url ? "网页原文" : "手动正文")}</p>
        <h1 className="text-xl font-semibold mt-2 mb-8 leading-8">{article.title}</h1>
        {!article.raw_content ? (
          <section className="border-y border-border py-5">
            <p className="text-sm font-medium">无法自动提取正文</p>
            <p className="text-xs text-ink-lighter mt-1">请粘贴文章内容后继续阅读。</p>
            <textarea value={fallbackContent} onChange={(event) => setFallbackContent(event.target.value)} rows={10} placeholder="粘贴完整英文正文" className="w-full mt-4 px-3 py-2.5 rounded-lg border border-border bg-card text-sm leading-6 outline-none resize-y" />
            <button type="button" disabled={!fallbackContent.trim() || updateArticle.isPending} onClick={() => updateArticle.mutate({ resourceId, content: fallbackContent })} className="mt-3 h-10 px-4 rounded-lg bg-ink text-white text-sm font-medium disabled:opacity-50">保存正文</button>
          </section>
        ) : (
          <ReadingExperience
            content={article.raw_content}
            fontSize={fontSize}
            sourceKey={`article:${resourceId}`}
            sourceKind="article"
            sourceTitle={article.title}
            onSentenceActivate={(item, sentenceCount) => updateArticle.mutate({ resourceId, progress: (item.index + 1) / Math.max(1, sentenceCount) })}
            onSaveExpression={(expression, analysis, sentence) => saveExpression.mutateAsync({
              sourceKind: "article",
              sourceTitle: article.title,
              resourceId,
              sentence,
              expression,
              languageExplanation: analysis.language_explanation,
              speakingExample: analysis.speaking_examples[0] || "",
              analysis,
            })}
          />
        )}
      </article>
    </div>
  );
}
