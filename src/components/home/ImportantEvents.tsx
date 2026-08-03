import { useState } from "react";
import { Calendar, Check, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEventTypeIcon, getEventTypeLabel } from "@/lib/hooks/useImportantEvent";
import type { ImportantEvent, ImportantEventType } from "@/lib/hooks/useImportantEvent";

const EVENT_TYPES: { value: ImportantEventType; label: string }[] = [
  { value: "interview", label: "面试" },
  { value: "exam", label: "考试" },
  { value: "deadline", label: "截止日期" },
  { value: "appointment", label: "预约" },
  { value: "travel", label: "旅行" },
  { value: "other", label: "其他" },
];

interface ImportantEventsProps {
  events?: ImportantEvent[] | null;
  onToggle?: (id: string, isCompleted: boolean) => void;
  onCreate?: (input: {
    title: string;
    event_date: string;
    event_time?: string;
    event_type?: ImportantEventType;
    description?: string;
    priority?: "high" | "medium" | "low";
  }) => void;
  isCreating?: boolean;
}

function getCountdown(dateStr: string): { label: string; urgent: boolean } {
  const now = new Date();
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.ceil((target.getTime() - now.getTime()) / 86400000);

  if (diff < 0) return { label: "已过期", urgent: true };
  if (diff === 0) return { label: "今天", urgent: true };
  if (diff === 1) return { label: "明天", urgent: false };
  if (diff <= 3) return { label: `${diff} 天后`, urgent: true };
  if (diff <= 7) return { label: `${diff} 天后`, urgent: false };
  return { label: `${Math.floor(diff / 7)} 周后`, urgent: false };
}

export function ImportantEvents({ events, onToggle, onCreate, isCreating }: ImportantEventsProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    event_date: new Date().toISOString().split("T")[0],
    event_time: "",
    event_type: "other" as ImportantEventType,
    priority: "medium" as "high" | "medium" | "low",
    description: "",
  });

  const resetForm = () => {
    setForm({
      title: "",
      event_date: new Date().toISOString().split("T")[0],
      event_time: "",
      event_type: "other",
      priority: "medium",
      description: "",
    });
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onCreate?.({
      title: form.title.trim(),
      event_date: form.event_date,
      event_time: form.event_time || undefined,
      event_type: form.event_type,
      description: form.description || undefined,
      priority: form.priority,
    });
    resetForm();
  };

  const hasEvents = events && events.length > 0;

  return (
    <section className={cn(
      "bg-gradient-to-br from-accent-warm/[0.03] to-white border border-accent-warm/10 rounded-2xl",
      hasEvents ? "p-4" : "p-5",
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-accent-warm" />
        <h2 className="text-[13px] font-semibold text-ink">重要安排</h2>
        {hasEvents && <span className="text-[10px] text-ink-lighter ml-auto">{events!.length} 项</span>}
      </div>

      {/* Empty state */}
      {!hasEvents && !showForm && (
        <div className="text-center py-3">
          <p className="text-xs text-ink-lighter mb-3">记录即将发生的重要事项</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-warm/10 text-accent-warm text-xs font-medium hover:bg-accent-warm/20 transition-colors active:scale-95"
          >
            <Plus size={12} />添加重要安排
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white/60 rounded-xl p-3 border border-border mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-ink">新建重要安排</span>
            <button onClick={resetForm} className="text-ink-lighter hover:text-ink-light">
              <X size={14} />
            </button>
          </div>
          <input
            type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="事项名称" autoFocus
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-xs text-ink outline-none focus:border-accent-warm/50"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date" value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-xs text-ink outline-none focus:border-accent-warm/50"
            />
            <input
              type="time" value={form.event_time}
              onChange={(e) => setForm({ ...form, event_time: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-xs text-ink outline-none focus:border-accent-warm/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.event_type}
              onChange={(e) => setForm({ ...form, event_type: e.target.value as ImportantEventType })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-xs text-ink outline-none focus:border-accent-warm/50"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as "high" | "medium" | "low" })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-xs text-ink outline-none focus:border-accent-warm/50"
            >
              <option value="high">高优先</option>
              <option value="medium">中优先</option>
              <option value="low">低优先</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!form.title.trim() || isCreating}
              className="flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-lg bg-accent-warm text-white text-xs font-medium hover:bg-accent-warm/90 transition-colors active:scale-95 disabled:opacity-50"
            >
              {isCreating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              添加
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-lg border border-border text-ink-lighter text-xs hover:bg-ink/5 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Event list */}
      {hasEvents && (
        <div className="space-y-1">
          {events!.slice(0, 5).map((event) => {
            const cd = getCountdown(event.event_date);
            return (
              <button
                key={event.id}
                onClick={() => onToggle?.(event.id, !event.is_completed)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors text-left",
                  "hover:bg-white/60",
                  event.is_completed && "opacity-50",
                )}
              >
                <span className="text-base shrink-0">{getEventTypeIcon(event.event_type)}</span>
                <div className="flex-1 min-w-0">
                  <span className={cn("text-xs text-ink truncate", event.is_completed && "line-through")}>
                    {event.title}
                  </span>
                  {event.event_time && (
                    <span className="text-[10px] text-ink-lighter ml-1.5">{event.event_time.slice(0, 5)}</span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium shrink-0",
                  cd.urgent ? "text-accent-rose" : "text-ink-lighter",
                )}>
                  {cd.label}
                </span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                  event.priority === "high" ? "bg-accent-rose/10 text-accent-rose"
                    : event.priority === "medium" ? "bg-amber-50 text-amber-600"
                    : "bg-ink/5 text-ink-lighter",
                )}>
                  {event.priority === "high" ? "高" : event.priority === "medium" ? "中" : "低"}
                </span>
                {event.is_completed && <Check size={12} className="text-emerald-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Add button when has events */}
      {hasEvents && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] text-ink-lighter hover:text-ink-light hover:bg-white/40 transition-colors"
        >
          <Plus size={12} />添加
        </button>
      )}
    </section>
  );
}
