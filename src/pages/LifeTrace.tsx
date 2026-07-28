import { useLocation } from "wouter";
import { Footprints, Pen, Coins, Mic, ArrowRight, Loader2 } from "lucide-react";
import { useLifeTraceStats } from "@/lib/hooks/useLifeTrace";

// ── Sub-components ──

function StatCard({ label, value, prefix }: { label: string; value: string | number; prefix?: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-3 text-center">
      <p className="text-2xl font-semibold text-ink">
        {prefix}{typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-ink-lighter mt-1">{label}</p>
    </div>
  );
}

function ActionButton({ icon, label, onClick, primary }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
        primary
          ? "bg-sage-light text-sage-deep"
          : "bg-card border border-border text-ink-light hover:border-sage-light/50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ActivityItem({ type, summary, date }: { type: string; summary: string; date: string }) {
  const icons: Record<string, string> = { idea: "💡", journal: "📝", mood: "🎭", money: "💰" };
  const labels: Record<string, string> = { idea: "快速记录", journal: "日记", mood: "心情", money: "记账" };
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-sm shrink-0 mt-0.5">{icons[type] || "📌"}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink truncate">{summary}</p>
        <p className="text-xs text-ink-lighter mt-0.5">
          {labels[type]} · {new Date(date).toLocaleDateString("zh-CN")}
        </p>
      </div>
    </div>
  );
}

// ── Page ──

export default function LifeTrace() {
  const [, navigate] = useLocation();
  const { data: stats, isLoading } = useLifeTraceStats();

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-ink-lighter">Life Trace</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">生活记录</h1>
      </header>

      {/* Stats row */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-ink-lighter" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="今日日记" value={stats?.journalToday ?? 0} />
          <StatCard label="本月心情" value={stats?.moodThisMonth ?? 0} />
          <StatCard
            label="本月支出"
            prefix="¥"
            value={(stats?.totalExpense ?? 0).toFixed(0)}
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2">
        <ActionButton
          icon={<Mic size={16} />}
          label="快速记录"
          onClick={() => navigate("/life-trace/capture")}
          primary
        />
        <ActionButton
          icon={<Pen size={16} />}
          label="写日记"
          onClick={() => navigate("/life-trace/journal")}
        />
        <ActionButton
          icon={<Coins size={16} />}
          label="记账"
          onClick={() => navigate("/life-trace/money")}
        />
      </div>

      {/* Module cards */}
      <div className="grid gap-2">
        <button
          onClick={() => navigate("/life-trace/journal")}
          className="bg-card rounded-2xl border border-border p-4 text-left hover:border-sage-light/50 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📝</span>
            <div>
              <p className="text-sm font-medium text-ink">日记</p>
              <p className="text-xs text-ink-lighter mt-0.5">每日记录 · 三件好事 · 待办清单</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-ink-lighter shrink-0" />
        </button>

        <button
          onClick={() => navigate("/life-trace/mood")}
          className="bg-card rounded-2xl border border-border p-4 text-left hover:border-sage-light/50 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🎭</span>
            <div>
              <p className="text-sm font-medium text-ink">心情记录</p>
              <p className="text-xs text-ink-lighter mt-0.5">情绪追踪 · 强度记录 · 触发事件</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-ink-lighter shrink-0" />
        </button>

        <button
          onClick={() => navigate("/life-trace/money")}
          className="bg-card rounded-2xl border border-border p-4 text-left hover:border-sage-light/50 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">💰</span>
            <div>
              <p className="text-sm font-medium text-ink">记账</p>
              <p className="text-xs text-ink-lighter mt-0.5">收支记录 · 分类统计 · 月度汇总</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-ink-lighter shrink-0" />
        </button>
      </div>

      {/* Recent activity */}
      <div>
        <p className="text-xs font-medium text-ink-light mb-2">最近动态</p>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={14} className="animate-spin text-ink-lighter" />
          </div>
        ) : !stats?.recentActivities || stats.recentActivities.length === 0 ? (
          <div className="text-center py-8">
            <Footprints size={32} className="text-ink-lighter mx-auto mb-2" />
            <p className="text-xs text-ink-lighter">还没有生活记录</p>
            <p className="text-xs text-ink-lighter mt-1">点击上方按钮开始记录你的生活</p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-3 divide-y divide-border/50">
            {stats.recentActivities.map((a, i) => (
              <ActivityItem key={`${a.type}-${i}`} type={a.type} summary={a.summary} date={a.date} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
