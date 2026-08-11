// ============================================
// English SRS V3.6 — Sentence Practice History
//
// Renders sentence practice records as readable
// learning logs instead of raw database dumps.
//
// Desktop: 4-column row layout
// Mobile:  stacked vertical layout
// ============================================

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  parseSentenceFeedback,
  type ParsedSentenceFeedback,
} from "@/lib/english/sentenceFeedback";
import { ChevronDown, ChevronUp } from "lucide-react";

// ── Types ──

export interface SentencePracticeRecord {
  expressionId: string;
  expressionEnglish: string;
  expressionChinese: string;
  userSentence: string;
  aiFeedback: string | null;
  completedAt: string | null;
}

export interface SentencePracticeHistoryProps {
  records: SentencePracticeRecord[];
  date?: string; // e.g. "2026-08-11", for future non-today usage
  compact?: boolean;
}

// ── Status badge ──

const STATUS_STYLES: Record<ParsedSentenceFeedback["status"], { icon: string; bg: string; text: string }> = {
  natural:    { icon: "✓", bg: "bg-emerald-50", text: "text-emerald-600" },
  acceptable: { icon: "△", bg: "bg-amber-50",   text: "text-amber-600" },
  needs_work: { icon: "!", bg: "bg-red-50",      text: "text-red-500" },
  unknown:    { icon: "—", bg: "bg-ink/5",       text: "text-ink-light" },
};

function FeedbackCell({ raw }: { raw: unknown }) {
  const feedback = parseSentenceFeedback(raw);
  const style = STATUS_STYLES[feedback.status];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="min-w-0">
      {/* Status badge */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={cn(
          "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0",
          style.bg, style.text,
        )}>
          {style.icon}
        </span>
        <span className={cn("text-xs font-medium", style.text)}>
          {feedback.statusLabel}
        </span>
      </div>

      {/* Overall feedback */}
      {feedback.overallFeedback && (
        <p className="text-xs text-ink-light leading-relaxed line-clamp-2">
          {feedback.overallFeedback}
        </p>
      )}

      {/* Corrections toggle */}
      {feedback.hasDetailedFeedback && (
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 text-[11px] text-sage hover:text-sage-deep mt-1 transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "收起详细反馈" : "查看详细反馈"}
        </button>
      )}

      {/* Expanded corrections */}
      {expanded && feedback.hasDetailedFeedback && (
        <ul className="mt-1.5 space-y-1 text-[11px] text-ink-light">
          {feedback.corrections.map((c, i) => (
            <li key={i} className="pl-3 border-l-2 border-amber-200">
              {c.explanation}
              {c.corrected && c.corrected !== c.original && (
                <span className="block text-emerald-600 mt-0.5">
                  {c.original} → {c.corrected}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Row (desktop) ──

function SentenceHistoryRow({ record }: { record: SentencePracticeRecord }) {
  return (
    <>
      {/* Desktop layout */}
      <div className="hidden md:grid md:grid-cols-[180px_1.4fr_1.2fr_1.4fr] gap-4 px-5 py-4 items-start">
        {/* Expression */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sage-deep truncate">
            {record.expressionEnglish}
          </p>
          <p className="text-[11px] text-ink-lighter truncate mt-0.5">
            {record.expressionChinese}
          </p>
        </div>

        {/* My Sentence */}
        <div className="min-w-0">
          <p className="text-[11px] text-ink-lighter mb-1 md:hidden">我的造句</p>
          <p className="text-sm text-ink leading-relaxed break-words">
            {record.userSentence || "—"}
          </p>
        </div>

        {/* AI Feedback */}
        <FeedbackCell raw={record.aiFeedback} />

        {/* Better Version */}
        <div className="min-w-0">
          <p className="text-[11px] text-ink-lighter mb-1 md:hidden">更自然表达</p>
          {(() => {
            const fb = parseSentenceFeedback(record.aiFeedback);
            if (fb.betterSentence) {
              return (
                <p className="text-sm text-sage-deep italic leading-relaxed break-words">
                  {fb.betterSentence}
                </p>
              );
            }
            return <p className="text-sm text-ink-light">—</p>;
          })()}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden px-4 py-4 space-y-2.5">
        {/* Expression */}
        <div>
          <p className="text-sm font-semibold text-sage-deep">
            {record.expressionEnglish}
          </p>
          <p className="text-[11px] text-ink-lighter">
            {record.expressionChinese}
          </p>
        </div>

        {/* My Sentence */}
        <div>
          <p className="text-[10px] text-ink-lighter mb-0.5">我的造句</p>
          <p className="text-sm text-ink leading-relaxed">
            {record.userSentence || "—"}
          </p>
        </div>

        {/* AI Feedback */}
        <div>
          <p className="text-[10px] text-ink-lighter mb-0.5">AI 反馈</p>
          <FeedbackCell raw={record.aiFeedback} />
        </div>

        {/* Better Version */}
        <div>
          <p className="text-[10px] text-ink-lighter mb-0.5">更自然表达</p>
          {(() => {
            const fb = parseSentenceFeedback(record.aiFeedback);
            if (fb.betterSentence) {
              return (
                <p className="text-sm text-sage-deep italic leading-relaxed">
                  {fb.betterSentence}
                </p>
              );
            }
            return <p className="text-sm text-ink-light">—</p>;
          })()}
        </div>
      </div>
    </>
  );
}

// ── Header summary (lightweight stats) ──

function HeaderSummary({ records }: { records: SentencePracticeRecord[] }) {
  const stats = { natural: 0, acceptable: 0, needsWork: 0 };
  for (const r of records) {
    const fb = parseSentenceFeedback(r.aiFeedback);
    if (fb.status === "natural") stats.natural++;
    else if (fb.status === "acceptable") stats.acceptable++;
    else if (fb.status === "needs_work") stats.needsWork++;
  }

  if (records.length === 0) return null;

  return (
    <div className="flex items-center gap-3 text-[11px] text-ink-lighter">
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        自然 {stats.natural}
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        需优化 {stats.acceptable}
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        需修改 {stats.needsWork}
      </span>
    </div>
  );
}

// ── Main component ──

export default function SentencePracticeHistory({
  records,
  compact: _compact,
}: SentencePracticeHistoryProps) {
  if (records.length === 0) {
    return (
      <div className="bg-white border border-border/60 rounded-2xl p-8 text-center">
        <p className="text-sm text-ink-light">今天还没有造句练习</p>
        <p className="text-xs text-ink-lighter mt-1">完成复习中的造句环节后，记录会出现在这里</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border/60 rounded-2xl overflow-hidden">
      {/* Desktop header */}
      <div className="hidden md:grid md:grid-cols-[180px_1.4fr_1.2fr_1.4fr] gap-4 px-5 py-3 bg-warm-cream/50 border-b border-border/40">
        <span className="text-[11px] font-medium text-ink-lighter">表达</span>
        <span className="text-[11px] font-medium text-ink-lighter">我的造句</span>
        <span className="text-[11px] font-medium text-ink-lighter">AI 反馈</span>
        <span className="text-[11px] font-medium text-ink-lighter">更自然表达</span>
      </div>

      {/* Rows */}
      {records.map((record, idx) => (
        <div
          key={record.expressionId || idx}
          className={cn(
            idx < records.length - 1 && "border-b border-border/20",
          )}
        >
          <SentenceHistoryRow record={record} />
        </div>
      ))}
    </div>
  );
}

// Re-export for convenience
export { parseSentenceFeedback };
export type { ParsedSentenceFeedback };
