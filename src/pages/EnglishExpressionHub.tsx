import { useLocation } from "wouter";
import { BookOpen, Brain, Clock3, Edit3, Eye, Library, Upload } from "lucide-react";
import { HubHeader, HubLink, HubStat } from "@/components/english/EnglishHubUI";
import { useEnglishStats } from "@/lib/hooks/useEnglish";
import { useLearnQueueCount, useTodayReviewStatus } from "@/lib/hooks/useReviewSession";

export default function EnglishExpressionHub() {
  const [, navigate] = useLocation();
  const stats = useEnglishStats();
  const learnCount = useLearnQueueCount();
  const review = useTodayReviewStatus();
  const value = (failed: boolean, count?: number) => failed ? "--" : (count ?? 0);

  return (
    <div className="space-y-6 min-w-0">
      <HubHeader title="表达学习" subtitle="学习新表达、完成 SRS 复习并管理你的表达库" onBack={() => navigate("/english")} />

      <section aria-label="表达学习概览" className="grid grid-cols-3 rounded-lg border border-border bg-card py-4">
        <HubStat label="表达库" value={value(stats.isError, stats.data?.total)} />
        <HubStat label="待学习" value={value(learnCount.isError, learnCount.data)} />
        <HubStat label="剩余待复习" value={value(review.isError, review.data?.remaining)} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <HubLink icon={BookOpen} title="学习新表达" description={learnCount.data ? `${learnCount.data} 条表达等待学习` : "开始或继续今天的学习"} tone="sage" onClick={() => navigate("/english/learn")} />
        <HubLink icon={Brain} title="SRS 复习" description={review.data?.total ? `今日 ${review.data.completed} / ${review.data.total} · 剩余 ${review.data.remaining}` : "当前没有到期表达"} tone="blue" onClick={() => navigate("/english/review")} />
        <HubLink icon={Library} title="表达库" description="搜索、筛选和管理全部表达" onClick={() => navigate("/english/library")} />
        <HubLink icon={Clock3} title="学习历史" description="查看学习报告和每次练习记录" onClick={() => navigate("/english/history")} />
        <HubLink icon={Upload} title="导入表达" description="从文本或文件批量添加表达" onClick={() => navigate("/english/import")} />
      </section>

      <section aria-labelledby="review-modes" className="border-t border-border pt-5">
        <h2 id="review-modes" className="text-xs font-medium text-ink-lighter mb-3">SRS 训练模式</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <ModeShortcut icon={Brain} label="主动回忆" onClick={() => navigate("/english/review?mode=recall")} />
          <ModeShortcut icon={Edit3} label="语境填空" onClick={() => navigate("/english/review?mode=cloze")} />
          <ModeShortcut icon={Eye} label="个人造句" onClick={() => navigate("/english/review?mode=sentence")} />
        </div>
      </section>
    </div>
  );
}

function ModeShortcut({ icon: Icon, label, onClick }: { icon: typeof Brain; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-10 rounded-lg bg-ink/5 text-xs font-medium text-ink-light inline-flex items-center justify-center gap-2 hover:bg-ink/10">
      <Icon size={14} />{label}
    </button>
  );
}
