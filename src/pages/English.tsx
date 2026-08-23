import { useLocation } from "wouter";
import {
  ArrowRight, BookOpen, Clock3, FileUp, GraduationCap, Library,
  Mic, Search, Sparkles, TrendingUp, Upload,
} from "lucide-react";
import { useEnglishStats, useSpeakingSessions } from "@/lib/hooks/useEnglish";
import { useHubSessionProgress, useLearnQueueCount, useTodayLearnSession, isLearnItemFinished } from "@/lib/hooks/useReviewSession";
import { useReaderBooks } from "@/lib/hooks/useEnglishReader";
import { cn } from "@/lib/utils";

const isToday = (value?: string | null) => Boolean(value && new Date(value).toDateString() === new Date().toDateString());

export default function English() {
  const [, navigate] = useLocation();
  const statsQuery = useEnglishStats();
  const learnCountQuery = useLearnQueueCount();
  const learnSessionQuery = useTodayLearnSession();
  const reviewProgressQuery = useHubSessionProgress();
  const speakingQuery = useSpeakingSessions();
  const booksQuery = useReaderBooks();

  const stats = statsQuery.data;
  const learnItems = learnSessionQuery.data?.items ?? [];
  const learnedToday = learnItems.filter(isLearnItemFinished).length;
  const hasUnfinishedLearn = Boolean(learnSessionQuery.data?.session && learnedToday < learnItems.length);
  const speakingToday = (speakingQuery.data ?? []).filter((session) => isToday(session.created_at)).length;
  const readToday = (booksQuery.data ?? []).some((book) => isToday(book.reading_progress?.updated_at));
  const dueCount = stats?.due ?? 0;

  const nextAction = hasUnfinishedLearn
    ? { label: "继续今日学习", path: "/english/learn" }
    : statsQuery.isError
      ? { label: "选择学习内容", path: "/english/expressions" }
      : dueCount > 0
      ? { label: `复习 ${dueCount} 条表达`, path: "/english/review" }
      : speakingQuery.isError
        ? { label: "选择学习内容", path: "/english/expressions" }
        : speakingToday === 0
        ? { label: "完成今日口语", path: "/english/speaking/practice" }
        : null;

  const statValue = (failed: boolean, value: number | undefined) => failed ? "--" : (value ?? 0);

  return (
    <div className="space-y-6 min-w-0">
      <header>
        <p className="text-xs text-ink-lighter">English OS</p>
        <h1 className="text-2xl font-semibold mt-0.5">英语学习</h1>
        <p className="text-sm text-ink-light mt-1">学习 · 复习 · 口语 · 阅读</p>
      </header>

      <section aria-label="学习概览" className="grid grid-cols-2 sm:grid-cols-4 rounded-lg border border-border bg-card overflow-hidden">
        <OverviewStat label="表达库" value={statValue(statsQuery.isError, stats?.total)} />
        <OverviewStat label="待学习" value={statValue(learnCountQuery.isError, learnCountQuery.data)} />
        <OverviewStat label="今日待复习" value={statValue(statsQuery.isError, dueCount)} />
        <OverviewStat label="口语练习" value={statValue(statsQuery.isError, stats?.totalSessions)} />
      </section>

      <section aria-labelledby="today-english" className="rounded-lg bg-ink text-white p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-sage-light" />
          <h2 id="today-english" className="text-sm font-semibold">今日英语</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 mt-4">
          <TodayMetric label="新学" value={learnSessionQuery.isError ? "--" : learnedToday} />
          <TodayMetric label="待复习" value={statsQuery.isError ? "--" : dueCount} />
          <TodayMetric label="口语" value={speakingQuery.isError ? "--" : `${speakingToday}/1`} />
          <TodayMetric label="阅读" value={booksQuery.isError ? "--" : readToday ? "已阅读" : "未开始"} />
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/15 pt-4">
          <p className="text-xs text-white/65 min-w-0">
            {reviewProgressQuery.data?.allDone && !nextAction ? "今天的核心学习已完成" : "按今日状态继续下一项"}
          </p>
          {nextAction ? (
            <button type="button" onClick={() => navigate(nextAction.path)} className="shrink-0 h-10 px-4 rounded-lg bg-white text-ink text-sm font-semibold inline-flex items-center gap-2">
              {nextAction.label}<ArrowRight size={15} />
            </button>
          ) : (
            <span className="shrink-0 text-sm font-medium text-sage-light">今日已完成</span>
          )}
        </div>
      </section>

      <section aria-labelledby="learning-centers">
        <div className="mb-3">
          <p className="text-xs text-ink-lighter">Learning hubs</p>
          <h2 id="learning-centers" className="text-lg font-semibold mt-0.5">学习中心</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CenterCard icon={GraduationCap} title="表达学习" description="学表达 · SRS 复习 · 表达库" tone="sage" onClick={() => navigate("/english/expressions")} />
          <CenterCard icon={Mic} title="英语口语" description="对话 · 主题表达 · AI 纠错" tone="rose" onClick={() => navigate("/english/speaking")} />
          <CenterCard icon={BookOpen} title="英文阅读" description="EPUB · 原著阅读 · 表达摘录" tone="blue" onClick={() => navigate("/english/reading")} />
          <CenterCard icon={TrendingUp} title="学习成长" description="历史 · 趋势 · AI 总结" tone="amber" onClick={() => navigate("/english/progress")} />
        </div>
      </section>

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="text-xs font-medium text-ink-lighter mb-2">快捷入口</h2>
        <div className="flex flex-wrap gap-2">
          <QuickAction icon={Upload} label="导入表达" onClick={() => navigate("/english/import")} />
          <QuickAction icon={FileUp} label="导入口语题库" onClick={() => navigate("/english/speaking/import")} />
          <QuickAction icon={Clock3} label="学习历史" onClick={() => navigate("/english/history")} />
          <QuickAction icon={Search} label="搜索表达库" onClick={() => navigate("/english/library")} />
        </div>
      </section>
    </div>
  );
}

function OverviewStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 p-3 sm:p-4 border-b border-r border-border even:border-r-0 sm:border-b-0 sm:even:border-r">
      <p className="text-xl font-semibold text-ink truncate">{value}</p>
      <p className="text-[11px] text-ink-lighter mt-0.5 truncate">{label}</p>
    </div>
  );
}

function TodayMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 pr-2">
      <p className="text-lg font-semibold truncate">{value}</p>
      <p className="text-[11px] text-white/55 mt-0.5">{label}</p>
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
    <button type="button" onClick={onClick} className="min-w-0 rounded-lg border border-border bg-card p-4 text-left hover:border-ink/20 transition-colors">
      <span className={cn("h-10 w-10 rounded-lg flex items-center justify-center", tones[tone])}><Icon size={19} /></span>
      <h3 className="text-base font-semibold text-ink mt-4">{title}</h3>
      <p className="text-xs text-ink-lighter mt-1">{description}</p>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink mt-4">进入中心<ArrowRight size={13} /></span>
    </button>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Upload; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-ink-light inline-flex items-center gap-2 hover:bg-ink/5">
      <Icon size={14} />{label}
    </button>
  );
}
