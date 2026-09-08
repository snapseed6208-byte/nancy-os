import type { SimplifiedSpeakingFeedback } from "@/lib/english/speakingFeedback";

const issueLabels: Record<string, string> = { content: "内容", structure: "结构", grammar: "语法", vocabulary: "搭配", relevance: "切题", naturalness: "自然度" };
export function SpeakingFeedbackPanel({ feedback, retry = false }: { feedback: SimplifiedSpeakingFeedback; retry?: boolean }) {
  const card = "rounded-2xl border border-border bg-card p-4 space-y-2 min-w-0";
  return <div className="space-y-3 break-words">
    <section className={card} aria-label="本轮表现">
      <h2 className="text-sm font-semibold">本轮表现</h2>
      <p className="text-sm">当前表现：{feedback.overall_score === null ? "暂未评分" : feedback.overall_score.toFixed(1)}
        {feedback.target_score !== null && <span className="ml-3 text-ink-light">优化目标：{feedback.target_score.toFixed(1)}+</span>}</p>
      <p className="text-xs text-ink-lighter">基于转录文本估计，不含发音评估。</p>
      {!!feedback.key_issues.length && <ul className="list-disc pl-5 text-sm space-y-1">{feedback.key_issues.map((i, n) => <li key={n}>{issueLabels[i.type] ? `${issueLabels[i.type]}：` : ""}{i.message}</li>)}</ul>}
    </section>
    {retry ? <section className={card} aria-label="复述反馈"><h2 className="text-sm font-semibold">复述反馈</h2>
      <p className="text-sm whitespace-pre-line">{feedback.optimization_summary || "本次复述反馈暂不完整，请重新分析。"}</p>
      <ul className="text-sm space-y-1">{feedback.retry_checks.map((c, n) => <li key={n}>{c.message}</li>)}</ul>
    </section> : <>
      <section className={card} aria-label="优化思路"><h2 className="text-sm font-semibold">优化思路</h2><p className="text-sm whitespace-pre-line">{feedback.optimization_summary || "本条记录暂无优化说明。"}</p></section>
      <section className="rounded-2xl border-2 border-sage-deep/40 bg-sage-light/30 p-5 space-y-3 min-w-0" aria-label="最终优化表达">
        <h2 className="font-semibold text-sage-deep">最终优化表达</h2>
        <p className="text-base leading-relaxed whitespace-pre-line">{feedback.final_upgraded_answer || "未生成有效的优化表达，请重新分析。"}</p>
        <p className="text-xs text-ink-light">{feedback.expansion_notice || "如含原回答未提供的解释或例子，请视为参考性展开，确认符合实际后再使用。"}</p>
      </section>
      {!!feedback.takeaway_expressions.length && <section className={card} aria-label="可带走的表达"><h2 className="text-sm font-semibold">可带走的表达</h2>{feedback.takeaway_expressions.map((e, n) => <p key={n} className="text-sm"><strong>{e.expression}</strong> · {e.meaning}<span className="block text-xs text-ink-light">{e.why_useful}</span></p>)}</section>}
      {!!feedback.reference_answer && <details className={card}><summary className="text-sm font-medium cursor-pointer">AI 参考答案</summary><p className="text-xs text-ink-light">另一种答题思路；示例不代表你的真实经历。</p><p className="text-sm leading-relaxed whitespace-pre-line">{feedback.reference_answer}</p></details>}
    </>}
  </div>;
}
