import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, ArrowRight, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBeijingDateString } from "@/lib/date";
import { addDays, buildCueSentence } from "@/lib/habits/logic";
import { useCreateSprint } from "@/lib/habits/hooks";
import { getHabitIcon, HABIT_ICON_CHOICES, DEFAULT_HABIT_ICON } from "@/lib/habits/icons";

const STEPS = ["做什么", "最小动作", "叠加时机"] as const;

const PRESETS = [
  {
    title: "每天阅读", icon: "BookOpen", minimumAction: "打开书读一页",
    trigger: "喝完晨间咖啡", identity: "我是一个每天都会读点书的人",
  },
  {
    title: "英语表达", icon: "Languages", minimumAction: "开口说一句英语",
    trigger: "打开英语练习 App", identity: "我是一个能自然开口说英语的人",
  },
  {
    title: "拉伸放松", icon: "Footprints", minimumAction: "做 5 分钟拉伸",
    trigger: "晚上洗漱完", identity: "我是一个在意身体感受的人",
  },
];

type Form = {
  icon: string;
  title: string;
  minimumAction: string;
  trigger: string;
  location: string;
  identity: string;
  startInDays: number; // 0 = today, 1 = tomorrow
};

export default function HabitLabNew() {
  const [, navigate] = useLocation();
  const create = useCreateSprint();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({
    icon: DEFAULT_HABIT_ICON,
    title: "",
    minimumAction: "",
    trigger: "",
    location: "",
    identity: "",
    startInDays: 0,
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const today = getBeijingDateString();
  const startDate = addDays(today, form.startInDays);
  const cueSentence = buildCueSentence({
    trigger: form.trigger, location: form.location, minimumAction: form.minimumAction,
  });
  const canNext = step === 0 ? form.title.trim().length > 0 : form.minimumAction.trim().length > 0;

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setForm((f) => ({ ...f, ...p, trigger: "", location: "" }));
    setStep(1);
  };

  const submit = () => {
    if (!form.title.trim() || !form.minimumAction.trim()) return;
    create.mutate({
      title: form.title.trim(),
      icon: form.icon,
      minimum_action: form.minimumAction.trim(),
      trigger: form.trigger.trim() || null,
      location: form.location.trim() || null,
      cue_sentence: cueSentence,
      identity_statement: form.identity.trim() || null,
      duration_days: 21,
      start_date: startDate,
    }, {
      onSuccess: (sprint) => navigate(`/habits/${sprint.id}`),
    });
  };

  const back = () => (step === 0 ? navigate("/habits") : setStep((s) => s - 1));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={back} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center text-ink-light hover:text-ink transition-colors">
          <ChevronLeft size={16} />
        </button>
        <header>
          <p className="text-sm text-ink-lighter">发起一个 21 天实验</p>
          <h1 className="text-xl font-semibold tracking-tight mt-0.5 text-ink">Habit Lab · New</h1>
        </header>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={cn("h-1 rounded-full transition-colors", i <= step ? "bg-sage-deep" : "bg-ink/8")} />
            <p className={cn("mt-1.5 text-[10px] font-medium", i <= step ? "text-sage-deep" : "text-ink-lighter")}>
              {i + 1}. {label}
            </p>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <label className="block">
            <p className="text-sm font-medium text-ink mb-2">想养成什么？</p>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="例如：每天阅读"
              className="w-full rounded-xl border border-border bg-warm-cream px-3.5 py-3 text-base text-ink placeholder:text-ink-lighter outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 transition"
            />
          </label>
          <div>
            <p className="text-sm font-medium text-ink mb-2">选一个图标</p>
            <div className="grid grid-cols-8 gap-2">
              {HABIT_ICON_CHOICES.map((c) => {
                const Ic = getHabitIcon(c.key);
                const active = form.icon === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => set("icon", c.key)}
                    title={c.label}
                    className={cn("aspect-square rounded-xl flex items-center justify-center transition-colors",
                      active ? "bg-sage-deep text-white shadow-sm" : "bg-sage-light/40 text-sage-deep hover:bg-sage-light")}
                  >
                    <Ic size={17} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <label className="block">
              <p className="text-sm font-medium text-ink mb-2">最小动作是什么？</p>
              <p className="text-[11px] text-ink-lighter mb-2 -mt-1">小到不费力，2 分钟内能完成。做得到才算数。</p>
              <input
                autoFocus
                value={form.minimumAction}
                onChange={(e) => set("minimumAction", e.target.value)}
                placeholder="例如：打开书读一页"
                className="w-full rounded-xl border border-border bg-warm-cream px-3.5 py-3 text-base text-ink placeholder:text-ink-lighter outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 transition"
              />
            </label>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">
              <Lightbulb size={12} /> 灵感 · 点一个先试试
            </p>
            <div className="mt-2.5 space-y-2">
              {PRESETS.map((p) => (
                <button
                  key={p.title}
                  onClick={() => applyPreset(p)}
                  className="w-full flex items-center justify-between rounded-xl border border-border bg-warm-cream/60 px-3.5 py-2.5 text-left transition-colors hover:bg-card-hover group"
                >
                  <span>
                    <span className="block text-sm font-medium text-ink">{p.minimumAction}</span>
                    <span className="block text-[11px] text-ink-lighter">{p.trigger} 之后做</span>
                  </span>
                  <ArrowRight size={14} className="text-ink-lighter group-hover:text-sage-deep transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <label className="block">
              <p className="text-sm font-medium text-ink mb-2">把它挂在一个既有习惯后面</p>
              <p className="text-[11px] text-ink-lighter mb-2 -mt-1">习惯叠加：新习惯最容易从旧习惯的结尾长出来。</p>
              <input
                autoFocus
                value={form.trigger}
                onChange={(e) => set("trigger", e.target.value)}
                placeholder="做完什么之后？例如：喝完晨间咖啡"
                className="w-full rounded-xl border border-border bg-warm-cream px-3.5 py-3 text-base text-ink placeholder:text-ink-lighter outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 transition"
              />
            </label>
            <label className="block">
              <p className="text-[11px] font-medium text-ink-light mb-1.5">在哪里（可选）</p>
              <input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="例如：书房 / 床边 / 公司茶水间"
                className="w-full rounded-xl border border-border bg-warm-cream px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 transition"
              />
            </label>
          </div>

          {/* Live cue sentence preview */}
          <div className="rounded-2xl bg-gradient-to-br from-sage-light/15 to-white border border-sage-light/40 p-4">
            <p className="text-[10px] font-semibold text-sage-deep uppercase tracking-wider">提示语 · 预览</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink font-medium">
              {cueSentence || "输入最小动作后，这里会生成一句自然的行动提示语。"}
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <label className="block">
              <p className="text-sm font-medium text-ink mb-2">我是谁（可选）</p>
              <p className="text-[11px] text-ink-lighter mb-2 -mt-1">行为重复塑造身份，身份会反过来拉动作。</p>
              <input
                value={form.identity}
                onChange={(e) => set("identity", e.target.value)}
                placeholder="例如：我是一个每天读点书的人"
                className="w-full rounded-xl border border-border bg-warm-cream px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 transition"
              />
            </label>
            <div>
              <p className="text-[11px] font-medium text-ink-light mb-1.5">哪天开始？</p>
              <div className="flex gap-2">
                {[{ label: "今天", v: 0 }, { label: "明天", v: 1 }].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => set("startInDays", o.v)}
                    className={cn("flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors",
                      form.startInDays === o.v
                        ? "bg-sage-deep text-white"
                        : "bg-ink/5 text-ink-light hover:bg-ink/10")}
                  >
                    {o.label} <span className="text-[10px] opacity-70">({addDays(today, o.v)})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom action */}
      <div className="flex gap-2">
        {step < 2 && (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-sage px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sage-deep disabled:opacity-50"
          >
            下一步 <ChevronRight size={15} />
          </button>
        )}
        {step === 2 && (
          <button
            onClick={submit}
            disabled={create.isPending || !canNext}
            className="flex-1 rounded-xl bg-sage-deep px-4 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {create.isPending ? "创建中…" : "开始 21 天实验"}
          </button>
        )}
      </div>
    </div>
  );
}
