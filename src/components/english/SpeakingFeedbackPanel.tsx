import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Check } from "lucide-react";
import type { SimplifiedSpeakingFeedback, SpeakingCorrection, SpeakingTakeaway } from "@/lib/english/speakingFeedback";
import { normalizeExpressionKey } from "@/lib/english/speakingFeedback";
import { fetchExistingExpressionEnglish, saveSpeakingTakeaway } from "@/lib/english/speakingBank";
import { ScoreBar, readDims, readContent } from "@/components/english/SpeakingScoreBars";

const issueLabels: Record<string, string> = { content: "内容", structure: "结构", grammar: "语法", vocabulary: "搭配", relevance: "切题", naturalness: "自然度" };

const categoryLabels: Record<string, string> = {
  grammar: "Grammar", collocation: "Vocabulary", word_choice: "Vocabulary", vocabulary: "Vocabulary", naturalness: "Naturalness", sentence_structure: "Grammar", expression_upgrade: "Naturalness", logic: "Logic", relevance: "Relevance",
};
const ERROR_CATEGORIES = new Set(["grammar", "collocation", "word_choice", "sentence_structure"]);

const card = "rounded-2xl border border-border bg-card p-4 space-y-2 min-w-0";
const subtle = "text-xs text-ink-lighter";

function CollapsibleCard({ defaultOpen = false, title, children, className = card, "aria-label": ariaLabel }: { defaultOpen?: boolean; title: string; children: ReactNode; className?: string; "aria-label"?: string }) {
  return (
    <details open={defaultOpen} className={className} aria-label={ariaLabel}>
      <summary className="text-sm font-semibold cursor-pointer select-none">{title}</summary>
      <div className="pt-2 space-y-2 min-w-0">{children}</div>
    </details>
  );
}

function EmptyCorrectionsNote() {
  return <p className="text-xs text-ink-light">本条反馈没有可展示的具体纠错；如反馈不完整，可重新分析。</p>;
}

function CorrectionItem({ c }: { c: SpeakingCorrection }) {
  const isError = c.nature ? c.nature === "Error" : ERROR_CATEGORIES.has(c.category);
  const tag = c.nature || (isError ? "Error" : c.category === "expression_upgrade" || c.category === "naturalness" ? "Upgrade" : "");
  return (
    <li className="rounded-xl bg-ink/[0.03] border border-border p-3 space-y-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {c.category && (
          <span className={`text-[10px] rounded-full px-2 py-px font-medium ${isError ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>
            {categoryLabels[c.category] || c.category}
          </span>
        )}
        {tag && <span className={`text-[10px] rounded-full px-2 py-px ${isError ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>{tag}</span>}
      </div>
      <div className="text-sm leading-relaxed break-words">
        {c.original && <span className={isError ? "text-accent-rose line-through decoration-accent-rose/60" : "text-ink-light"}>{c.original}</span>}
        {c.original && c.corrected && <span className="text-ink-lighter mx-1.5">→</span>}
        {c.corrected && <span className="text-sage-deep font-medium">{c.corrected}</span>}
      </div>
      {c.explanation_zh && <p className="text-xs text-ink-light">{c.explanation_zh}</p>}
    </li>
  );
}

function ScoreDims({ feedback }: { feedback: SimplifiedSpeakingFeedback }) {
  const dims = readDims(feedback);
  const entries = [
    ["流利度 Fluency", dims.fluency],
    ["语法 Grammar", dims.grammar],
    ["词汇 Vocabulary", dims.vocabulary],
    ["自然度 Naturalness", dims.naturalness],
  ] as const;
  const shown = entries.filter(([, v]) => v !== null);
  if (!shown.length) return null;
  return (
    <div className="space-y-1.5 pt-1">
      {shown.map(([label, v]) => <ScoreBar key={label} label={label} score={v as number} />)}
    </div>
  );
}

// ── Takeaway → expression bank ──

function TakeawayList({ items }: { items: SpeakingTakeaway[] }) {
  const [states, setStates] = useState<Record<number, "idle" | "saving" | "added" | "exists">>({});
  const [existingSet, setExistingSet] = useState<Set<string> | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const bankable = items.filter(t => !t.readonly);

  const itemsKey = useMemo(() => items.map(t => normalizeExpressionKey(t.expression)).join("|"), [items]);

  useEffect(() => {
    if (!bankable.length) return;
    let alive = true;
    fetchExistingExpressionEnglish()
      .then(set => { if (alive) setExistingSet(set); })
      .catch(() => { if (alive) setExistingSet(new Set()); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const statusOf = (t: SpeakingTakeaway, i: number): "idle" | "saving" | "added" | "exists" => {
    if (existingSet?.has(normalizeExpressionKey(t.expression))) return "exists";
    return states[i] || "idle";
  };

  const addOne = async (t: SpeakingTakeaway, i: number) => {
    setBankError(null);
    setStates(prev => ({ ...prev, [i]: "saving" }));
    try {
      const result = await saveSpeakingTakeaway(t);
      if (result === "exists") {
        setExistingSet(prev => { const next = new Set(prev || []); next.add(normalizeExpressionKey(t.expression)); return next; });
        setStates(prev => ({ ...prev, [i]: "exists" }));
      } else {
        setStates(prev => ({ ...prev, [i]: "added" }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setBankError(`加入表达库失败：${msg}`);
      setStates(prev => ({ ...prev, [i]: "idle" }));
    }
  };

  const addAll = async () => {
    for (let i = 0; i < items.length; i++) {
      const t = items[i];
      if (t.readonly) continue;
      const st = statusOf(t, i);
      if (st === "added" || st === "exists" || st === "saving") continue;
      await addOne(t, i);
    }
  };

  const pendingCount = items.filter((t, i) => !t.readonly && statusOf(t, i) === "idle").length;
  const showActions = bankable.length > 0;

  return (
    <div className="space-y-2 pt-1">
      {showActions && (
        <div className="flex items-center justify-end">
          <button
            onClick={addAll}
            disabled={pendingCount === 0}
            className="text-[11px] font-medium text-sage-deep bg-sage-light rounded-full px-3 py-1 hover:bg-sage-light/70 disabled:opacity-40 transition-colors"
          >
            全部加入 ({pendingCount})
          </button>
        </div>
      )}
      {items.map((t, i) => {
        const st = statusOf(t, i);
        return (
          <div key={i} className="rounded-xl border border-border bg-ink/[0.02] p-3 space-y-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink break-words">{t.expression}</p>
                <p className="text-xs text-ink-light mt-0.5">{t.meaning || t.meaning_zh}</p>
              </div>
              {t.readonly ? (
                <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5 shrink-0">旧版回顾</span>
              ) : st === "exists" ? (
                <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">已在表达库</span>
              ) : st === "added" ? (
                <span className="text-[10px] text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap flex items-center gap-0.5"><Check size={10} /> 已加入</span>
              ) : (
                <button
                  onClick={() => addOne(t, i)}
                  disabled={st === "saving"}
                  className="text-[11px] font-medium text-sage-deep border border-sage-light/60 rounded-full px-2.5 py-0.5 hover:bg-sage-light/40 disabled:opacity-50 shrink-0 whitespace-nowrap flex items-center gap-1"
                >
                  {st === "saving" ? <Loader2 size={10} className="animate-spin" /> : null}
                  {st === "saving" ? "加入中..." : "加入表达库"}
                </button>
              )}
            </div>
            {t.why_useful && <p className="text-xs text-ink-lighter">{t.why_useful}</p>}
            {t.example && <p className="text-xs text-ink-light italic">例：{t.example}</p>}
            {t.usage_note && <p className="text-[11px] text-ink-lighter">用法：{t.usage_note}</p>}
          </div>
        );
      })}
      {bankError && <p className="text-xs text-accent-rose">{bankError}</p>}
    </div>
  );
}

// ── Panel ──

export function SpeakingFeedbackPanel({ feedback, retry = false }: { feedback: SimplifiedSpeakingFeedback; retry?: boolean }) {
  const content = readContent(feedback);
  const hasContentIssues = content.offTopic.length > 0 || content.repetition.length > 0 || content.orderProblems.length > 0 || content.contentGaps.length > 0;
  const contentDims = [
    ["切题度 Relevance", content.relevance],
    ["连贯性 Coherence", content.coherence],
    ["展开度 Development", content.development],
  ] as const;

  return (
    <div className="space-y-3 break-words">
      {/* Block 1 — 本轮表现 (default expanded) */}
      <section className={card} aria-label="本轮表现">
        <h2 className="text-sm font-semibold">本轮表现</h2>
        <p className="text-sm">
          当前表现：{feedback.overall_score === null ? "暂未评分" : feedback.overall_score.toFixed(1)}
          {!retry && feedback.target_score !== null && <span className="ml-3 text-ink-light">优化目标：{feedback.target_score.toFixed(1)}+</span>}
        </p>
        <ScoreDims feedback={feedback} />
        <p className={subtle}>以下评分基于转录文本，不包含真实发音、停顿、语速和语调评价。</p>
        {!!feedback.key_issues.length && (
          <ul className="list-disc pl-5 text-sm space-y-1 pt-1">
            {feedback.key_issues.map((i, n) => <li key={n}>{issueLabels[i.type] ? `${issueLabels[i.type]}：` : ""}{i.message}</li>)}
          </ul>
        )}
      </section>

      {retry ? (
        <section className={card} aria-label="复述反馈">
          <h2 className="text-sm font-semibold">复述反馈</h2>
          <p className="text-sm whitespace-pre-line">{feedback.optimization_summary || "本次复述反馈暂不完整，请重新分析。"}</p>
          {!!feedback.retry_checks.length && (
            <ul className="space-y-1.5 pt-1">
              {feedback.retry_checks.map((c, n) => (
                <li key={n} className="flex items-start gap-2 text-sm">
                  <span className="text-purple-500 mt-1.5 h-1.5 w-1.5 rounded-full bg-purple-300 shrink-0" />
                  <span>{c.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {/* Block 2 — 纠错与表达升级 */}
          <section className={card} aria-label="纠错与表达升级">
            <h2 className="text-sm font-semibold">纠错与表达升级</h2>
            {feedback.corrections.length ? (
              <ul className="space-y-2 pt-1">{feedback.corrections.map((c, n) => <CorrectionItem key={n} c={c} />)}</ul>
            ) : <EmptyCorrectionsNote />}
          </section>

          {/* Block 3 — 内容与结构诊断 (collapsible) */}
          {(
            <CollapsibleCard title="内容与结构诊断" aria-label="内容与结构诊断">
              <p className="text-sm text-ink-light leading-relaxed"><strong>内容诊断：</strong>{feedback.content_diagnosis || content.summary || "暂无内容诊断。"}</p>
              <p className="text-sm text-ink-light leading-relaxed"><strong>结构诊断：</strong>{feedback.structure_diagnosis || content.orderProblems.join("；") || "暂无单独结构诊断。"}</p>
              <p className="text-sm text-ink-light leading-relaxed"><strong>优化建议：</strong>{feedback.optimization_advice || feedback.optimization_summary || "暂无建议。"}</p>
              <div className="space-y-1.5">
                {contentDims.filter(([, v]) => v !== null).map(([label, v]) => <ScoreBar key={label} label={label} score={v as number} />)}
              </div>
              {hasContentIssues && (
                <div className="space-y-1 text-xs text-ink-light pt-1">
                  {content.offTopic.map((p, i) => <p key={`o${i}`} className="flex items-start gap-1.5"><span className="text-amber-500 shrink-0">⚠</span><span>偏题：{p}</span></p>)}
                  {content.repetition.map((p, i) => <p key={`r${i}`} className="flex items-start gap-1.5"><span className="text-ink-lighter shrink-0">↻</span><span>重复：{p}</span></p>)}
                  {content.orderProblems.map((p, i) => <p key={`d${i}`} className="flex items-start gap-1.5"><span className="text-ink-lighter shrink-0">⇄</span><span>顺序：{p}</span></p>)}
                  {content.contentGaps.map((p, i) => <p key={`g${i}`} className="flex items-start gap-1.5"><span className="text-blue-500 shrink-0">+</span><span>缺失：{p}</span></p>)}
                </div>
              )}
            </CollapsibleCard>
          )}

          {/* Block 4 — My Best Version */}
          <section className="rounded-2xl border-2 border-sage-deep/40 bg-sage-light/30 p-5 space-y-3 min-w-0" aria-label="我的回答·最佳表达">
            <h2 className="font-semibold text-sage-deep">我的回答·最佳表达</h2>
            <p className="text-base leading-relaxed whitespace-pre-line">{feedback.final_upgraded_answer || (feedback.answer_status === "unavailable" ? "本次表达未通过原意核对，请重新分析。" : "未生成有效的优化表达，请重新分析。")}</p>
            <p className="text-xs text-ink-light">这是你的想法，只是表达得更好了。{feedback.expansion_notice}</p>
          </section>

          {/* Block 6 — Answer Structure (collapsible scaffold) */}
          {!!feedback.answer_structure.length && (
            <CollapsibleCard title="Answer Structure" className="rounded-2xl border border-purple-100 bg-card p-4 space-y-2 min-w-0" aria-label="Answer Structure">
              <div className="space-y-2 pt-1">
                {feedback.answer_structure.map((s, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-600 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                      {i < feedback.answer_structure.length - 1 && <div className="w-px flex-1 bg-purple-100 my-1" />}
                    </div>
                    <div className="pb-2 flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-ink">{s.label}</p>
                      <p className="text-[11px] text-ink-lighter leading-relaxed mt-0.5 whitespace-pre-line">{s.content}</p>
                      {s.reusable_expression && <p className="text-xs text-sage-deep mt-1">可复用：{s.reusable_expression}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          )}

          {/* Block 7 — 可带走的表达 */}
          {!!feedback.takeaway_expressions.length && (
            <section className={card} aria-label="可带走的表达">
              <h2 className="text-sm font-semibold">可带走的表达</h2>
              <TakeawayList items={feedback.takeaway_expressions} />
            </section>
          )}

          {/* Block 8 — AI 参考答案 (collapsed by default) */}
          {!!feedback.reference_answer && (
            <details className={card} aria-label="AI 独立优秀回答">
              <summary className="text-sm font-medium cursor-pointer">AI 独立优秀回答</summary>
              <div className="pt-2 space-y-2 min-w-0">
                <p className="text-xs text-ink-light">另一种独立答题思路；示例不代表你的真实经历。{feedback.reference_angle_summary}</p>
                <p className="text-sm leading-relaxed whitespace-pre-line">{feedback.reference_answer}</p>
              </div>
            </details>
          )}
          {feedback.reference_status === "unavailable" && <section className={card}><h2 className="text-sm font-semibold">AI 独立优秀回答</h2><p className="text-xs text-ink-light">暂未生成通过独立性检查的参考回答，请重新分析。</p></section>}
        </>
      )}
    </div>
  );
}
