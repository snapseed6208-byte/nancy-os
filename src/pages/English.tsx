import { useLocation } from "wouter";
import {
  ArrowRight, BookOpen, ChevronRight, GraduationCap, Library,
  Mic, Sparkles, TrendingUp,
} from "lucide-react";
import { useSpeakingSessions } from "@/lib/hooks/useEnglish";
import { useTodayLearnSession, useTodayReviewStatus, isLearnItemFinished } from "@/lib/hooks/useReviewSession";
import { useReaderBooks } from "@/lib/hooks/useEnglishReader";
import { cn } from "@/lib/utils";

const isToday = (value?: string | null) => Boolean(value && new Date(value).toDateString() === new Date().toDateString());

export default function English() {
  const [, navigate] = useLocation();
  const learnSessionQuery = useTodayLearnSession();
  const reviewProgressQuery = useTodayReviewStatus();
  const speakingQuery = useSpeakingSessions();
  const booksQuery = useReaderBooks();

  const learnItems = learnSessionQuery.data?.items ?? [];
  const learnedToday = learnItems.filter(isLearnItemFinished).length;
  const hasUnfinishedLearn = Boolean(learnSessionQuery.data?.session && learnedToday < learnItems.length);
  const speakingToday = (speakingQuery.data ?? []).filter((session) => isToday(session.created_at)).length;
  const books = booksQuery.data ?? [];
  const readToday = books.some((book) => isToday(book.reading_progress?.updated_at));
  const reviewProgress = reviewProgressQuery.data;
  const dueTotal = reviewProgress?.total ?? 0;
  const reviewCompleted = reviewProgress?.completed ?? 0;
  const reviewRemaining = reviewProgress?.remaining ?? 0;
  const reviewWasScheduled = dueTotal > 0 || Boolean(reviewProgress?.hasSession);
  const reviewDayComplete = reviewProgress?.dayComplete ?? false;

  const nextAction = hasUnfinishedLearn
    ? { label: "继续今日学习", path: "/english/learn" }
    : reviewProgressQuery.isError
      ? { label: "选择学习内容", path: "/english/expressions" }
      : reviewRemaining > 0
      ? { label: reviewCompleted > 0 ? `继续复习 ${reviewRemaining} 条` : `开始复习 ${reviewRemaining} 条`, path: "/english/review" }
      : reviewWasScheduled && !reviewDayComplete
        ? { label: "继续完成复习", path: "/english/review" }
      : speakingQuery.isError
        ? { label: "选择学习内容", path: "/english/expressions" }
        : speakingToday === 0
        ? { label: "完成今日口语", path: "/english/speaking/practice" }
        : !booksQuery.isError && !readToday && books.length > 0
          ? { label: "继续阅读", path: "/english/reading" }
        : null;

  return (
    <div className="space-y-6 min-w-0">
      <header>
        <p className="text-xs text-ink-lighter">English OS</p>
        <h1 className="text-2xl font-semibold mt-0.5">英语学习</h1>
        <p className="text-sm text-ink-light mt-1">学习 · 复习 · 口语 · 阅读</p>
      </header>

      <section aria-labelledby="today-english" className="rounded-lg border border-border bg-sage-light/35 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-sage-deep" />
          <h2 id="today-english" className="text-sm font-semibold text-ink">今日英语</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 mt-4">
          <TodayMetric label="新学" value={learnSessionQuery.isError ? "--" : learnedToday} />
          <TodayMetric label="复习" value={reviewProgressQuery.isError ? "--" : `${reviewCompleted} / ${dueTotal}`} />
          <TodayMetric label="口语" value={speakingQuery.isError ? "--" : `${speakingToday}/1`} />
          <TodayMetric label="阅读" value={booksQuery.isError ? "--" : readToday ? "已阅读" : "未开始"} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-sage/20 pt-4">
          <p className="text-xs text-ink-lighter min-w-0">
            {reviewDayComplete ? "今日复习已完成" : reviewWasScheduled && reviewRemaining === 0 ? "继续完成其他训练模式" : reviewRemaining > 0 ? `还有 ${reviewRemaining} 条待复习` : "按今日状态继续下一项"}
          </p>
          {nextAction ? (
            <button type="button" onClick={() => navigate(nextAction.path)} className="shrink-0 h-10 px-4 rounded-lg bg-sage-deep text-white text-sm font-semibold inline-flex items-center gap-2">
              {nextAction.label}<ArrowRight size={15} />
            </button>
          ) : (
            <span className="shrink-0 text-sm font-medium text-sage-deep">{reviewDayComplete ? "复习完成" : "今日已完成"}</span>
          )}
        </div>
      </section>

      <section aria-labelledby="learning-centers">
        <div className="mb-3">
          <p className="text-xs text-ink-lighter">Learning hubs</p>
          <h2 id="learning-centers" className="text-lg font-semibold mt-0.5">学习中心</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CenterCard icon={Library} title="专八词汇" description="PDF 导入 · 熟词生义 · 词汇复习" tone="sage" onClick={() => navigate("/english/vocabulary")} />
          <CenterCard icon={GraduationCap} title="表达学习" description="学表达 · SRS 复习 · 表达库" tone="sage" onClick={() => navigate("/english/expressions")} />
          <CenterCard icon={Mic} title="英语口语" description="对话 · 主题表达 · AI 纠错" tone="rose" onClick={() => navigate("/english/speaking")} />
          <CenterCard icon={BookOpen} title="英文阅读" description="EPUB · 原著阅读 · 表达摘录" tone="blue" onClick={() => navigate("/english/reading")} />
          <CenterCard icon={TrendingUp} title="学习分析" description="历史 · 趋势 · AI 总结" tone="amber" onClick={() => navigate("/english/progress")} />
        </div>
      </section>
    </div>
  );
}

function TodayMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 pr-2">
      <p className="text-lg font-semibold text-ink truncate">{value}</p>
      <p className="text-[11px] text-ink-lighter mt-0.5">{label}</p>
    </div>
  );
}

function CenterCard({ icon: Icon, title, description, tone, onClick }: {
  icon: typeof Library;
  title: string;
  description: string;
  tone: "sage" | "rose" | "blue" | "amber";
  onClick: () => void;
}) {
  const tones = {
    sage: "bg-sage-light text-sage-deep",
    rose: "bg-rose-50 text-rose-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <button type="button" onClick={onClick} className="min-w-0 rounded-lg border border-border bg-card p-4 text-left hover:border-ink/20 transition-colors flex items-center gap-3">
      <span className={cn("h-10 w-10 rounded-lg flex items-center justify-center", tones[tone])}><Icon size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-lighter mt-1 leading-relaxed">{description}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-lighter" />
    </button>
  );
}
