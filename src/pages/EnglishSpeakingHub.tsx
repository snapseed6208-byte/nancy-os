import { useLocation } from "wouter";
import { BarChart3, FileUp, Mic, Sparkles } from "lucide-react";
import { HubHeader, HubLink, HubStat } from "@/components/english/EnglishHubUI";
import { useSpeakingSessions, useSpeakingStats } from "@/lib/hooks/useEnglish";

export default function EnglishSpeakingHub() {
  const [, navigate] = useLocation();
  const stats = useSpeakingStats();
  const sessions = useSpeakingSessions();
  const recent = (sessions.data ?? []).slice(0, 3);

  return (
    <div className="space-y-6 min-w-0">
      <HubHeader title="英语口语" subtitle="从情境或主题开始练习，获得 AI 纠错反馈" onBack={() => navigate("/english")} />

      <section aria-label="口语练习概览" className="grid grid-cols-3 rounded-lg border border-border bg-card py-4">
        <HubStat label="练习次数" value={stats.isError ? "--" : stats.data?.totalSessions ?? 0} />
        <HubStat label="练习天数" value={stats.isError ? "--" : stats.data?.practiceDays ?? 0} />
        <HubStat label="平均评分" value={stats.isError ? "--" : stats.data?.avgScore || "-"} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <HubLink icon={Mic} title="开始口语练习" description="进入现有口语训练，选择情境或主题" tone="rose" onClick={() => navigate("/english/speaking/practice")} />
        <HubLink icon={BarChart3} title="口语成长趋势" description="查看评分、常见错误和 AI 总结" onClick={() => navigate("/english/progress/speaking")} />
        <HubLink icon={FileUp} title="导入口语题库" description="从文件提取并整理口语题目" onClick={() => navigate("/english/speaking/import")} />
      </section>

      <section aria-labelledby="recent-speaking" className="border-t border-border pt-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-ink-lighter" />
          <h2 id="recent-speaking" className="text-xs font-medium text-ink-lighter">最近练习</h2>
        </div>
        {sessions.isError ? (
          <p className="text-sm text-ink-lighter">暂时无法加载口语记录</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-ink-lighter">还没有口语记录，完成第一次练习后会显示在这里。</p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {recent.map((session) => (
              <div key={session.id} className="py-3 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{session.title || session.prompt || "口语练习"}</p>
                <p className="text-xs text-ink-lighter mt-0.5">{new Date(session.created_at).toLocaleDateString("zh-CN")}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
