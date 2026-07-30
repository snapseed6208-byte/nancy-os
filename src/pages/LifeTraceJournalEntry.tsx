import { useState, useEffect, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Trash2, Plus, X, Loader2, Sparkles, Brain, Lightbulb } from "lucide-react";
import {
  useJournalEntry,
  useUpsertJournalEntry,
  useDeleteJournalEntry,
  useTriggerLifeAnalysis,
} from "@/lib/hooks/useLifeTrace";
import type { LifeAnalysisAction, LifeAnalysisThought, LifeAnalysisPattern } from "@/lib/types";
import { cn } from "@/lib/utils";

const MOODS = ["开心", "平静", "焦虑", "疲惫", "难过", "生气", "迷茫", "有动力", "放松", "想哭"];
const MOOD_EMOJIS: Record<string, string> = {
  "开心": "😊", "平静": "😌", "焦虑": "😰", "疲惫": "😴", "难过": "😢",
  "生气": "😠", "迷茫": "😶", "有动力": "💪", "放松": "🧘", "想哭": "😭",
};
const ENERGY_LEVELS = ["energetic", "normal", "tired", "anxious", "lazy", "tried_best"];
const ENERGY_LABELS: Record<string, string> = {
  energetic: "精力充沛", normal: "正常", tired: "有点累", anxious: "焦虑", lazy: "提不起劲", tried_best: "尽力了",
};

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

const ACTION_CATEGORY_LABELS: Record<string, string> = {
  workout: "运动", work: "工作", social: "社交", learning: "学习", life: "生活", health: "健康", other: "其他",
};

const THOUGHT_CATEGORY_LABELS: Record<string, string> = {
  "self-reflection": "自我反思", planning: "计划", worry: "担忧", gratitude: "感恩", learning: "认知", other: "其他",
};

// ── AI Analysis Display ──

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
          AI 理解 {version ? `(v${version})` : ""}
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

export default function LifeTraceJournalEntry() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/life-trace/journal/:date");
  const date = params?.date || "";

  const { data: existingEntry, isLoading } = useJournalEntry(date);
  const upsertEntry = useUpsertJournalEntry();
  const deleteEntry = useDeleteJournalEntry();
  const triggerAI = useTriggerLifeAnalysis();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [energyLevel, setEnergyLevel] = useState("");
  const [weather, setWeather] = useState("");
  const [location, setLocation] = useState("");
  const [topThree, setTopThree] = useState(["", "", ""]);
  const [todos, setTodos] = useState<{ text: string; done: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiTriggered, setAiTriggered] = useState(false);

  const isFutureDate = new Date(date) > new Date(new Date().toDateString());

  useEffect(() => {
    if (existingEntry) {
      setTitle((existingEntry.title as string) || "");
      setContent((existingEntry.content as string) || "");
      setMood((existingEntry.mood as string) || "");
      setEnergyLevel((existingEntry.energy_level as string) || "");
      setWeather((existingEntry.weather as string) || "");
      setLocation((existingEntry.location as string) || "");
      try { setTopThree(JSON.parse((existingEntry.top_three as string) || "[]")); } catch { setTopThree(["", "", ""]); }
      try { setTodos(JSON.parse((existingEntry.todos as string) || "[]")); } catch { setTodos([]); }
      // Determine if AI has already been triggered
      if ((existingEntry.ai_summary as string) || (existingEntry.ai_analysis_version as string)) {
        setAiTriggered(true);
      }
    }
  }, [existingEntry]);

  const triggerAIAnalysis = useCallback(async (entryId: string) => {
    try {
      await triggerAI.mutateAsync(entryId);
      setAiTriggered(true);
    } catch {
      // AI analysis failure should not block the user
    }
  }, [triggerAI]);

  const handleSave = async () => {
    setSaving(true);
    const result = await upsertEntry.mutateAsync({
      ...(existingEntry ? { id: existingEntry.id } : {}),
      date,
      title: title || null,
      content: content || null,
      mood: mood || null,
      energy_level: energyLevel || null,
      weather: weather || null,
      location: location || null,
      top_three: JSON.stringify(topThree.filter(Boolean)),
      todos: JSON.stringify(todos),
    });
    setSaving(false);

    // Fire AI analysis asynchronously (non-blocking)
    if (result?.id && content.trim().length > 0) {
      triggerAIAnalysis(result.id as string);
    }
    navigate("/life-trace/journal");
  };

  const handleDelete = async () => {
    if (!existingEntry?.id) return;
    if (!confirm("确定要删除这天的日记吗？")) return;
    await deleteEntry.mutateAsync(existingEntry.id as string);
    navigate("/life-trace/journal");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-ink-lighter" />
      </div>
    );
  }

  const dateObj = new Date(date);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/life-trace/journal")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <p className="text-sm text-ink-lighter">Life Trace</p>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
              {existingEntry ? "编辑日记" : "新日记"}
            </h1>
          </div>
        </div>
        {existingEntry && (
          <button onClick={handleDelete} className="h-8 w-8 rounded-lg bg-accent-rose/10 flex items-center justify-center">
            <Trash2 size={14} className="text-accent-rose" />
          </button>
        )}
      </header>

      <p className="text-sm font-medium text-ink">
        {dateObj.getMonth() + 1}月{dateObj.getDate()}日 {weekdays[dateObj.getDay()]}
      </p>

      {isFutureDate && (
        <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 text-xs text-accent-rose">
          不能记录未来的日记
        </div>
      )}

      {/* Title */}
      <input
        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
        placeholder="标题 (选填)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {/* Content */}
      <textarea
        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light resize-none"
        rows={8}
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

      {/* Weather & Location */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-ink-light mb-1 block">天气</label>
          <input
            className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
            placeholder="e.g., 晴天"
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-light mb-1 block">地点</label>
          <input
            className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
            placeholder="e.g., 家"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </div>

      {/* Top 3 */}
      <div>
        <label className="text-xs font-medium text-ink-light mb-2 block">今天最重要的三件事</label>
        <div className="space-y-2">
          {topThree.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-ink-lighter w-4">{i + 1}.</span>
              <input
                className="flex-1 bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
                placeholder={`第 ${i + 1} 件事...`}
                value={t}
                onChange={(e) => {
                  const next = [...topThree];
                  next[i] = e.target.value;
                  setTopThree(next);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Todos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-ink-light">待办事项</label>
          <button
            type="button"
            onClick={() => setTodos([...todos, { text: "", done: false }])}
            className="text-xs text-sage-deep font-medium flex items-center gap-1"
          >
            <Plus size={12} /> 添加
          </button>
        </div>
        <div className="space-y-2">
          {todos.map((todo, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => {
                  const next = [...todos];
                  next[i] = { ...next[i], done: !next[i].done };
                  setTodos(next);
                }}
                className="h-4 w-4 rounded accent-sage-deep"
              />
              <input
                className="flex-1 bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
                placeholder="待办事项..."
                value={todo.text}
                onChange={(e) => {
                  const next = [...todos];
                  next[i] = { ...next[i], text: e.target.value };
                  setTodos(next);
                }}
              />
              <button
                type="button"
                onClick={() => setTodos(todos.filter((_, j) => j !== i))}
                className="shrink-0"
              >
                <X size={14} className="text-ink-lighter" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={isFutureDate || saving}
        className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {saving ? "保存中..." : "保存"}
      </button>

      {/* AI Analysis (existing entry with AI data) */}
      {existingEntry && (existingEntry.ai_summary || existingEntry.ai_analysis_version) && (
        <AIAnalysisSection entry={existingEntry} />
      )}

      {/* AI Analysis pending (saved but no AI yet) */}
      {existingEntry && !existingEntry.ai_summary && !existingEntry.ai_analysis_version && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-sage-light/50 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-sage-deep" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">AI 分析</p>
              <p className="text-xs text-ink-lighter mt-1">
                AI 可以分析这篇日记，区分你的行动和想法，识别主题和模式。
              </p>
              <button
                onClick={() => existingEntry?.id && triggerAIAnalysis(existingEntry.id as string)}
                disabled={triggerAI.isPending || aiTriggered}
                className="mt-3 flex items-center gap-2 bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors"
              >
                {triggerAI.isPending ? (
                  <><Loader2 size={12} className="animate-spin" />分析中...</>
                ) : aiTriggered ? (
                  <><Lightbulb size={12} />分析已触发</>
                ) : (
                  <><Brain size={12} />开始 AI 分析</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
