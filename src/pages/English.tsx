import { useLocation } from "wouter";
import { BookOpen, Mic, Library, Brain, TrendingUp, Clock, ChevronRight, Zap } from "lucide-react";
import { useEnglishStats } from "@/lib/hooks/useEnglish";
import { cn } from "@/lib/utils";

export default function English() {
  const [, navigate] = useLocation();
  const { data: stats, isLoading } = useEnglishStats();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-lighter">English OS</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">英语学习</h1>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="表达库" value={isLoading ? "-" : stats?.total ?? 0} color="ink" />
        <StatCard label="待复习" value={isLoading ? "-" : stats?.due ?? 0} color={stats?.due ? "sage" : "ink"} />
        <StatCard label="已掌握" value={isLoading ? "-" : stats?.mastered ?? 0} color="sage" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3">
        <ActionCard
          icon={Brain}
          label="SRS 复习"
          desc={stats?.due ? `${stats.due} 条待复习` : "全部掌握!"}
          highlight={!!(stats?.due && stats.due > 0)}
          color="purple"
          onClick={() => navigate("/english/review")}
          extra={stats?.todayReviewed ? `今日已复习 ${stats.todayReviewed} 条` : undefined}
        />
        <ActionCard
          icon={Library}
          label="表达库"
          desc={`${stats?.total ?? 0} 条表达 · 搜索 & 管理`}
          onClick={() => navigate("/english/expressions")}
        />
        <ActionCard
          icon={Mic}
          label="口语练习"
          desc={`${stats?.totalSessions ?? 0} 次练习记录`}
          onClick={() => navigate("/english/speaking")}
        />
      </div>

      {/* Review progress */}
      {stats && stats.todayReviewed > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-sage-deep" />
            <span className="text-sm font-medium text-ink">今日复习进度</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-ink/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-sage-light rounded-full transition-all"
                style={{ width: `${Math.min((stats.todayGood / Math.max(stats.todayReviewed, 1)) * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs text-ink-lighter shrink-0">
              {stats.todayGood}/{stats.todayReviewed} 掌握
            </span>
          </div>
        </div>
      )}

      {/* Bottom info */}
      <div className="bg-card rounded-2xl border border-sage-light/50 p-6">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={18} className="text-sage-deep" />
          <span className="text-xs font-medium text-sage-deep bg-sage-light px-2 py-0.5 rounded-full">
            Phase 2 — 进行中
          </span>
        </div>
        <p className="text-sm text-ink-light leading-relaxed">
          AI 口语练习支持录音 → ASR → 四维评分（Fluency / Grammar / Vocabulary / Naturalness）→ Better Version 生成。
          表达库管理表达数据，SRS 间隔复习系统。AI 反馈和语音识别将在 Phase 7 全面接入。
        </p>
      </div>
    </div>
  );
}

// ── Stat Card ──
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 text-center">
      <p className={cn(
        "text-2xl font-bold",
        color === "sage" ? "text-sage-deep" : "text-ink",
      )}>
        {value}
      </p>
      <p className="text-xs text-ink-lighter mt-0.5">{label}</p>
    </div>
  );
}

// ── Action Card ──
function ActionCard({
  icon: Icon,
  label,
  desc,
  highlight,
  color,
  onClick,
  extra,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  desc: string;
  highlight?: boolean;
  color?: string;
  onClick: () => void;
  extra?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl border p-4 flex items-center gap-4 text-left transition-colors",
        highlight ? "border-sage-light/50" : "border-border",
      )}
    >
      <div className={cn(
        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
        highlight ? "bg-purple-50" : "bg-ink/5",
      )}>
        <Icon size={18} className={highlight ? "text-purple-600" : "text-ink-light"} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
        <p className="text-xs text-ink-lighter mt-0.5">{desc}</p>
        {extra && <p className="text-[10px] text-sage-deep mt-0.5">{extra}</p>}
      </div>
      <ChevronRight size={14} className="text-ink-lighter shrink-0" />
    </button>
  );
}
