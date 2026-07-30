import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Brain, Sparkles, Send } from "lucide-react";
import {
  useJournalEntry,
  useUpsertJournalEntry,
  useTriggerLifeAnalysis,
} from "@/lib/hooks/useLifeTrace";
import type { LifeAnalysisAction, LifeAnalysisThought, LifeAnalysisPattern } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Constants ──

const MOODS = ["开心", "平静", "焦虑", "疲惫", "难过", "生气", "迷茫", "有动力", "放松", "想哭"];
const MOOD_EMOJIS: Record<string, string> = {
  "开心": "😊", "平静": "😌", "焦虑": "😰", "疲惫": "😴", "难过": "😢",
  "生气": "😠", "迷茫": "😶", "有动力": "💪", "放松": "🧘", "想哭": "😭",
};
const ENERGY_LEVELS = ["energetic", "normal", "tired", "anxious", "lazy", "tried_best"];
const ENERGY_LABELS: Record<string, string> = {
  energetic: "精力充沛", normal: "正常", tired: "有点累", anxious: "焦虑", lazy: "提不起劲", tried_best: "尽力了",
};
const ACTION_CATEGORY_LABELS: Record<string, string> = {
  workout: "运动", work: "工作", social: "社交", learning: "学习", life: "生活", health: "健康", other: "其他",
};
const THOUGHT_CATEGORY_LABELS: Record<string, string> = {
  "self-reflection": "自我反思", planning: "计划", worry: "担忧", gratitude: "感恩", learning: "认知", other: "其他",
};

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Sub-components ──

function MoodChip({ mood, selected, onClick }: { mood: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-1.5 text-xs transition-colors",
        selected ? "border-sage-light bg-sage-light/30 text-sage-deep" : "border-border text-ink-light hover:border-sage-light/50",
      )}
    >
      {MOOD_EMOJIS[mood]} {mood}
    </button>
  );
}

function EnergyChip({ level, selected, onClick }: { level: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-1.5 text-xs transition-colors",
        selected ? "border-sage-light bg-sage-light/30 text-sage-deep" : "border-border text-ink-light hover:border-sage-light/50",
      )}
    >
      {ENERGY_LABELS[level]}
    </button>
  );
}

function AIAnalysisSection({ entry }: { entry: Record<string, unknown> }) {
  const summary = entry.ai_summary as string | undefined;
  const emotionAnalysis = entry.ai_emotion_analysis as string | undefined;
  const actions = (entry.ai_actions as LifeAnalysisAction[]) || [];
  const thoughts = (entry.ai_thoughts as LifeAnalysisThought[]) || [];
  const themes = (entry.ai_themes as string[]) || [];
  const events = (entry.ai_events as string[]) || [];
  const patterns = (entry.ai_patterns as LifeAnalysisPattern[]) || [];
  const version = entry.ai_analysis_version as string | undefined;

  if (!summary && !emotionAnalysis && !actions.length && !thoughts.length) return null;

  return (
    <div className="bg-gradient-to-br from-sage-light/5 to-white border border-sage-light/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Brain size={14} className="text-sage-deep" />
        <span className="text-xs font-semibold text-sage-deep">
          AI 生活理解 {version ? `· ${version}` : ""}
        </span>
      </div>

      {/* Summary */}
      {summary && (
        <p className="text-sm text-ink font-medium leading-relaxed">{summary}</p>
      )}

      {/* Emotion */}
      {emotionAnalysis && (
        <div className="bg-sage-light/10 rounded-xl p-3">
          <p className="text-xs text-ink-light leading-relaxed">{emotionAnalysis}</p>
        </div>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider mb-1.5">行动</p>
          <div className="space-y-1">
            {actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-ink-light">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>{a.action}</span>
                <span className="text-[10px] text-ink-lighter bg-ink/5 rounded px-1.5 py-0.5">
                  {ACTION_CATEGORY_LABELS[a.category] || a.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thoughts */}
      {thoughts.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider mb-1.5">想法</p>
          <div className="space-y-1">
            {thoughts.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-ink-light">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
                <span>{t.thought}</span>
                <span className="text-[10px] text-ink-lighter bg-ink/5 rounded px-1.5 py-0.5">
                  {THOUGHT_CATEGORY_LABELS[t.category] || t.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Themes & Events */}
      {(themes.length > 0 || events.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {themes.map((t, i) => (
            <span key={`theme-${i}`} className="text-[10px] bg-sage-light/30 text-sage-deep rounded-full px-2 py-0.5 font-medium">
              #{t}
            </span>
          ))}
          {events.map((e, i) => (
            <span key={`event-${i}`} className="text-[10px] bg-accent-sky/10 text-accent-sky rounded-full px-2 py-0.5">
              {e}
            </span>
          ))}
        </div>
      )}

      {/* Patterns */}
      {patterns.length > 0 && (
        <div className="border-t border-sage-light/20 pt-2">
          <p className="text-[10px] font-semibold text-ink-lighter mb-1">重复模式</p>
          {patterns.map((p, i) => (
            <p key={i} className="text-[11px] text-ink-light">
              {p.pattern}
              <span className="text-[10px] text-ink-lighter ml-1">
                (置信度 {Math.round(p.confidence * 100)}%)
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──

export default function LifeTraceDailyRecord() {
  const [, navigate] = useLocation();
  const date = today();
  const dateObj = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  const { data: existingEntry, isLoading } = useJournalEntry(date);
  const upsertEntry = useUpsertJournalEntry();
  const triggerAI = useTriggerLifeAnalysis();

  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [energyLevel, setEnergyLevel] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiState, setAiState] = useState<"idle" | "analyzing" | "done" | "error">("idle");
  const [aiEntry, setAiEntry] = useState<Record<string, unknown> | null>(null);

  // Load existing entry
  useEffect(() => {
    if (existingEntry) {
      setContent((existingEntry.content as string) || "");
      setMood((existingEntry.mood as string) || "");
      setEnergyLevel((existingEntry.energy_level as string) || "");
      if ((existingEntry.ai_summary as string) || (existingEntry.ai_analysis_version as string)) {
        setAiState("done");
        setAiEntry(existingEntry);
      }
    }
  }, [existingEntry]);

  const triggerAIAnalysis = useCallback(async (entryId: string) => {
    setAiState("analyzing");
    try {
      await triggerAI.mutateAsync(entryId);
      setAiState("done");
      // Re-fetch happens via query invalidation from the hook
      setAiEntry(existingEntry); // will be replaced by the query refetch
    } catch {
      setAiState("error");
    }
  }, [triggerAI, existingEntry]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      date,
      content: content.trim(),
      mood: mood || null,
      energy_level: energyLevel || null,
    };
    if (existingEntry?.id) payload.id = existingEntry.id;

    const result = await upsertEntry.mutateAsync(payload);
    setSaving(false);

    if (result?.id) {
      triggerAIAnalysis(result.id as string);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-ink-lighter" />
      </div>
    );
  }

  const hasAIResults = aiState === "done" && existingEntry && (
    existingEntry.ai_summary || existingEntry.ai_analysis_version
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/life-trace")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div>
          <p className="text-sm text-ink-lighter">Life Trace</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">今日生活记录</h1>
        </div>
      </header>

      <p className="text-sm font-medium text-ink">
        {dateObj.getMonth() + 1}月{dateObj.getDate()}日 {weekdays[dateObj.getDay()]}
      </p>

      {/* Content */}
      <textarea
        className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light resize-none"
        rows={10}
        placeholder="今天发生了什么？有什么想法和感受？"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      {/* Mood */}
      <div>
        <label className="text-xs font-medium text-ink-light mb-2 block">心情</label>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <MoodChip key={m} mood={m} selected={mood === m} onClick={() => setMood(mood === m ? "" : m)} />
          ))}
        </div>
      </div>

      {/* Energy */}
      <div>
        <label className="text-xs font-medium text-ink-light mb-2 block">精力状态</label>
        <div className="flex flex-wrap gap-2">
          {ENERGY_LEVELS.map((l) => (
            <EnergyChip key={l} level={l} selected={energyLevel === l} onClick={() => setEnergyLevel(energyLevel === l ? "" : l)} />
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || aiState === "analyzing"}
        className="w-full bg-sage-light text-sage-deep rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? (
          <><Loader2 size={14} className="animate-spin" />保存中...</>
        ) : (
          <><Send size={14} />保存</>
        )}
      </button>

      {/* AI Analysis: loading */}
      {aiState === "analyzing" && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-sage-deep shrink-0" />
            <div>
              <p className="text-sm font-medium text-ink">AI 正在理解你的记录...</p>
              <p className="text-xs text-ink-lighter mt-0.5">分析行动、想法和主题</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis: error */}
      {aiState === "error" && (
        <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-2xl p-4">
          <p className="text-xs text-accent-rose">AI 分析失败，请稍后重试</p>
        </div>
      )}

      {/* AI Analysis: results */}
      {hasAIResults && existingEntry && (
        <AIAnalysisSection entry={existingEntry} />
      )}

      {/* AI Analysis: re-trigger available for existing unanalyzed entries */}
      {existingEntry && !existingEntry.ai_summary && !existingEntry.ai_analysis_version && aiState === "idle" && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-sage-light/50 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-sage-deep" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">AI 生活理解</p>
              <p className="text-xs text-ink-lighter mt-1">
                分析你的记录，区分行动和想法，识别主题和模式。
              </p>
              <button
                onClick={() => existingEntry?.id && triggerAIAnalysis(existingEntry.id as string)}
                className="mt-3 flex items-center gap-2 bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-xs font-semibold hover:bg-sage-light/80 transition-colors"
              >
                <Brain size={12} />开始 AI 分析
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
