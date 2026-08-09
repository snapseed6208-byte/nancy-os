import { useLocation } from "wouter";
import {
  BookOpen, Mic, Library, Brain, Eye, Edit3,
  ChevronRight, Zap, Upload, TrendingUp, FileUp,
  Sparkles, CheckCircle2,
} from "lucide-react";
import { useEnglishStats } from "@/lib/hooks/useEnglish";
import { cn } from "@/lib/utils";

export default function English() {
  const [, navigate] = useLocation();
  const { data: stats, isLoading } = useEnglishStats();

  const dueCount = stats?.due ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-lighter">English OS</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">英语学习</h1>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="表达库" value={isLoading ? "-" : stats?.total ?? 0} color="ink" />
        <StatCard label="待复习" value={isLoading ? "-" : dueCount} color={dueCount ? "sage" : "ink"} />
        <StatCard label="已掌握" value={isLoading ? "-" : stats?.mastered ?? 0} color="sage" />
      </div>

      {/* Three training modes — independent entry points */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink-light">训练模式</p>
        <div className="grid grid-cols-3 gap-2">
          <ModeCard
            icon={Brain}
            label="主动回忆"
            desc="看中文说英文"
            color="purple"
            onClick={() => navigate("/english/review?mode=recall")}
          />
          <ModeCard
            icon={Edit3}
            label="语境填空"
            desc="例句中填空"
            color="amber"
            onClick={() => navigate("/english/review?mode=cloze")}
          />
          <ModeCard
            icon={Eye}
            label="个人造句"
            desc="活用表达造句"
            color="blue"
            onClick={() => navigate("/english/review?mode=sentence")}
          />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3">
        <ActionCard
          icon={Brain}
          label="SRS 复习"
          desc={dueCount ? `${dueCount} 条待复习` : "全部掌握!"}
          highlight={!!(dueCount > 0)}
          onClick={() => navigate("/english/review?mode=recall")}
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
        <ActionCard
          icon={TrendingUp}
          label="学习历史"
          desc="今日报告 · 学习记录 · 趋势分析"
          onClick={() => navigate("/english/history")}
        />
        <ActionCard
          icon={Upload}
          label="导入表达"
          desc="从文件或文本批量导入英语表达"
          onClick={() => navigate("/english/import")}
        />
        <ActionCard
          icon={FileUp}
          label="导入口语题库"
          desc="上传文件 AI 提取 · 自动分类去重 · 批量导入"
          onClick={() => navigate("/english/speaking/import")}
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
            Phase 3 — 主动输出训练
          </span>
        </div>
        <p className="text-sm text-ink-light leading-relaxed">
          3 种训练模式：主动回忆（看中文说英文）、语境填空（例句填空）、个人造句（活用表达造句）。
          三种模式共享同一套 Daily Set，自由切换，独立追踪进度。
        </p>
      </div>
    </div>
  );
}

// ── Mode Card ──

function ModeCard({
  icon: Icon,
  label,
  desc,
  color,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  desc: string;
  color: string;
  onClick: () => void;
}) {
  const colorMap: Record<string, string> = {
    purple: "bg-purple-50 text-purple-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <button
      onClick={onClick}
      className="bg-card rounded-xl border border-border p-3 text-center hover:border-sage-light/50 transition-colors"
    >
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mx-auto mb-1.5", colorMap[color] || colorMap.purple)}>
        <Icon size={14} />
      </div>
      <p className="text-xs font-medium text-ink">{label}</p>
      <p className="text-[10px] text-ink-lighter mt-0.5">{desc}</p>
    </button>
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
