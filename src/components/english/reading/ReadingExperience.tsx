import { useEffect, useMemo, useRef, useState } from "react";
import { BookmarkPlus, Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { useAnalyzeReaderSentence } from "@/lib/hooks/useEnglishReader";
import { splitReaderSentences } from "@/lib/reader/sentences";
import type {
  ReaderKeyExpression,
  ReaderSentenceAnalysis,
  ReadingExpressionSaveResult,
  ReadingSourceKind,
} from "@/lib/reader/types";

export type ReadingSentenceItem = { text: string; index: number };

type SaveState = "saving" | "created" | "existing" | "error";

type ReadingExperienceProps = {
  content: string;
  fontSize: number;
  sourceKey: string;
  sourceKind: ReadingSourceKind;
  sourceTitle: string;
  onSentenceActivate?: (item: ReadingSentenceItem, sentenceCount: number) => void;
  onSaveExpression: (
    expression: ReaderKeyExpression,
    analysis: ReaderSentenceAnalysis,
    sentence: string,
  ) => Promise<ReadingExpressionSaveResult>;
};

function textHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function expressionText(expression: ReaderKeyExpression): string {
  return expression.source_expression || expression.expression;
}

export default function ReadingExperience({
  content,
  fontSize,
  sourceKey,
  sourceKind,
  sourceTitle,
  onSentenceActivate,
  onSaveExpression,
}: ReadingExperienceProps) {
  const analyze = useAnalyzeReaderSentence();
  const activeKey = useRef("");
  const [selected, setSelected] = useState<ReadingSentenceItem | null>(null);
  const [analysis, setAnalysis] = useState<ReaderSentenceAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  const paragraphs = useMemo(() => {
    let sentenceIndex = 0;
    return content.split(/\n{2,}/)
      .map((paragraph) => splitReaderSentences(paragraph).map((text) => ({ text, index: sentenceIndex++ })))
      .filter((items) => items.length > 0);
  }, [content]);
  const sentences = useMemo(() => paragraphs.flat(), [paragraphs]);

  useEffect(() => {
    activeKey.current = "";
    setSelected(null);
    setAnalysis(null);
    setAnalysisError("");
    setAnalysisLoading(false);
    setSaveStates({});
  }, [sourceKey]);

  const runAnalysis = async (item: ReadingSentenceItem, force = false) => {
    const cacheKey = `${sourceKey}:${item.index}:${textHash(item.text)}`;
    if (!force && cacheKey === activeKey.current && (analysisLoading || analysis)) return;

    activeKey.current = cacheKey;
    setSelected(item);
    setAnalysis(null);
    setAnalysisError("");
    setAnalysisLoading(true);
    setSaveStates({});
    onSentenceActivate?.(item, sentences.length);

    const start = Math.max(0, item.index - 2);
    const context = sentences.slice(start, item.index + 3).map((sentence) => sentence.text).join(" ");
    window.setTimeout(() => {
      const sentenceElement = document.getElementById(`reading-sentence-${item.index}`);
      if (typeof sentenceElement?.scrollIntoView === "function") {
        sentenceElement.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }, 0);

    try {
      const result = await analyze.mutateAsync({
        sentence: item.text,
        context,
        sourceTitle,
        sourceKind,
        cacheKey,
        force,
      });
      if (activeKey.current === cacheKey) setAnalysis(result);
    } catch (error) {
      if (activeKey.current === cacheKey) setAnalysisError((error as Error).message || "AI 解析失败");
    } finally {
      if (activeKey.current === cacheKey) setAnalysisLoading(false);
    }
  };

  const closePanel = () => {
    activeKey.current = "";
    setSelected(null);
    setAnalysis(null);
    setAnalysisError("");
    setAnalysisLoading(false);
  };

  const save = async (expression: ReaderKeyExpression) => {
    if (!selected || !analysis) return;
    const key = expressionText(expression);
    setSaveStates((current) => ({ ...current, [key]: "saving" }));
    try {
      const result = await onSaveExpression(expression, analysis, selected.text);
      setSaveStates((current) => ({ ...current, [key]: result.created ? "created" : "existing" }));
    } catch {
      setSaveStates((current) => ({ ...current, [key]: "error" }));
    }
  };

  return (
    <>
      <div className="w-full max-w-full min-w-0 font-serif text-ink [overflow-wrap:anywhere]" style={{ fontSize, lineHeight: 1.95 }}>
        {paragraphs.map((items, paragraphIndex) => (
          <p key={paragraphIndex} className="mb-6 w-full max-w-full min-w-0 whitespace-normal [overflow-wrap:anywhere]">
            {items.map((item) => (
              <button
                id={`reading-sentence-${item.index}`}
                key={item.index}
                type="button"
                onClick={() => void runAnalysis(item)}
                className={`inline max-w-full whitespace-normal [overflow-wrap:anywhere] py-0.5 px-0.5 -mx-0.5 text-left rounded-sm transition-colors scroll-mb-[55vh] ${selected?.index === item.index ? "bg-sage-light text-ink" : "hover:bg-sage-light/60 active:bg-sage-light"}`}
              >
                {item.text}{" "}
              </button>
            ))}
          </p>
        ))}
      </div>

      {selected && (
        <ReadingAIPanel
          sentence={selected.text}
          analysis={analysis}
          loading={analysisLoading}
          error={analysisError}
          saveStates={saveStates}
          onClose={closePanel}
          onRetry={() => void runAnalysis(selected, true)}
          onSave={(expression) => void save(expression)}
        />
      )}
    </>
  );
}

export function ReadingAIPanel({ sentence, analysis, loading, error, saveStates, onClose, onRetry, onSave }: {
  sentence: string;
  analysis: ReaderSentenceAnalysis | null;
  loading: boolean;
  error: string;
  saveStates: Record<string, SaveState>;
  onClose: () => void;
  onRetry: () => void;
  onSave: (expression: ReaderKeyExpression) => void;
}) {
  return (
    <aside className="fixed inset-x-0 bottom-0 z-50 w-auto max-w-full min-w-0 box-border lg:left-auto lg:right-6 lg:bottom-6 lg:w-[390px] lg:max-w-[calc(100vw-3rem)] bg-card border-t lg:border border-border lg:rounded-lg shadow-2xl max-h-[68vh] overflow-y-auto safe-bottom">
      <div className="sticky top-0 z-10 w-full max-w-full min-w-0 box-border bg-card border-b border-border px-4 py-3 flex items-center gap-2">
        <Sparkles size={16} className="shrink-0 text-sage-deep" />
        <span className="min-w-0 text-sm font-semibold">AI 阅读理解</span>
        <button type="button" onClick={onClose} title="关闭" className="ml-auto h-8 w-8 shrink-0 rounded-md flex items-center justify-center hover:bg-ink/5"><X size={16} /></button>
      </div>
      <div className="w-full max-w-full min-w-0 box-border p-4 space-y-5 [overflow-wrap:anywhere]">
        <blockquote className="w-full max-w-full min-w-0 whitespace-normal [overflow-wrap:anywhere] text-sm font-serif leading-7 border-l-2 border-sage pl-3">{sentence}</blockquote>
        {loading && <div className="py-8 flex items-center justify-center gap-2 text-sm text-ink-lighter"><Loader2 size={17} className="animate-spin" />正在理解这句话</div>}
        {error && (
          <div className="py-5 text-center">
            <p className="text-sm text-red-600">AI 解析失败</p>
            <p className="text-xs text-ink-lighter mt-1 break-words">{error}</p>
            <button type="button" onClick={onRetry} className="mt-3 h-9 px-3 rounded-lg border border-border inline-flex items-center gap-2 text-sm"><RefreshCw size={14} />重新分析</button>
          </div>
        )}
        {analysis && (
          <>
            <PanelSection title="中文理解"><p>{analysis.chinese_understanding}</p></PanelSection>
            <PanelSection title="这句话怎么理解"><p>{analysis.language_explanation}</p></PanelSection>
            <PanelSection title="值得学的表达">
              {analysis.key_expressions.length === 0 ? (
                <p className="text-ink-lighter">这句话没有特别需要积累的表达。</p>
              ) : analysis.key_expressions.map((item) => {
                const key = expressionText(item);
                const state = saveStates[key];
                return (
                  <div key={key} className="w-full max-w-full min-w-0 border-b border-border last:border-0 py-3 first:pt-0">
                    <div className="flex w-full max-w-full min-w-0 gap-3">
                      <div className="flex-1 min-w-0 max-w-full [overflow-wrap:anywhere]">
                        <p className="max-w-full whitespace-normal [overflow-wrap:anywhere] font-semibold text-ink">{key}</p>
                        <p className="max-w-full whitespace-normal [overflow-wrap:anywhere] text-xs text-sage-deep mt-0.5">{item.chinese}</p>
                        <p className="max-w-full whitespace-normal [overflow-wrap:anywhere] text-xs text-ink-light mt-1.5 leading-5">{item.contextual_meaning || item.explanation}</p>
                        {item.usage_note && <p className="max-w-full whitespace-normal [overflow-wrap:anywhere] text-xs text-ink-lighter mt-1">{item.usage_note}</p>}
                        {item.register === "written" && <p className="text-[11px] text-amber-700 mt-1">偏书面 · 阅读理解为主</p>}
                        {(item.speaking_example || (item.register !== "written" && analysis.speaking_examples[0])) && (
                          <p className="max-w-full whitespace-normal [overflow-wrap:anywhere] text-xs bg-warm-cream rounded-md px-2.5 py-2 mt-2">{item.speaking_example || analysis.speaking_examples[0]}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={state === "saving" || state === "created" || state === "existing"}
                        onClick={() => onSave(item)}
                        title={state === "existing" ? "已在表达库中" : "加入表达库"}
                        className="h-9 w-9 shrink-0 rounded-md border border-border flex items-center justify-center disabled:bg-sage-light disabled:text-sage-deep"
                      >
                        {state === "saving" ? <Loader2 size={15} className="animate-spin" /> : state === "created" || state === "existing" ? <Check size={16} /> : <BookmarkPlus size={16} />}
                      </button>
                    </div>
                    {state === "created" && <p className="text-[11px] text-sage-deep mt-2">已加入表达库</p>}
                    {state === "existing" && <p className="text-[11px] text-sage-deep mt-2">已在表达库中，来源已关联</p>}
                    {state === "error" && <p className="text-[11px] text-red-600 mt-2">保存失败，请重试</p>}
                  </div>
                );
              })}
            </PanelSection>
          </>
        )}
      </div>
    </aside>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="w-full max-w-full min-w-0 whitespace-normal [overflow-wrap:anywhere] text-sm leading-6"><h2 className="text-xs font-semibold text-ink-lighter mb-2">{title}</h2>{children}</section>;
}
