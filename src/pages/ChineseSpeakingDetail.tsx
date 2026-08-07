import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Loader2, AlertTriangle, Mic, Sparkles,
  Target, Lightbulb, RotateCcw, CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useChineseSpeakingSession,
  TOPIC_TYPE_LABELS,
  FRAMEWORK_LABELS,
  isV4Diagnosis,
  hasContentDeepening,
  type ChineseTopicType,
  type ChineseFramework,
  type ChineseSpeakingAttempt,
  type V4Diagnosis,
  type V4DimensionScore,
  type DeliveryMetrics,
  type ContentDeepening,
  type ContentDeepeningMissingElement,
} from "@/lib/hooks/useChineseSpeaking";

// ── Shared dimension bar ──

function DimensionBar({ name, score, maxScore, comment }: {
  name: string; score: number; maxScore: number; comment: string;
}) {
  const pct = (score / maxScore) * 100;
  const color =
    pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-sage-deep/60" : pct >= 40 ? "bg-amber-400" : "bg-accent-rose/60";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink">{name}</span>
        <span className="text-xs font-mono text-ink-light">{score}/{maxScore}</span>
      </div>
      <div className="h-1.5 bg-ink/8 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-[11px] text-ink-lighter leading-relaxed">{comment}</p>
    </div>
  );
}

// ── V4 components ──

function ScoresV4({ diagnosis }: { diagnosis: V4Diagnosis }) {
  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">得分</span>
        <span className="text-lg font-bold text-sage-deep">{diagnosis.overall.score} 分</span>
      </div>
      <p className="text-xs text-ink-lighter">{diagnosis.overall.summary}</p>
      {diagnosis.dimensions.map((dim) => (
        <DimensionBar
          key={dim.key}
          name={dim.label}
          score={dim.score}
          maxScore={dim.max_score}
          comment={dim.diagnosis}
        />
      ))}
    </div>
  );
}

function DiagnosisV4({ diagnosis }: { diagnosis: V4Diagnosis }) {
  return (
    <div className="pt-2 border-t border-border/50 space-y-2">
      <div className="flex items-center gap-2">
        <Target size={14} className="text-accent-rose" />
        <p className="text-xs font-medium text-ink">关键问题</p>
      </div>
      {diagnosis.top_issues.map((issue, i) => (
        <div key={i} className="text-xs space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
              issue.severity === "high" ? "bg-accent-rose/10 text-accent-rose"
                : issue.severity === "medium" ? "bg-amber-100 text-amber-700"
                : "bg-ink/5 text-ink-light",
            )}>
              {issue.severity === "high" ? "严重" : issue.severity === "medium" ? "中等" : "轻微"}
            </span>
            <span className="font-medium text-ink">{issue.title}</span>
          </div>
          {issue.evidence_quote && <p className="text-ink-lighter italic">&ldquo;{issue.evidence_quote}&rdquo;</p>}
          {issue.action && <p className="text-sage-deep">{issue.action}</p>}
        </div>
      ))}
    </div>
  );
}

function StructureV4({ diagnosis }: { diagnosis: V4Diagnosis }) {
  return (
    <div className="pt-2 border-t border-border/50 space-y-2">
      <div className="flex items-center gap-2">
        <Lightbulb size={14} className="text-purple-600" />
        <p className="text-xs font-medium text-ink">推荐结构</p>
      </div>
      <div className="inline-flex px-2.5 py-1 bg-purple-100 rounded-full">
        <span className="text-xs font-medium text-purple-700">{diagnosis.recommended_structure.name}</span>
      </div>
      <p className="text-xs text-ink-lighter">{diagnosis.recommended_structure.reason}</p>
      {diagnosis.recommended_structure.steps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {diagnosis.recommended_structure.steps.map((step) => (
            <span key={step} className="text-[10px] bg-purple-50 text-purple-600 rounded-full px-2 py-0.5">{step}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ThinkingDeepeningV4({ diagnosis }: { diagnosis: V4Diagnosis }) {
  if (!diagnosis.thinking_or_deepening?.items?.length) return null;
  return (
    <div className="pt-2 border-t border-border/50 space-y-2">
      <div className="flex items-center gap-2">
        <Lightbulb size={14} className="text-purple-600" />
        <p className="text-xs font-medium text-ink">{diagnosis.thinking_or_deepening.title}</p>
      </div>
      {diagnosis.thinking_or_deepening.items.map((item, i) => (
        <div key={i} className="bg-purple-50/50 rounded-lg p-2.5 space-y-1">
          <p className="text-[11px] font-medium text-purple-700">{item.lens}</p>
          <p className="text-[11px] text-ink-light">{item.insight}</p>
          <p className="text-[10px] text-purple-500">{item.application}</p>
        </div>
      ))}
    </div>
  );
}

function ContentDeepeningV4({ diagnosis }: { diagnosis: Record<string, unknown> }) {
  if (!hasContentDeepening(diagnosis)) return null;
  const cd = diagnosis.content_deepening as ContentDeepening;
  return (
    <div className="pt-2 border-t border-border/50 space-y-2">
      <div className="flex items-center gap-2">
        <Target size={14} className="text-blue-600" />
        <p className="text-xs font-medium text-ink">内容深度提升</p>
      </div>

      <p className="text-xs text-ink-lighter">{cd.overall_problem}</p>

      {cd.information_density && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-ink-lighter">信息密度</span>
          <span className={cn(
            "text-[10px] font-medium rounded-full px-2 py-0.5",
            cd.information_density.level === "high" && "bg-emerald-100 text-emerald-700",
            cd.information_density.level === "medium" && "bg-amber-100 text-amber-700",
            cd.information_density.level === "low" && "bg-accent-rose/10 text-accent-rose",
          )}>
            {cd.information_density.level === "high" ? "高" : cd.information_density.level === "medium" ? "中" : "低"}
          </span>
        </div>
      )}

      {cd.missing_elements?.filter((el: ContentDeepeningMissingElement) => !el.present).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-ink">缺少的内容</p>
          {cd.missing_elements
            .filter((el: ContentDeepeningMissingElement) => !el.present)
            .map((el: ContentDeepeningMissingElement) => (
              <div key={el.key} className="bg-amber-50/50 rounded-lg p-2 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-amber-700">{el.label}</span>
                  <span className="text-[9px] text-amber-500">— {el.why_it_matters}</span>
                </div>
                <p className="text-[10px] text-ink-lighter">{el.what_can_improve}</p>
                <p className="text-[10px] text-blue-600">{el.guiding_question}</p>
              </div>
            ))}
        </div>
      )}

      {cd.abstraction_analysis && (
        <div className="bg-blue-50/30 rounded-lg p-2 space-y-0.5">
          <p className="text-[11px] font-medium text-blue-700">表达层次</p>
          <p className="text-[10px] text-ink-lighter">{cd.abstraction_analysis.current_level}</p>
          <p className="text-[10px] text-blue-600">{cd.abstraction_analysis.upgrade_direction}</p>
        </div>
      )}

      {cd.expansion_path?.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-ink">展开路径</p>
          {cd.expansion_path.map((step) => (
            <div key={step.step} className="flex gap-2">
              <span className="text-[10px] font-bold text-blue-600 shrink-0">{step.step}.</span>
              <div>
                <p className="text-[10px] font-medium text-ink">{step.focus}</p>
                <p className="text-[10px] text-blue-600">{step.question}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FactConsistencyV4({ diagnosis }: { diagnosis: V4Diagnosis }) {
  if (!diagnosis.fact_consistency) return null;
  const fc = diagnosis.fact_consistency;
  return (
    <div className={cn(
      "rounded-xl p-3 text-xs",
      fc.status === "needs_confirmation"
        ? "bg-amber-50 border border-amber-100 text-amber-700"
        : fc.status === "not_applicable"
        ? "bg-ink/5 border border-border text-ink-light"
        : "bg-emerald-50/50 border border-emerald-100 text-emerald-700",
    )}>
      <span className="flex items-center gap-1.5">
        {fc.status === "needs_confirmation"
          ? <><AlertTriangle size={12} /> {fc.message}</>
          : <><CheckCircle2 size={12} /> {fc.message || "事实一致性保护 — AI未新增关键事实"}</>
        }
      </span>
    </div>
  );
}

function KeyUpgradesV4({ diagnosis }: { diagnosis: V4Diagnosis }) {
  if (!diagnosis.key_upgrades?.length) return null;
  return (
    <div className="pt-2 border-t border-border/50 space-y-2">
      <p className="text-xs font-medium text-ink">关键提升点</p>
      {diagnosis.key_upgrades.map((ku, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-xs text-sage-deep font-bold shrink-0">{i + 1}.</span>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-ink">{ku.title}</p>
            <p className="text-[10px] text-ink-lighter">
              <span className="text-accent-rose/70">原：「{ku.original}」</span>
              {" → "}
              <span className="text-emerald-600/70">改：「{ku.direction}」</span>
            </p>
            <p className="text-[10px] text-ink-lighter/70">{ku.reason}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function OutlineV4({ outline }: { outline: { step: number; label: string; guidance: string; target_seconds: number }[] }) {
  return (
    <div className="pt-2 border-t border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb size={14} className="text-purple-600" />
        <p className="text-xs font-medium text-ink">答案骨架</p>
      </div>
      <div className="space-y-1">
        {outline.map((s) => (
          <div key={s.step} className="flex gap-2 text-xs">
            <span className="text-purple-600 font-medium">{s.step}. {s.label}</span>
            <span className="text-ink-lighter">{s.guidance}</span>
            {s.target_seconds != null && (
              <span className="text-ink-lighter/50">~{s.target_seconds}s</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Legacy V1/V2 components ──

function ScoresV2({ scores }: { scores: Record<string, unknown> }) {
  const dimLabels: Record<string, string> = {
    relevance: "主旨与切题度", structure_logic: "结构与逻辑",
    depth_critical_thinking: "内容深度与思辨", evidence_support: "细节与支撑",
    clarity: "表达清晰度", delivery: "口语呈现",
  };
  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">得分</span>
        <span className="text-lg font-bold text-sage-deep">{String(scores.overall_score ?? "")} 分</span>
      </div>
      <p className="text-xs text-ink-lighter">{String(scores.overall_judgment ?? "")}</p>
      {Object.entries(dimLabels).map(([key, label]) => {
        const dim = (scores as Record<string, Record<string, unknown>>)[key];
        if (!dim) return null;
        return (
          <DimensionBar
            key={key}
            name={label}
            score={dim.score as number}
            maxScore={dim.max as number}
            comment={(dim.diagnosis as string) || ""}
          />
        );
      })}
    </div>
  );
}

function ScoresV1({ scores }: { scores: Record<string, unknown> }) {
  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">得分</span>
        <span className="text-lg font-bold text-sage-deep">{String(scores.total ?? "")} 分</span>
      </div>
      <p className="text-xs text-ink-lighter">{String(scores.verdict ?? "")}</p>
      {((scores as Record<string, unknown>).dimensions as Array<Record<string, unknown>>).map((d: Record<string, unknown>) => (
        <DimensionBar
          key={d.name as string}
          name={d.name as string}
          score={d.score as number}
          maxScore={d.max_score as number}
          comment={d.comment as string}
        />
      ))}
    </div>
  );
}

function DiagnosisV2({ diagnosis }: { diagnosis: Record<string, unknown> }) {
  return (
    <div className="pt-2 border-t border-border/50 space-y-2">
      <div className="flex items-center gap-2">
        <Target size={14} className="text-accent-rose" />
        <p className="text-xs font-medium text-ink">关键问题</p>
      </div>
      {((diagnosis as Record<string, unknown>).three_key_issues as Array<Record<string, unknown>>).map((p: Record<string, unknown>, i: number) => (
        <div key={i} className="text-xs space-y-0.5">
          <span className="font-medium text-ink">{p.title as string}</span>
          {p.evidence_quote ? <p className="text-ink-lighter italic">&ldquo;{String(p.evidence_quote)}&rdquo;</p> : null}
          {p.how_to_fix ? <p className="text-sage-deep">{String(p.how_to_fix)}</p> : null}
        </div>
      ))}
    </div>
  );
}

function DiagnosisV1({ diagnosis }: { diagnosis: Record<string, unknown> }) {
  return (
    <div className="pt-2 border-t border-border/50 space-y-2">
      <div className="flex items-center gap-2">
        <Target size={14} className="text-accent-rose" />
        <p className="text-xs font-medium text-ink">关键问题</p>
      </div>
      {((diagnosis as Record<string, unknown>).top_3_problems as Array<Record<string, unknown>>).map((p: Record<string, unknown>, i: number) => (
        <div key={i} className="text-xs space-y-0.5">
          <span className="font-medium text-ink">{String(p.problem ?? "")}</span>
          {p.suggestion ? <p className="text-sage-deep">{String(p.suggestion)}</p> : null}
        </div>
      ))}
    </div>
  );
}

function OutlineSection({ outline }: { outline: Record<string, unknown>[] }) {
  return (
    <div className="pt-2 border-t border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb size={14} className="text-purple-600" />
        <p className="text-xs font-medium text-ink">答案骨架</p>
      </div>
      <div className="space-y-1">
        {outline.map((s: Record<string, unknown>, i: number) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="text-purple-600 font-medium">{s.step as number}. {s.label as string}</span>
            <span className="text-ink-lighter">{(s.content || s.guidance) as string}</span>
            {(s.seconds != null || s.target_seconds != null) && (
              <span className="text-ink-lighter/50">~{(s.seconds || s.target_seconds) as number}s</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AttemptSection({ attempt, label }: { attempt: ChineseSpeakingAttempt; label: string }) {
  const scores = attempt.scores as Record<string, unknown> | null;
  const diagnosis = attempt.diagnosis as Record<string, unknown> | null;
  const outline = attempt.answer_outline as Record<string, unknown>[] | null;
  const speech = attempt.final_improved_speech;
  const metrics = attempt.delivery_metrics as DeliveryMetrics | null;

  const isV4 = isV4Diagnosis(attempt.diagnosis);
  const isV2 = !isV4 && scores && typeof scores.overall_score === "number";
  const v4Diag = isV4 ? (attempt.diagnosis as unknown as V4Diagnosis) : null;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Mic size={16} className="text-ink-light" />
        <p className="text-sm font-semibold text-ink">{label}</p>
      </div>

      {attempt.audio_url && (
        <audio controls src={attempt.audio_url} className="h-9 w-full max-w-[280px]" />
      )}

      {attempt.edited_transcript && (
        <div>
          <p className="text-xs font-medium text-ink-lighter mb-1">转录</p>
          <p className="text-sm text-ink bg-ink/[0.02] rounded-xl p-3 leading-relaxed">{attempt.edited_transcript}</p>
        </div>
      )}

      {/* V4 scores */}
      {isV4 && v4Diag && <ScoresV4 diagnosis={v4Diag} />}

      {/* V2 scores */}
      {isV2 && scores && <ScoresV2 scores={scores} />}

      {/* V1 scores */}
      {!isV4 && !isV2 && scores && (scores as Record<string, unknown>).dimensions ? <ScoresV1 scores={scores} /> : null}

      {/* V4 diagnosis */}
      {isV4 && v4Diag && (
        <>
          <DiagnosisV4 diagnosis={v4Diag} />
          <StructureV4 diagnosis={v4Diag} />
          {v4Diag.thinking_or_deepening?.items?.length > 0 && <ThinkingDeepeningV4 diagnosis={v4Diag} />}
          <ContentDeepeningV4 diagnosis={attempt.diagnosis as Record<string, unknown>} />
          <KeyUpgradesV4 diagnosis={v4Diag} />
          <FactConsistencyV4 diagnosis={v4Diag} />
        </>
      )}

      {/* V2 diagnosis */}
      {!isV4 && diagnosis && (diagnosis as Record<string, unknown>).three_key_issues ? <DiagnosisV2 diagnosis={diagnosis} /> : null}

      {/* V1 diagnosis */}
      {!isV4 && diagnosis && !(diagnosis as Record<string, unknown>).three_key_issues && (diagnosis as Record<string, unknown>).top_3_problems ? <DiagnosisV1 diagnosis={diagnosis} /> : null}

      {speech && (
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-sage-deep" />
            <p className="text-xs font-medium text-ink">AI 优化参考</p>
          </div>
          <details className="group">
            <summary className="text-sm text-ink leading-relaxed cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="line-clamp-2">{speech}</span>
              <span className="text-[11px] text-sage-deep font-medium mt-1 inline-block">
                <ChevronDown size={14} className="inline mr-1 group-open:hidden" />
                <ChevronUp size={14} className="hidden mr-1 group-open:inline" />
                展开完整参考
              </span>
            </summary>
            <p className="text-sm text-ink leading-relaxed mt-2 pt-2 border-t border-border/50">
              {speech}
            </p>
          </details>
        </div>
      )}

      {/* V4 outline */}
      {isV4 && v4Diag && v4Diag.answer_outline?.length > 0 && (
        <OutlineV4 outline={v4Diag.answer_outline} />
      )}

      {/* Legacy outline */}
      {!isV4 && outline && outline.length > 0 && <OutlineSection outline={outline} />}

      {metrics && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs font-medium text-ink-lighter mb-1">口语数据</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
            <span className="text-ink-lighter">语速</span><span>{metrics.pace_wpm} 字/分钟</span>
            <span className="text-ink-lighter">口头禅</span><span>{metrics.filler_word_count} 次</span>
            <span className="text-ink-lighter">字数</span><span>{metrics.word_count} 字</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChineseSpeakingDetail() {
  const [, params] = useRoute("/chinese/detail/:id");
  const [, navigate] = useLocation();
  const sessionId = params?.id || "";

  const { data: session, isLoading, error } = useChineseSpeakingSession(sessionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-sage-deep" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-16 space-y-3">
        <AlertTriangle size={32} className="opacity-30 mx-auto" />
        <p className="text-sm text-ink-lighter">未找到此练习记录</p>
        <button onClick={() => navigate("/chinese/history")} className="text-sm text-sage-deep font-medium underline">
          返回历史记录
        </button>
      </div>
    );
  }

  const round1 = session.attempts?.find((a) => a.attempt_round === 1 && !a.is_retry);
  const round2 = session.attempts?.find((a) => a.attempt_round === 2);
  const topicTypeLabel = session.topic_type
    ? TOPIC_TYPE_LABELS[session.topic_type as ChineseTopicType]
    : null;
  const frameworkLabel = session.recommended_framework
    ? FRAMEWORK_LABELS[session.recommended_framework as ChineseFramework]
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/chinese/history")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {topicTypeLabel && (
              <span className="text-[10px] bg-ink/5 text-ink-light rounded-full px-2 py-0.5">{topicTypeLabel}</span>
            )}
            {frameworkLabel && (
              <span className="text-[10px] bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">{frameworkLabel}</span>
            )}
          </div>
          <h1 className="text-lg font-semibold truncate">{session.topic}</h1>
        </div>
      </header>

      {/* Round 1 */}
      {round1 && <AttemptSection attempt={round1} label="第一次表达" />}

      {/* Round 2 */}
      {round2 && <AttemptSection attempt={round2} label="第二次表达（重新表达）" />}

      {/* Comparison if both exist */}
      {round1 && round2 && (() => {
        const r1IsV4 = isV4Diagnosis(round1.diagnosis);
        const r2IsV4 = isV4Diagnosis(round2.diagnosis);

        if (r1IsV4 && r2IsV4) {
          const d1 = round1.diagnosis as unknown as V4Diagnosis;
          const d2 = round2.diagnosis as unknown as V4Diagnosis;
          return (
            <div className="bg-gradient-to-r from-sage-light/5 to-purple-50/50 border border-sage-light/30 rounded-2xl p-4">
              <p className="text-sm font-medium text-ink mb-3">前后对比</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white/60 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-ink-lighter mb-0.5">第一次表达</p>
                  <p className="text-xl font-bold text-ink">{d1.overall.score}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-ink-lighter mb-0.5">第二次表达</p>
                  <p className={cn(
                    "text-xl font-bold",
                    d2.overall.score > d1.overall.score ? "text-emerald-600"
                      : d2.overall.score < d1.overall.score ? "text-accent-rose"
                      : "text-sage-deep",
                  )}>
                    {d2.overall.score}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {d1.dimensions.map((dim1) => {
                  const dim2 = d2.dimensions.find((d) => d.key === dim1.key);
                  const delta = dim2 ? dim2.score - dim1.score : 0;
                  return (
                    <div key={dim1.key} className="flex items-center gap-2 text-[10px] mb-0.5">
                      <span className="text-ink-lighter w-20 shrink-0">{dim1.label}</span>
                      <span className="font-mono w-5">{dim1.score}</span>
                      <span className="font-mono font-medium text-sage-deep w-5">{dim2?.score ?? "-"}</span>
                      <span className={cn(
                        "font-medium",
                        delta > 0 ? "text-emerald-600" : delta < 0 ? "text-accent-rose" : "text-ink-lighter",
                      )}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // Legacy V1/V2 comparison
        const r1s = round1.scores as Record<string, unknown> | null;
        const r2s = round2.scores as Record<string, unknown> | null;
        if (!r1s || !r2s) return null;

        const isV2 = typeof r1s.overall_score === "number";
        const r1Total = (isV2 ? r1s.overall_score : r1s.total) as number;
        const r2Total = (isV2 ? r2s.overall_score : r2s.total) as number;
        const dimLabels: Record<string, string> = {
          relevance: "主旨与切题度", structure_logic: "结构与逻辑",
          depth_critical_thinking: "内容深度与思辨", evidence_support: "细节与支撑",
          clarity: "表达清晰度", delivery: "口语呈现",
        };

        return (
          <div className="bg-gradient-to-r from-sage-light/5 to-purple-50/50 border border-sage-light/30 rounded-2xl p-4">
            <p className="text-sm font-medium text-ink mb-3">前后对比</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white/60 rounded-xl p-3 text-center">
                <p className="text-[10px] text-ink-lighter mb-0.5">第一次表达</p>
                <p className="text-xl font-bold text-ink">{r1Total}</p>
              </div>
              <div className="bg-white/60 rounded-xl p-3 text-center">
                <p className="text-[10px] text-ink-lighter mb-0.5">第二次表达</p>
                <p className="text-xl font-bold text-sage-deep">{r2Total}</p>
              </div>
            </div>
            {isV2
              ? Object.entries(dimLabels).map(([key, label]) => {
                  const d1 = (r1s as Record<string, Record<string, unknown>>)[key];
                  const d2 = (r2s as Record<string, Record<string, unknown>>)[key];
                  if (!d1) return null;
                  const s1 = d1.score as number;
                  const s2 = d2?.score as number | undefined;
                  const delta = s2 != null ? s2 - s1 : 0;
                  return (
                    <div key={key} className="flex items-center gap-2 text-[10px] mb-0.5">
                      <span className="text-ink-lighter w-20 shrink-0">{label}</span>
                      <span className="font-mono w-5">{s1}</span>
                      <span className="font-mono font-medium text-sage-deep w-5">{s2 ?? "-"}</span>
                      <span className={delta > 0 ? "text-emerald-600" : delta < 0 ? "text-accent-rose" : "text-ink-lighter"}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    </div>
                  );
                })
              : ((r1s as Record<string, unknown>).dimensions as Array<Record<string, unknown>>)?.map((d1: Record<string, unknown>, i: number) => {
                  const dims = (r2s as Record<string, unknown>).dimensions as Array<Record<string, unknown>>;
                  const d2 = dims?.[i];
                  const s1 = d1.score as number;
                  const s2 = d2?.score as number | undefined;
                  const delta = s2 != null ? s2 - s1 : 0;
                  return (
                    <div key={d1.name as string} className="flex items-center gap-2 text-[10px] mb-0.5">
                      <span className="text-ink-lighter w-20 shrink-0">{d1.name as string}</span>
                      <span className="font-mono w-5">{s1}</span>
                      <span className="font-mono font-medium text-sage-deep w-5">{s2 ?? "-"}</span>
                      <span className={delta > 0 ? "text-emerald-600" : delta < 0 ? "text-accent-rose" : "text-ink-lighter"}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    </div>
                  );
                })
            }
          </div>
        );
      })()}

      {/* Re-practice CTA */}
      <button
        onClick={() => navigate("/chinese")}
        className="w-full border border-dashed border-sage-light/40 rounded-xl py-2.5 text-sm text-ink-light flex items-center justify-center gap-2 hover:border-sage-light/60"
      >
        <RotateCcw size={14} />
        再来一次练习
      </button>
    </div>
  );
}
