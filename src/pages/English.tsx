import { useLocation } from "wouter";
import {
  BookOpen, Mic, Library, Brain, Eye, Edit3,
  ChevronRight, Zap, Upload, TrendingUp, FileUp,
  Sparkles, CheckCircle2, GraduationCap,
} from "lucide-react";
import { useEnglishStats } from "@/lib/hooks/useEnglish";
import {
  useHubSessionProgress,
  useLearnQueueCount,
  useTodayLearnSession,
  useCreateLearnSession,
  useAppendLearnItems,
  useLearnMoreAvailable,
  isLearnItemFinished,
} from "@/lib/hooks/useReviewSession";
import LearnTargetSelector from "@/components/english/LearnTargetSelector";
import { cn } from "@/lib/utils";

export default function English() {
  const [, navigate] = useLocation();
  const { data: stats, isLoading } = useEnglishStats();
  const { data: sessionProgress } = useHubSessionProgress();
  const { data: learnCount } = useLearnQueueCount();

  const dueCount = stats?.due ?? 0;
  const toLearnCount = learnCount ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-lighter">English OS</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">英语学习</h1>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="表达库" value={isLoading ? "-" : stats?.total ?? 0} color="ink" />
        <StatCard label="待学习" value={toLearnCount} color={toLearnCount ? "blue" : "ink"} />
        <StatCard label="待复习" value={isLoading ? "-" : dueCount} color={dueCount ? "sage" : "ink"} />
        <StatCard label="已掌握" value={isLoading ? "-" : stats?.mastered ?? 0} color="sage" />
      </div>

      {/* Primary actions: Adaptive Learn + Review */}
      <div className="space-y-3">
        <TodayLearningCard />
        <ActionCard
          icon={Brain}
          label="SRS 复习"
          desc={dueCount ? `${dueCount} 条待复习` : "全部掌握!"}
          highlight={dueCount > 0}
          color="purple"
          onClick={() => navigate("/english/review?mode=recall")}
          extra={sessionProgress?.hasSession ? `今日已复习 ${sessionProgress.recallCompleted}/${sessionProgress.totalExpressions} 条` : undefined}
        />
      </div>

      {/* Three training modes */}
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

      {/* Today's review progress */}
      {sessionProgress?.hasSession && sessionProgress.totalExpressions > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-sage-deep" />
            <span className="text-sm font-medium text-ink">今日复习进度</span>
            {sessionProgress.allDone && (
              <span className="text-[10px] font-medium text-sage-deep bg-sage-light/50 px-2 py-0.5 rounded-full ml-auto">
                全部完成
              </span>
            )}
          </div>
          <div className="space-y-2">
            <ProgressRow
              label="主动回忆"
              completed={sessionProgress.recallCompleted}
              passed={sessionProgress.recallPassed}
              total={sessionProgress.totalExpressions}
              color="bg-purple-400"
            />
            <ProgressRow
              label="语境填空"
              completed={sessionProgress.clozeCompleted}
              passed={sessionProgress.clozeCorrect}
              total={sessionProgress.totalExpressions}
              color="bg-amber-400"
            />
            <ProgressRow
              label="个人造句"
              completed={sessionProgress.sentenceCompleted}
              passed={sessionProgress.sentenceCompleted}
              total={sessionProgress.totalExpressions}
              color="bg-blue-400"
              showPassed={false}
            />
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3">
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

    </div>
  );
}

// ═══════════════════════════════════════
// V4.3: Today's Learning Card — three states
//
// No session  → "今天想学多少？" target selector (轻松5/标准10/专注15/冲刺20/自定义)
// In progress → 3/10 [继续学习]
// Completed   → 10/10 ✓ + [今天再学一些] (extends the SAME session, never a second one)
// ═══════════════════════════════════════

function TodayLearningCard() {
  const [, navigate] = useLocation();
  const { data } = useTodayLearnSession();
  const { data: queueCount = 0 } = useLearnQueueCount();
  const { data: moreAvailable = 0 } = useLearnMoreAvailable();
  const createSession = useCreateLearnSession();
  const append = useAppendLearnItems();

  const session = data?.session ?? null;
  const items = data?.items ?? [];
  const doneCount = items.filter(isLearnItemFinished).length;
  const started = session !== null;
  const allDone = started && items.length > 0 && doneCount >= items.length;

  const handleCreate = (target: number) => {
    createSession.mutate(
      { target },
      { onSuccess: (res) => { if (!res.empty) navigate("/english/learn"); } },
    );
  };

  const handleAppend = (count: number) => {
    append.mutate(
      { count },
      { onSuccess: () => navigate("/english/learn") },
    );
  };

  const header = (
    <div className="flex items-center gap-2">
      <GraduationCap size={14} className={started ? "text-sage-deep" : "text-blue-600"} />
      <span className="text-sm font-medium text-ink">今日学习</span>
      {started && allDone && (
        <span className="text-[10px] font-medium text-sage-deep bg-sage-light/50 px-2 py-0.5 rounded-full ml-auto">
          全部完成
        </span>
      )}
    </div>
  );

  // State A — no session yet: target selector (or empty state)
  if (!started) {
    if (queueCount === 0) {
      return (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          {header}
          <p className="text-sm text-ink-light">表达库里暂时没有待学习的新表达。</p>
          <button
            onClick={() => navigate("/english/expressions")}
            className="w-full py-3 rounded-xl text-sm font-medium bg-ink text-white hover:bg-ink/90 transition-colors"
          >
            去表达库
          </button>
        </div>
      );
    }
    return (
      <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
        {header}
        <LearnTargetSelector
          mode="create"
          availableCount={queueCount}
          busy={createSession.isPending}
          onSubmit={handleCreate}
        />
      </div>
    );
  }

  // State B — in progress: continue
  if (!allDone) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          {header}
          <p className="text-sm text-ink-light mt-1">
            {doneCount} / {items.length} 条已完成
          </p>
        </div>
        <button
          onClick={() => navigate("/english/learn")}
          className="shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium bg-ink text-white hover:bg-ink/90 transition-colors"
        >
          继续学习
        </button>
      </div>
    );
  }

  // State C — completed: today's recap + 今天再学一些
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
      {header}
      <p className="text-sm text-ink-light">
        今天新学 <span className="font-semibold text-ink">{doneCount}</span> 条表达 ✓
      </p>
      {moreAvailable > 0 ? (
        <LearnTargetSelector
          mode="append"
          availableCount={moreAvailable}
          busy={append.isPending}
          onSubmit={handleAppend}
        />
      ) : (
        <p className="text-xs text-ink-lighter">
          表达库里没有更多待学习的表达啦，去复习今天的 SRS 卡片吧。
        </p>
      )}
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

// ── Progress Row (V3.5: session-based) ──

function ProgressRow({
  label,
  completed,
  passed,
  total,
  color,
  showPassed = true,
}: {
  label: string;
  completed: number;
  passed: number;
  total: number;
  color: string;
  showPassed?: boolean;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-ink-lighter w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-ink/5 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-ink-lighter shrink-0 w-12 text-right">
        {showPassed ? `${passed}/${completed}` : `${completed}/${total}`}
      </span>
    </div>
  );
}

// ── Stat Card ──
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-3 text-center">
      <p className={cn(
        "text-xl font-bold",
        color === "sage" ? "text-sage-deep" : color === "blue" ? "text-blue-600" : "text-ink",
      )}>
        {value}
      </p>
      <p className="text-[10px] text-ink-lighter mt-0.5">{label}</p>
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
  const highlightColors: Record<string, string> = {
    blue: "bg-blue-50",
    purple: "bg-purple-50",
  };
  const highlightIcons: Record<string, string> = {
    blue: "text-blue-600",
    purple: "text-purple-600",
  };

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
        highlight && color ? (highlightColors[color] || "bg-purple-50") : "bg-ink/5",
      )}>
        <Icon size={18} className={
          highlight && color ? (highlightIcons[color] || "text-purple-600") : "text-ink-light"
        } />
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
