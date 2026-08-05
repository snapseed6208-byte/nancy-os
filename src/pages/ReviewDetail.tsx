import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Loader2, CheckCircle2, Send, Sparkles, Heart, ArrowRight } from "lucide-react";
import { useDailyReview, useUpsertDailyReview, useGenerateDailyReflection, type DailyReview } from "@/lib/hooks/useReview";
import { formatBeijingDate, getBeijingDateString } from "@/lib/date";
import { cn } from "@/lib/utils";

const MOOD_OPTIONS = [
  { key: "great", emoji: "😊", label: "很棒" },
  { key: "good", emoji: "😄", label: "不错" },
  { key: "okay", emoji: "😐", label: "一般" },
  { key: "down", emoji: "😔", label: "低落" },
  { key: "bad", emoji: "😤", label: "糟糕" },
] as const;

export default function ReviewDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/review/date/:date");
  const date = params?.date || "";
  const bjToday = getBeijingDateString();
  const isToday = date === bjToday;

  const { data: review, isLoading } = useDailyReview(date);
  const upsertReview = useUpsertDailyReview();
  const generateReflection = useGenerateDailyReflection();

  const [form, setForm] = useState({
    q1_what_done: "",
    q2_best_thing: "",
    q3_what_chaos: "",
    q4_tomorrow_first: "",
    daily_log: "",
    mood: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (review) {
      setForm({
        q1_what_done: review.q1_what_done ?? "",
        q2_best_thing: review.q2_best_thing ?? "",
        q3_what_chaos: review.q3_what_chaos ?? "",
        q4_tomorrow_first: review.q4_tomorrow_first ?? "",
        daily_log: review.daily_log ?? "",
        mood: review.mood ?? "",
      });
    }
  }, [review]);

  const handleSave = () => {
    upsertReview.mutate({
      date,
      q1_what_done: form.q1_what_done || undefined,
      q2_best_thing: form.q2_best_thing || undefined,
      q3_what_chaos: form.q3_what_chaos || undefined,
      q4_tomorrow_first: form.q4_tomorrow_first || undefined,
      daily_log: form.daily_log || undefined,
      mood: form.mood || undefined,
    }, {
      onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-ink-lighter" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/review/history")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <p className="text-sm text-ink-lighter">数据复盘</p>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
              {isToday ? "今日复盘" : formatBeijingDate(date)}
            </h1>
          </div>
        </div>
      </header>

      {!review ? (
        <div className="text-center py-16">
          <p className="text-sm text-ink-lighter">这天还没有复盘记录</p>
          {!isToday && (
            <button onClick={() => navigate("/review")} className="mt-3 text-xs text-sage-deep font-medium">
              去今天复盘 →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
            <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">
              {formatBeijingDate(date)} 复盘
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
                  心情
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
                  <Heart size={12} className="text-ink-light" />
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
          {(review as DailyReview)?.ai_growth_insight ? (
            <div className="bg-gradient-to-br from-sage-light/5 to-white border border-sage-light/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-sage-deep" />
                <p className="text-xs font-semibold text-sage-deep">成长洞察</p>
              </div>
              <p className="text-xs text-ink-light leading-relaxed whitespace-pre-wrap">
                {(review as DailyReview).ai_growth_insight}
              </p>
              {(review as DailyReview).ai_tomorrow_suggestion && (
                <div className="bg-sage-light/10 rounded-xl p-3">
                  <p className="text-[11px] font-medium text-sage-deep mb-1 flex items-center gap-1">
                    <ArrowRight size={11} />下一步建议
                  </p>
                  <p className="text-xs text-ink-light leading-relaxed">
                    {(review as DailyReview).ai_tomorrow_suggestion}
                  </p>
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
                    根据你的复盘内容，AI 将生成今日成长洞察、行为模式分析和下一步建议。
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
      )}
    </div>
  );
}
