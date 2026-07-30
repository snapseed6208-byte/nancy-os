import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, Pen, Loader2, Calendar } from "lucide-react";
import { useJournalEntries } from "@/lib/hooks/useLifeTrace";

// ── Sub-components ──

function MonthNav({ year, month, onPrev, onNext }: {
  year: number; month: number; onPrev: () => void; onNext: () => void;
}) {
  const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  return (
    <div className="flex items-center justify-between">
      <button onClick={onPrev} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center">
        <ChevronLeft size={16} className="text-ink-light" />
      </button>
      <p className="text-sm font-medium text-ink">{year}年{months[month - 1]}</p>
      <button onClick={onNext} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center">
        <ChevronRight size={16} className="text-ink-light" />
      </button>
    </div>
  );
}

function JournalDateCard({ day, weekday, hasEntry, preview, hasAI, aiThemes, onClick }: {
  day: number;
  weekday: string;
  hasEntry: boolean;
  preview?: string;
  hasAI?: boolean;
  aiThemes?: string[];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        hasEntry
          ? "border-sage-light/50 bg-sage-light/10 hover:bg-sage-light/20"
          : "border-border bg-card hover:border-sage-light/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-ink">{day}</span>
          {hasAI && (
            <span className="text-[9px] bg-purple-100 text-purple-600 rounded-full px-1.5 py-0.5 font-medium">AI</span>
          )}
        </div>
        <span className="text-xs text-ink-lighter">{weekday}</span>
      </div>
      {hasEntry && preview ? (
        <p className="text-xs text-ink-light mt-1 line-clamp-2">{preview}</p>
      ) : !hasEntry ? (
        <p className="text-xs text-ink-lighter mt-1 flex items-center gap-1">
          <Pen size={10} />
          写日记
        </p>
      ) : null}
      {aiThemes && aiThemes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {aiThemes.slice(0, 2).map((t, i) => (
            <span key={i} className="text-[9px] bg-sage-light/20 text-sage-deep rounded-full px-1.5 py-0.5">
              #{t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ── Page ──

export default function LifeTraceJournal() {
  const [, navigate] = useLocation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: entries, isLoading } = useJournalEntries({ year, month });

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

  // Build date grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const entryByDate = new Map<string, { title?: string; content?: string; ai_summary?: string; ai_themes?: string[] }>();
  (entries || []).forEach((e: Record<string, unknown>) => {
    entryByDate.set(e.date as string, {
      title: e.title as string,
      content: e.content as string,
      ai_summary: e.ai_summary as string,
      ai_themes: e.ai_themes as string[],
    });
  });

  const dates: { day: number; dateStr: string; weekday: string }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = new Date(year, month - 1, d).getDay();
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    dates.push({ day: d, dateStr, weekday: weekdays[dow] });
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/life-trace")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <p className="text-sm text-ink-lighter">Life Trace</p>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">历史记录</h1>
          </div>
        </div>
        <button
          onClick={() => navigate("/life-trace/daily")}
          className="flex items-center gap-1.5 bg-sage-light text-sage-deep rounded-xl px-3 py-2 text-sm font-medium"
        >
          <Pen size={16} />
          记录今天
        </button>
      </header>

      <MonthNav year={year} month={month} onPrev={handlePrevMonth} onNext={handleNextMonth} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={18} className="animate-spin text-ink-lighter" />
        </div>
      ) : dates.length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={32} className="text-ink-lighter mx-auto mb-2" />
          <p className="text-xs text-ink-lighter">本月还没有日记记录</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {dates.map((d) => {
            const entry = entryByDate.get(d.dateStr);
            return (
              <JournalDateCard
                key={d.dateStr}
                day={d.day}
                weekday={d.weekday}
                hasEntry={!!entry}
                preview={entry?.ai_summary || entry?.title || entry?.content?.slice(0, 40)}
                hasAI={!!entry?.ai_summary}
                aiThemes={entry?.ai_themes}
                onClick={() => navigate(`/life-trace/journal/${d.dateStr}`)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
