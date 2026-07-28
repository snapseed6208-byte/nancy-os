import { useState } from "react";
import {
  PencilLine, Calendar, Loader2, CheckCircle2, Send, Star,
  TrendingUp, Target, Sparkles, ArrowRight, Clock, Lightbulb, Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDailyReview, useUpsertDailyReview, useRecentDailyReviews,
  useWeeklySummaries, useCurrentWeekSummary, useGenerateDailyReflection,
  type DailyReview, type WeeklySummary,
} from "@/lib/hooks/useReview";
import { useReflections, useGenerateReflection } from "@/lib/hooks/useReflection";

// ── Helpers ──

function today() { return new Date().toISOString().split("T")[0]; }

function getWeekRange() {
  const t = new Date();
  const dow = t.getDay();
  const mon = new Date(t);
  mon.setDate(t.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    start: mon.toISOString().split("T")[0],
    end: sun.toISOString().split("T")[0],
  };
}

type Tab = "daily" | "weekly";

// ── Page ──

export default function Review() {
  const [tab, setTab] = useState<Tab>("daily");
  const date = today();
  const { data: dailyReview, isLoading: loadingDaily } = useDailyReview(date);
  const { data: weeklySummaries } = useWeeklySummaries();
  const { data: currentWeekSummary } = useCurrentWeekSummary();
  const { data: reflections } = useReflections();

  const reviewCount = dailyReview?.q1_what_done ? 1 : 0;
  const weekCount = (weeklySummaries?.length ?? 0) + (reflections?.length ?? 0);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-ink-lighter">数据复盘</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Review OS</h1>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard icon={PencilLine} label="今日复盘" value={reviewCount > 0 ? "已完成" : "未完成"} sub={reviewCount > 0 ? "做得好" : "现在开始？"} color="text-sage-deep" bg="bg-sage-light" />
        <StatCard icon={Calendar} label="本周复盘" value={`${weekCount} 篇`} sub="每日 + AI 反思" color="text-accent-sky" bg="bg-accent-sky/5" />
      </div>

      {/* Tab bar */}
      <div className="flex bg-ink/5 rounded-xl p-1">
        {([
          { key: "daily" as Tab, label: "每日复盘", icon: PencilLine },
          { key: "weekly" as Tab, label: "每周复盘", icon: Calendar },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all",
              tab === key ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
            )}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === "daily" && <DailyTab date={date} review={dailyReview || null} loading={loadingDaily} />}
      {tab === "weekly" && <WeeklyTab summaries={weeklySummaries || []} currentSummary={currentWeekSummary || null} reflections={reflections || []} />}
    </div>
  );
}

// ── Stat ──

function StatCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; sub: string; color: string; bg: string;
}) {
  return (
    <div className={cn("rounded-2xl p-3.5 flex flex-col gap-1.5", bg)}>
      <Icon size={16} className={color} />
      <div><p className="text-lg font-bold text-ink">{value}</p>
        <p className="text-[11px] font-medium text-ink-light">{label}</p>
        <p className="text-[10px] text-ink-lighter mt-0.5">{sub}</p></div>
    </div>
  );
}

// ── Daily Tab ──

const MOOD_OPTIONS = [
  { key: "great", emoji: "😊", label: "很棒" },
  { key: "good", emoji: "😄", label: "不错" },
  { key: "okay", emoji: "😐", label: "一般" },
  { key: "down", emoji: "😔", label: "低落" },
  { key: "bad", emoji: "😤", label: "糟糕" },
] as const;

function DailyTab({ date, review, loading }: { date: string; review: DailyReview | null; loading: boolean }) {
  const upsertReview = useUpsertDailyReview();
  const generateReflection = useGenerateDailyReflection();
  const [form, setForm] = useState({
    q1_what_done: review?.q1_what_done ?? "",
    q2_best_thing: review?.q2_best_thing ?? "",
    q3_what_chaos: review?.q3_what_chaos ?? "",
    q4_tomorrow_first: review?.q4_tomorrow_first ?? "",
    daily_log: review?.daily_log ?? "",
    mood: review?.mood ?? "",
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    upsertReview.mutate({
      date,
      q1_what_done: form.q1_what_done || undefined,
      q2_best_thing: form.q2_best_thing || undefined,
      q3_what_chaos: form.q3_what_chaos || undefined,
      q4_tomorrow_first: form.q4_tomorrow_first || undefined,
      daily_log: form.daily_log || undefined,
      mood: form.mood || undefined,
    }, { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); } });
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-sage-deep" /></div>;
  }

  const insight = review?.ai_growth_insight;
  const suggestion = review?.ai_tomorrow_suggestion;
  const hasReflection = !!insight;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
        <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">
          {date} 晚间复盘
        </p>

        <div className="space-y-3">
          {/* Q1 */}
          <div>
            <label className="text-xs font-medium text-ink mb-1.5 flex items-center gap-1.5">
              <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
              今天完成了什么？
            </label>
            <textarea
              value={form.q1_what_done}
              onChange={(e) => { setForm((f) => ({ ...f, q1_what_done: e.target.value })); setSaved(false); }}
              placeholder="列出今天完成的任务、事项..."
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 h-20 resize-none focus:border-sage-deep/50 transition-colors"
            />
          </div>

          {/* Q2 */}
          <div>
            <label className="text-xs font-medium text-ink mb-1.5 flex items-center gap-1.5">
              <span className="h-5 w-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
              今天学到了什么？
            </label>
            <textarea
              value={form.q2_best_thing}
              onChange={(e) => { setForm((f) => ({ ...f, q2_best_thing: e.target.value })); setSaved(false); }}
              placeholder="新的认知、技能、感悟..."
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 h-16 resize-none focus:border-sage-deep/50 transition-colors"
            />
          </div>

          {/* Q3 */}
          <div>
            <label className="text-xs font-medium text-ink mb-1.5 flex items-center gap-1.5">
              <span className="h-5 w-5 rounded-full bg-accent-rose/20 text-accent-rose flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
              今天遇到了什么问题？
            </label>
            <textarea
              value={form.q3_what_chaos}
              onChange={(e) => { setForm((f) => ({ ...f, q3_what_chaos: e.target.value })); setSaved(false); }}
              placeholder="困扰、阻碍、卡点..."
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 h-16 resize-none focus:border-sage-deep/50 transition-colors"
            />
          </div>

          {/* Q4 */}
          <div>
            <label className="text-xs font-medium text-ink mb-1.5 flex items-center gap-1.5">
              <span className="h-5 w-5 rounded-full bg-accent-sky/20 text-accent-sky flex items-center justify-center text-[10px] font-bold shrink-0">4</span>
              明天最重要的一件事？
            </label>
            <textarea
              value={form.q4_tomorrow_first}
              onChange={(e) => { setForm((f) => ({ ...f, q4_tomorrow_first: e.target.value })); setSaved(false); }}
              placeholder="给明天的自己一个明确的起点..."
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 h-16 resize-none focus:border-sage-deep/50 transition-colors"
            />
          </div>

          {/* Mood */}
          <div>
            <label className="text-xs font-medium text-ink mb-1.5 flex items-center gap-1.5">
              <Heart size={12} className="text-accent-rose" />
              今天心情
            </label>
            <div className="flex gap-1.5">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => { setForm((f) => ({ ...f, mood: m.key })); setSaved(false); }}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-center text-xs transition-all",
                    form.mood === m.key
                      ? "bg-accent-rose/10 ring-1 ring-accent-rose/30"
                      : "bg-ink/5 hover:bg-ink/10",
                  )}
                >
                  <span className="text-lg block">{m.emoji}</span>
                  <span className="text-[10px] text-ink-lighter mt-0.5">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Daily Log */}
          <div>
            <label className="text-xs font-medium text-ink mb-1.5 flex items-center gap-1.5">
              <Star size={12} className="text-ink-light" />
              自由记录
            </label>
            <textarea
              value={form.daily_log}
              onChange={(e) => { setForm((f) => ({ ...f, daily_log: e.target.value })); setSaved(false); }}
              placeholder="还有什么想记录的？随心写..."
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 h-20 resize-none focus:border-sage-deep/50 transition-colors"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={upsertReview.isPending}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all w-full justify-center",
            saved ? "bg-emerald-50 text-emerald-600" : "bg-sage-light text-sage-deep hover:bg-sage-light/80",
          )}
        >
          {upsertReview.isPending ? <Loader2 size={14} className="animate-spin" /> :
            saved ? <CheckCircle2 size={14} /> : <Send size={14} />}
          {saved ? "已保存" : upsertReview.isPending ? "保存中..." : "保存复盘"}
        </button>

        {upsertReview.error && (
          <p className="text-xs text-accent-rose">保存失败: {(upsertReview.error as Error).message}</p>
        )}
      </div>

      {/* AI Reflection */}
      {hasReflection ? (
        <div className="bg-gradient-to-br from-sage-light/5 to-white border border-sage-light/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-sage-deep" />
            <p className="text-xs font-semibold text-sage-deep">今日成长洞察</p>
          </div>
          <p className="text-xs text-ink-light leading-relaxed whitespace-pre-wrap">{insight}</p>
          {suggestion && (
            <div className="bg-sage-light/10 rounded-xl p-3">
              <p className="text-[11px] font-medium text-sage-deep mb-1 flex items-center gap-1">
                <ArrowRight size={11} />下一步建议
              </p>
              <p className="text-xs text-ink-light leading-relaxed">{suggestion}</p>
            </div>
          )}
        </div>
      ) : review ? (
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-sage-light/50 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-sage-deep" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">AI 成长分析</p>
              <p className="text-xs text-ink-lighter mt-1">
                根据你的复盘内容，AI 将生成今日成长洞察、行为模式分析和下一步建议，并进入长期记忆。
              </p>
              <button
                onClick={() => generateReflection.mutate({ date })}
                disabled={generateReflection.isPending}
                className="mt-3 flex items-center gap-2 bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors"
              >
                {generateReflection.isPending ? (
                  <><Loader2 size={12} className="animate-spin" />分析中...</>
                ) : (
                  <><Sparkles size={12} />生成成长洞察</>
                )}
              </button>
              {generateReflection.error && (
                <p className="text-xs text-accent-rose mt-1.5">{(generateReflection.error as Error).message}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Weekly Tab ──

function WeeklyTab({ summaries, currentSummary, reflections }: {
  summaries: WeeklySummary[];
  currentSummary: WeeklySummary | null;
  reflections: Record<string, unknown>[];
}) {
  const generateReflection = useGenerateReflection();
  const { start, end } = getWeekRange();

  // Merge reflections and summaries into one timeline
  const items: Array<{ type: "reflection" | "summary"; date: string; title: string; content: string; data?: Record<string, unknown> }> = [];

  for (const r of reflections) {
    items.push({
      type: "reflection",
      date: (r.generated_at as string) || (r.created_at as string) || "",
      title: (r.title as string) || "AI 周反思",
      content: (r.content as string) || "",
      data: r.data as Record<string, unknown> | undefined,
    });
  }

  for (const s of summaries) {
    items.push({
      type: "summary",
      date: s.week_start,
      title: s.title || `${s.week_start} → ${s.week_end}`,
      content: s.overview || "",
      data: { tasks_completed: s.tasks_completed, habits_streak_days: s.habits_streak_days, workout_days: s.workout_days, mood_avg: s.mood_avg },
    });
  }

  items.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-3">
      {/* Current week prompt */}
      <div className="bg-gradient-to-br from-sage-light/10 to-white border border-sage-light/30 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-sage-light flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-sage-deep" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">本周复盘 ({start} → {end})</p>
            <p className="text-xs text-ink-light mt-1">
              AI 分析过去7天的数据，生成行为模式、成长洞察和下周建议。
            </p>
            <button
              onClick={() => generateReflection.mutate()}
              disabled={generateReflection.isPending}
              className="mt-3 flex items-center gap-2 bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors"
            >
              {generateReflection.isPending ? (
                <><Loader2 size={12} className="animate-spin" />分析中...</>
              ) : (
                <><Sparkles size={12} />生成本周复盘</>
              )}
            </button>
            {generateReflection.error && (
              <p className="text-xs text-accent-rose mt-1.5">{(generateReflection.error as Error).message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="text-center py-10">
          <Calendar size={32} className="text-ink-lighter mx-auto mb-3 opacity-30" />
          <p className="text-sm text-ink-lighter">暂无复盘记录</p>
          <p className="text-xs text-ink-lighter mt-1">完成每日复盘后，每周可使用 AI 生成周反思</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                {item.type === "reflection" ? (
                  <Sparkles size={14} className="text-sage-deep" />
                ) : (
                  <Calendar size={14} className="text-accent-sky" />
                )}
                <span className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">
                  {item.type === "reflection" ? "AI 反思" : "周报"}
                </span>
                <span className="text-[10px] text-ink-lighter">{item.date}</span>
              </div>

              <p className="text-sm font-semibold text-ink">{item.title}</p>

              {item.data && (
                <div className="flex gap-3 mt-2 mb-2">
                  {(item.data.tasks_completed as number) != null && (
                    <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5">
                      任务 {String(item.data.tasks_completed)}
                    </span>
                  )}
                  {(item.data.habits_streak_days as number) != null && (
                    <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5">
                      习惯 {String(item.data.habits_streak_days)}天
                    </span>
                  )}
                  {(item.data.workout_days as number) != null && (
                    <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5">
                      运动 {String(item.data.workout_days)}天
                    </span>
                  )}
                </div>
              )}

              {item.content && (
                <p className="text-xs text-ink-light leading-relaxed mt-1 whitespace-pre-wrap line-clamp-6">
                  {item.content}
                </p>
              )}

              {(() => {
                const d = item.data as Record<string, unknown> | undefined;
                const mt = d?.mood_trends as Record<string, unknown> | undefined;
                if (!mt?.dominant_mood) return null;
                return (
                  <div className="mt-2 bg-sage-light/10 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-medium text-sage-deep">
                      情绪趋势: {String(mt.dominant_mood || "")}
                      {" · "}
                      {String(mt.trend_direction || "")}
                    </p>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
