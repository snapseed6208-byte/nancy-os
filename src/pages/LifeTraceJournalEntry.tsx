import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Trash2, Plus, X, Loader2 } from "lucide-react";
import { useJournalEntry, useUpsertJournalEntry, useDeleteJournalEntry } from "@/lib/hooks/useLifeTrace";
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

// ── Page ──

export default function LifeTraceJournalEntry() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/life-trace/journal/:date");
  const date = params?.date || "";

  const { data: existingEntry, isLoading } = useJournalEntry(date);
  const upsertEntry = useUpsertJournalEntry();
  const deleteEntry = useDeleteJournalEntry();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [energyLevel, setEnergyLevel] = useState("");
  const [weather, setWeather] = useState("");
  const [location, setLocation] = useState("");
  const [topThree, setTopThree] = useState(["", "", ""]);
  const [todos, setTodos] = useState<{ text: string; done: boolean }[]>([]);
  const [saving, setSaving] = useState(false);

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
    }
  }, [existingEntry]);

  const handleSave = async () => {
    setSaving(true);
    await upsertEntry.mutateAsync({
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
    </div>
  );
}
