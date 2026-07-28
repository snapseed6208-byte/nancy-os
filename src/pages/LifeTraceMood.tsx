import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { useMoodRecords, useCreateMoodRecord, useDeleteMoodRecord } from "@/lib/hooks/useLifeTrace";
import { cn } from "@/lib/utils";

const MOODS = ["开心", "平静", "焦虑", "疲惫", "难过", "生气", "迷茫", "有动力", "放松", "想哭"];
const MOOD_EMOJIS: Record<string, string> = {
  "开心": "😊", "平静": "😌", "焦虑": "😰", "疲惫": "😴", "难过": "😢",
  "生气": "😠", "迷茫": "😶", "有动力": "💪", "放松": "🧘", "想哭": "😭",
};
const TIMES_OF_DAY = [
  { value: "morning", label: "早晨" },
  { value: "afternoon", label: "下午" },
  { value: "evening", label: "傍晚" },
  { value: "night", label: "夜晚" },
];

// ── Sub-components ──

function MoodButton({ mood, selected, onClick }: { mood: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors min-w-[64px]",
        selected ? "border-sage-light bg-sage-light/30 text-sage-deep" : "border-border text-ink-light hover:border-sage-light/50",
      )}
    >
      <span className="text-xl">{MOOD_EMOJIS[mood]}</span>
      <span className="text-[10px]">{mood}</span>
    </button>
  );
}

function IntensityDot({ level, selected, onClick }: { level: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 w-8 rounded-full text-xs font-medium transition-colors",
        selected
          ? level >= 4 ? "bg-accent-rose/20 text-accent-rose" : "bg-sage-light text-sage-deep"
          : "bg-ink/5 text-ink-light hover:bg-ink/10",
      )}
    >
      {level}
    </button>
  );
}

// ── Page ──

export default function LifeTraceMood() {
  const [, navigate] = useLocation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: records, isLoading } = useMoodRecords({ year, month });
  const createMood = useCreateMoodRecord();
  const deleteMood = useDeleteMoodRecord();

  // Check-in form state
  const [formMood, setFormMood] = useState("");
  const [intensity, setIntensity] = useState(3);
  const [timeOfDay, setTimeOfDay] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("");
  const [energyLevel, setEnergyLevel] = useState(3);
  const [notes, setNotes] = useState("");
  const [formExpanded, setFormExpanded] = useState(false);

  const handleSubmit = async () => {
    if (!formMood) return;
    await createMood.mutateAsync({
      date: now.toISOString().split("T")[0],
      mood: formMood,
      intensity,
      time_of_day: timeOfDay || null,
      trigger_event: triggerEvent || null,
      energy_level: energyLevel,
      notes: notes || null,
    });
    setFormMood("");
    setIntensity(3);
    setTimeOfDay("");
    setTriggerEvent("");
    setEnergyLevel(3);
    setNotes("");
    setFormExpanded(false);
  };

  const handleDelete = async (id: string) => {
    await deleteMood.mutateAsync(id);
  };

  // Week navigation
  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const handleNextMonth = () => {
    const isCurrentOrFuture = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
    if (!isCurrentOrFuture) {
      if (month === 12) { setMonth(1); setYear(year + 1); }
      else setMonth(month + 1);
    }
  };

  const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

  // Mood distribution
  const dist: Record<string, number> = {};
  (records || []).forEach((r: Record<string, unknown>) => {
    const m = r.mood as string;
    dist[m] = (dist[m] || 0) + 1;
  });
  const maxCount = Math.max(1, ...Object.values(dist));

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/life-trace")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div>
          <p className="text-sm text-ink-lighter">Life Trace</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">心情记录</h1>
        </div>
      </header>

      {/* Check-in form */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
        <p className="text-xs font-medium text-ink-light">记录此刻心情</p>

        {/* Mood grid */}
        <div className="grid grid-cols-5 gap-2">
          {MOODS.map((m) => (
            <MoodButton key={m} mood={m} selected={formMood === m} onClick={() => setFormMood(formMood === m ? "" : m)} />
          ))}
        </div>

        {/* Intensity */}
        <div>
          <p className="text-xs text-ink-lighter mb-2">强度: {intensity}</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((l) => (
              <IntensityDot key={l} level={l} selected={intensity === l} onClick={() => setIntensity(l)} />
            ))}
          </div>
        </div>

        {/* Time of day */}
        <div>
          <p className="text-xs text-ink-lighter mb-2">时段</p>
          <div className="flex gap-2">
            {TIMES_OF_DAY.map((t) => (
              <button
                key={t.value}
                onClick={() => setTimeOfDay(timeOfDay === t.value ? "" : t.value)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs transition-colors",
                  timeOfDay === t.value ? "border-sage-light bg-sage-light/30 text-sage-deep" : "border-border text-ink-light hover:border-sage-light/50",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Expand: trigger, energy, notes */}
        {formExpanded && (
          <>
            <div>
              <p className="text-xs text-ink-lighter mb-1">触发事件 (选填)</p>
              <input
                className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
                placeholder="是什么触发了这种心情？"
                value={triggerEvent}
                onChange={(e) => setTriggerEvent(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-ink-lighter mb-2">精力水平: {energyLevel}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((l) => (
                  <IntensityDot key={l} level={l} selected={energyLevel === l} onClick={() => setEnergyLevel(l)} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-ink-lighter mb-1">备注</p>
              <textarea
                className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light resize-none"
                rows={2}
                placeholder="额外的想法..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setFormExpanded(!formExpanded)}
            className="flex-1 bg-ink/5 text-ink-light rounded-xl py-2 text-xs font-medium"
          >
            {formExpanded ? "收起" : "更多选项"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formMood || createMood.isPending}
            className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2 text-xs font-semibold disabled:opacity-50"
          >
            {createMood.isPending ? "保存中..." : "记录"}
          </button>
        </div>
      </div>

      {/* Mood timeline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-ink-light">历史记录</p>
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="h-7 w-7 rounded-lg bg-ink/5 flex items-center justify-center">
              <ChevronLeft size={14} className="text-ink-light" />
            </button>
            <span className="text-xs text-ink-light min-w-[80px] text-center">
              {year}.{months[month - 1]}
            </span>
            <button onClick={handleNextMonth} className="h-7 w-7 rounded-lg bg-ink/5 flex items-center justify-center">
              <ChevronRight size={14} className="text-ink-light" />
            </button>
          </div>
        </div>

        {/* Mood distribution bars */}
        {records && records.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-3 mb-3 space-y-1">
            {Object.entries(dist).sort(([, a], [, b]) => b - a).map(([m, count]) => (
              <div key={m} className="flex items-center gap-2">
                <span className="text-xs w-12 shrink-0 text-ink-light">{MOOD_EMOJIS[m]} {m}</span>
                <div className="flex-1 h-2 bg-ink/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sage-light rounded-full transition-all"
                    style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-ink-lighter w-5 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Timeline items */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-ink-lighter" />
          </div>
        ) : !records || records.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-3xl block mb-2">🎭</span>
            <p className="text-xs text-ink-lighter">还没有心情记录</p>
            <p className="text-xs text-ink-lighter mt-1">记录你的第一份心情吧</p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((r: Record<string, unknown>) => {
              const timeLabels: Record<string, string> = { morning: "早晨", afternoon: "下午", evening: "傍晚", night: "夜晚" };
              return (
                <div key={r.id as string} className="bg-card rounded-2xl border border-border p-3 flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">{MOOD_EMOJIS[r.mood as string] || "😶"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{r.mood as string}</span>
                      <span className="text-xs text-ink-lighter">强度 {r.intensity as number}/5</span>
                      {r.time_of_day ? (
                        <span className="text-xs text-ink-lighter">{timeLabels[r.time_of_day as string] || (r.time_of_day as string)}</span>
                      ) : null}
                    </div>
                    {r.trigger_event ? <p className="text-xs text-ink-light mt-1 truncate">{r.trigger_event as string}</p> : null}
                    <p className="text-xs text-ink-lighter mt-1">
                      {new Date(r.created_at as string).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(r.id as string)} className="shrink-0">
                    <Trash2 size={12} className="text-ink-lighter hover:text-accent-rose" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
