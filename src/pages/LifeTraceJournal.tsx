import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, Pen, Loader2, Calendar, RotateCcw } from "lucide-react";
import { useJournalEntries } from "@/lib/hooks/useLifeTrace";
import { getBeijingYearMonth, getBeijingDateString, formatBeijingDate, getBeijingWeekday } from "@/lib/date";
import { cn } from "@/lib/utils";

// ── Sub-components ──

function TabBar({ active, onSelect }: { active: "today" | "history"; onSelect: (t: "today" | "history") => void }) {
  return (
    <div className="flex bg-ink/5 rounded-xl p-1">
      {([
        { key: "today" as const, label: "今日记录" },
        { key: "history" as const, label: "历史记录" },
      ]).map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-semibold transition-all",
            active === key ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MonthNav({ year, month, onPrev, onNext, onToday }: {
  year: number; month: number; onPrev: () => void; onNext: () => void; onToday: () => void;
}) {
  const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const bjNow = getBeijingYearMonth();
  const isCurrentMonth = year === bjNow.year && month === bjNow.month;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button onClick={onPrev} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center">
          <ChevronLeft size={16} className="text-ink-light" />
        </button>
        <p className="text-sm font-medium text-ink min-w-[100px] text-center">{year}年{months[month - 1]}</p>
        <button onClick={onNext} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center">
          <ChevronRight size={16} className="text-ink-light" />
        </button>
      </div>
      {!isCurrentMonth && (
        <button onClick={onToday} className="flex items-center gap-1 text-xs text-sage-deep font-medium hover:underline">
          <RotateCcw size={12} />
          回到今天
        </button>
      )}
    </div>
  );
}

function JournalDateCard({ day, weekday, hasEntry, preview, hasAI, aiThemes, isToday, onClick }: {
  day: number;
  weekday: string;
  hasEntry: boolean;
  preview?: string;
  hasAI?: boolean;
  aiThemes?: string[];
  isToday: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-colors",
        isToday && "ring-2 ring-sage-deep/30",
        hasEntry
          ? "border-sage-light/50 bg-sage-light/10 hover:bg-sage-light/20"
          : "border-border bg-card hover:border-sage-light/30",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-semibold", isToday ? "text-sage-deep" : "text-ink")}>{day}</span>
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

const MOOD_EMOJIS: Record<string, string> = {
  "开心": "😊", "平静": "😌", "焦虑": "😰", "疲惫": "😴", "难过": "😢",
  "生气": "😠", "迷茫": "😶", "有动力": "💪", "放松": "🧘", "想哭": "😭",
};

// ── Page ──

export default function LifeTraceJournal() {
  const [, navigate] = useLocation();
  const bjNow = getBeijingYearMonth();
  const bjToday = getBeijingDateString();
  const [year, setYear] = useState(bjNow.year);
  const [month, setMonth] = useState(bjNow.month);

  const { data: entries, isLoading, error } = useJournalEntries({ year, month });

  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const handleToday = () => {
    setYear(bjNow.year);
    setMonth(bjNow.month);
  };

  // Build date grid and entry map
  const daysInMonth = new Date(year, month, 0).getDate();
  const entryByDate = new Map<string, Record<string, unknown>>();
  const entryList: Record<string, unknown>[] = [];
  (entries || []).forEach((e: Record<string, unknown>) => {
    entryByDate.set(e.date as string, e);
    entryList.push(e);
  });

  // Sort entry list by date descending for the list view
  entryList.sort((a, b) => String(b.date).localeCompare(String(a.date)));

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
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">日记</h1>
          </div>
        </div>
      </header>

      <TabBar active="history" onSelect={(key) => {
        if (key === "today") navigate("/life-trace/daily");
      }} />

      <MonthNav year={year} month={month} onPrev={handlePrevMonth} onNext={handleNextMonth} onToday={handleToday} />

      {error ? (
        <div className="text-center py-12">
          <p className="text-sm text-accent-rose mb-2">加载失败</p>
          <p className="text-xs text-ink-lighter">{(error as Error).message}</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={18} className="animate-spin text-ink-lighter" />
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          {dates.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {dates.map((d) => {
                const entry = entryByDate.get(d.dateStr);
                return (
                  <JournalDateCard
                    key={d.dateStr}
                    day={d.day}
                    weekday={d.weekday}
                    hasEntry={!!entry}
                    preview={entry?.ai_summary as string || entry?.title as string || (entry?.content as string)?.slice(0, 40)}
                    hasAI={!!(entry?.ai_summary)}
                    aiThemes={entry?.ai_themes as string[]}
                    isToday={d.dateStr === bjToday}
                    onClick={() => navigate(`/life-trace/journal/${d.dateStr}`)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar size={32} className="text-ink-lighter mx-auto mb-2" />
              <p className="text-xs text-ink-lighter">本月还没有日记记录</p>
            </div>
          )}

          {/* Monthly entry list */}
          {entryList.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink-lighter uppercase tracking-wider">当月记录 ({entryList.length})</p>
              <div className="space-y-2">
                {entryList.map((entry) => {
                  const dateStr = entry.date as string;
                  const mood = entry.mood as string | undefined;
                  return (
                    <button
                      key={entry.id as string}
                      onClick={() => navigate(`/life-trace/journal/${dateStr}`)}
                      className="w-full bg-card border border-border rounded-xl p-3 text-left hover:border-sage-light/40 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink">{formatBeijingDate(dateStr)}</span>
                          <span className="text-xs text-ink-lighter">{getBeijingWeekday(dateStr)}</span>
                        </div>
                        <span className="text-[10px] text-ink-lighter">
                          {entry.updated_at ? new Date(entry.updated_at as string).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {mood && MOOD_EMOJIS[mood] && (
                          <span className="text-sm shrink-0">{MOOD_EMOJIS[mood]}</span>
                        )}
                        <p className="text-xs text-ink-light line-clamp-1">
                          {(entry.title as string) || (entry.ai_summary as string) || (entry.content as string)?.slice(0, 80) || "无标题"}
                        </p>
                        {!!entry.ai_summary && (
                          <span className="text-[9px] bg-purple-100 text-purple-600 rounded-full px-1.5 py-0.5 font-medium shrink-0">AI</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
