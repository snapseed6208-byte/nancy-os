import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, RotateCcw, Sparkles, Heart } from "lucide-react";
import { useDailyReviewHistory, type DailyReview } from "@/lib/hooks/useReview";
import { getBeijingYearMonth, getBeijingDateString, formatBeijingDate, getBeijingWeekday } from "@/lib/date";
import { cn } from "@/lib/utils";

const MOOD_LABELS: Record<string, string> = {
  great: "😊 很棒", good: "😄 不错", okay: "😐 一般", down: "😔 低落", bad: "😤 糟糕",
};

function TabBar({ active, onSelect }: { active: "today" | "history"; onSelect: (t: "today" | "history") => void }) {
  return (
    <div className="flex bg-ink/5 rounded-xl p-1">
      {([
        { key: "today" as const, label: "今日复盘" },
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

export default function ReviewHistory() {
  const [, navigate] = useLocation();
  const bjNow = getBeijingYearMonth();
  const bjToday = getBeijingDateString();
  const [year, setYear] = useState(bjNow.year);
  const [month, setMonth] = useState(bjNow.month);

  const { data: reviews, isLoading, error } = useDailyReviewHistory({ year, month });

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

  const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const isCurrentMonth = year === bjNow.year && month === bjNow.month;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/review")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div>
          <p className="text-sm text-ink-lighter">数据复盘</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Review OS</h1>
        </div>
      </header>

      <TabBar active="history" onSelect={(key) => {
        if (key === "today") navigate("/review");
      }} />

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={handlePrevMonth} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center">
            <ChevronLeft size={16} className="text-ink-light" />
          </button>
          <p className="text-sm font-medium text-ink min-w-[100px] text-center">{year}年{months[month - 1]}</p>
          <button onClick={handleNextMonth} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center">
            <ChevronRight size={16} className="text-ink-light" />
          </button>
        </div>
        {!isCurrentMonth && (
          <button onClick={handleToday} className="flex items-center gap-1 text-xs text-sage-deep font-medium hover:underline">
            <RotateCcw size={12} />
            回到今天
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <p className="text-sm text-accent-rose mb-2">加载失败</p>
          <p className="text-xs text-ink-lighter">{(error as Error).message}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={18} className="animate-spin text-ink-lighter" />
        </div>
      )}

      {/* Review list */}
      {!isLoading && !error && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-lighter uppercase tracking-wider">
            当月记录 ({reviews?.length ?? 0})
          </p>
          {reviews && reviews.length > 0 ? (
            reviews.map((r: DailyReview) => (
              <button
                key={r.id}
                onClick={() => navigate(`/review/date/${r.date}`)}
                className={cn(
                  "w-full bg-card border rounded-xl p-3.5 text-left hover:border-sage-light/40 transition-colors",
                  r.date === bjToday ? "border-sage-light/50 bg-sage-light/5 ring-1 ring-sage-light/20" : "border-border",
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-semibold", r.date === bjToday ? "text-sage-deep" : "text-ink")}>
                      {formatBeijingDate(r.date)}
                    </span>
                    <span className="text-xs text-ink-lighter">{getBeijingWeekday(r.date)}</span>
                    {r.date === bjToday && (
                      <span className="text-[9px] bg-sage-light/50 text-sage-deep rounded-full px-1.5 py-0.5 font-medium">今天</span>
                    )}
                  </div>
                  {r.mood && MOOD_LABELS[r.mood] && (
                    <span className="text-xs text-ink-light">{MOOD_LABELS[r.mood]}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.q1_what_done && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5">已完成复盘</span>
                  )}
                  {r.ai_growth_insight && (
                    <span className="text-[10px] bg-purple-50 text-purple-600 rounded-full px-2 py-0.5 flex items-center gap-0.5">
                      <Sparkles size={9} />AI 洞察
                    </span>
                  )}
                  {r.daily_log && (
                    <span className="text-[10px] bg-ink/5 text-ink-light rounded-full px-2 py-0.5">日志</span>
                  )}
                </div>
                {r.q1_what_done && (
                  <p className="text-xs text-ink-light mt-1.5 line-clamp-2 leading-relaxed">{r.q1_what_done}</p>
                )}
              </button>
            ))
          ) : (
            <div className="text-center py-12">
              <Heart size={32} className="text-ink-lighter mx-auto mb-2 opacity-30" />
              <p className="text-xs text-ink-lighter">本月还没有复盘记录</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
