import { useLocation } from "wouter";
import { BarChart3, Brain, Clock3, TrendingUp } from "lucide-react";
import { HubHeader, HubLink, HubStat } from "@/components/english/EnglishHubUI";
import { useEnglishStats, useSpeakingStats } from "@/lib/hooks/useEnglish";

export default function EnglishProgressHub() {
  const [, navigate] = useLocation();
  const english = useEnglishStats();
  const speaking = useSpeakingStats();

  return (
    <div className="space-y-6 min-w-0">
      <HubHeader title="学习分析" subtitle="回顾真实学习记录、口语趋势与 AI 总结" onBack={() => navigate("/english")} />

      <section aria-label="学习分析概览" className="grid grid-cols-3 rounded-lg border border-border bg-card py-4">
        <HubStat label="今日已复习" value={english.isError ? "--" : english.data?.todayReviewed ?? 0} />
        <HubStat label="连续复习" value={english.isError ? "--" : `${english.data?.reviewStreak ?? 0} 天`} />
        <HubStat label="口语练习" value={speaking.isError ? "--" : speaking.data?.totalSessions ?? 0} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <HubLink icon={Clock3} title="学习历史" description="今日学习报告和表达练习记录" tone="sage" onClick={() => navigate("/english/history")} />
        <HubLink icon={TrendingUp} title="口语练习趋势" description="评分变化、常见错误和成长轨迹" tone="blue" onClick={() => navigate("/english/progress/speaking")} />
        <HubLink icon={Brain} title="AI 学习建议" description="基于已有口语数据生成学习总结" onClick={() => navigate("/english/progress/speaking")} />
      </section>

      {!english.isLoading && !speaking.isLoading && (english.data?.todayReviewed ?? 0) === 0 && (speaking.data?.totalSessions ?? 0) === 0 && (
        <div className="text-center py-8 border-t border-border">
          <BarChart3 size={28} className="text-ink-lighter mx-auto" />
          <p className="text-sm text-ink-light mt-3">完成一些学习后会在这里看到成长记录。</p>
        </div>
      )}
    </div>
  );
}
