import { useState, useCallback } from "react";
import { Plus, Trash2, X, Search, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import ExerciseSelector from "@/components/health/ExerciseSelector";
import type { ExerciseLibraryItem, WorkoutSession, WorkoutExercise, RepSet } from "@/lib/hooks/useHealth";

type ExerciseFormEntry = {
  key: string;
  exercise_id?: string;
  exercise_name: string;
  category?: string;
  equipment?: string;
  sets: { reps: number; weight: number; completed: boolean }[];
  duration_seconds?: number;
  rest_seconds?: number;
  notes?: string;
  is_bodyweight: boolean;
};

type SessionFormData = {
  date: string;
  title: string;
  mode: "video_follow" | "free_training";
  training_type: string;
  location: string;
  duration_minutes: number | null;
  feeling: string;
  perceived_effort: number | null;
  notes: string;
  source_video_id?: string;
};

type WorkoutSessionFormProps = {
  exerciseLibrary: ExerciseLibraryItem[];
  sourceVideo?: { id: string; title: string | null; training_type: string | null; category: string | null } | null;
  initialData?: WorkoutSession | null;
  onSubmit: (data: SessionFormData, exercises: ExerciseFormEntry[]) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

let exerciseKeyCounter = 0;
function nextKey(): string {
  return `ex_${++exerciseKeyCounter}`;
}

const LOCATION_OPTIONS = ["", "居家", "健身房", "户外"];
const TRAINING_TYPES = ["", "力量训练", "塑形训练", "有氧燃脂", "HIIT", "拉伸", "瑜伽", "康复"];
const FEELING_OPTIONS = ["", "超棒", "不错", "一般", "疲惫", "酸痛"];
const EFFORT_OPTIONS = [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function sessionToFormData(session: WorkoutSession): SessionFormData {
  return {
    date: session.date,
    title: session.title || "",
    mode: session.mode,
    training_type: session.training_type || "",
    location: session.location || "",
    duration_minutes: session.duration_minutes,
    feeling: session.feeling || "",
    perceived_effort: session.perceived_effort,
    notes: session.notes || "",
    source_video_id: session.source_video_id || undefined,
  };
}

function exercisesToEntries(exercises?: WorkoutExercise[]): ExerciseFormEntry[] {
  if (!exercises || exercises.length === 0) return [];
  return exercises.map((ex) => ({
    key: nextKey(),
    exercise_id: ex.exercise_id || undefined,
    exercise_name: ex.exercise_name,
    category: ex.category || undefined,
    equipment: ex.equipment || undefined,
    sets: (ex.reps || []).map((r: RepSet) => ({
      reps: r.reps,
      weight: r.weight ?? ex.weight_kg ?? 0,
      completed: r.completed,
    })),
    duration_seconds: ex.duration_seconds || undefined,
    rest_seconds: ex.rest_seconds || undefined,
    notes: ex.notes || undefined,
    is_bodyweight: ex.is_bodyweight,
  }));
}

export default function WorkoutSessionForm({
  exerciseLibrary,
  sourceVideo,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: WorkoutSessionFormProps) {
  const [form, setForm] = useState<SessionFormData>(() => {
    if (initialData) return sessionToFormData(initialData);
    return {
      date: new Date().toISOString().split("T")[0],
      title: sourceVideo?.title || "",
      mode: sourceVideo ? "video_follow" : "free_training",
      training_type: sourceVideo?.training_type || "",
      location: "",
      duration_minutes: null,
      feeling: "",
      perceived_effort: null,
      notes: "",
      source_video_id: sourceVideo?.id,
    };
  });

  const [exercises, setExercises] = useState<ExerciseFormEntry[]>(() => {
    if (initialData) return exercisesToEntries(initialData.exercises);
    return [];
  });

  const [showSelector, setShowSelector] = useState(false);

  const updateField = (field: keyof SessionFormData, value: string | number | null) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const addExercise = useCallback((libEx: ExerciseLibraryItem) => {
    setExercises((prev) => [
      ...prev,
      {
        key: nextKey(),
        exercise_id: libEx.id,
        exercise_name: libEx.name,
        category: libEx.category,
        equipment: libEx.equipment || undefined,
        sets: [{ reps: 0, weight: 0, completed: false }],
        is_bodyweight: false,
      },
    ]);
    setShowSelector(false);
  }, []);

  const addCustomExercise = useCallback(() => {
    setExercises((prev) => [
      ...prev,
      {
        key: nextKey(),
        exercise_name: "",
        sets: [{ reps: 0, weight: 0, completed: false }],
        is_bodyweight: false,
      },
    ]);
  }, []);

  const removeExercise = (key: string) => {
    setExercises((prev) => prev.filter((e) => e.key !== key));
  };

  const updateExercise = (key: string, field: keyof ExerciseFormEntry, value: unknown) => {
    setExercises((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)),
    );
  };

  const updateSet = (exKey: string, setIdx: number, field: "reps" | "weight" | "completed", value: number | boolean) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.key !== exKey) return e;
        const newSets = e.sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s));
        return { ...e, sets: newSets };
      }),
    );
  };

  const addSet = (exKey: string) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.key !== exKey) return e;
        return { ...e, sets: [...e.sets, { reps: 0, weight: 0, completed: false }] };
      }),
    );
  };

  const removeSet = (exKey: string, setIdx: number) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.key !== exKey) return e;
        const newSets = e.sets.filter((_, i) => i !== setIdx);
        return { ...e, sets: newSets.length > 0 ? newSets : [{ reps: 0, weight: 0, completed: false }] };
      }),
    );
  };

  const handleSubmit = () => {
    onSubmit(form, exercises);
  };

  return (
    <div className="space-y-4">
      {/* Session metadata */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full",
            form.mode === "video_follow" ? "bg-accent-sky/10 text-accent-sky" : "bg-sage-light text-sage-deep",
          )}>
            {form.mode === "video_follow" ? "跟练模式" : "自由训练"}
          </span>
        </div>

        <input
          type="text"
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="训练标题，如：下肢力量日"
          className="w-full bg-transparent text-sm font-medium text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors"
          autoFocus
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-ink-lighter mb-0.5 block">日期</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => updateField("date", e.target.value)}
              className="w-full bg-transparent text-xs text-ink outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-ink-lighter mb-0.5 block">训练方式</label>
            <select
              value={form.training_type}
              onChange={(e) => updateField("training_type", e.target.value)}
              className="w-full bg-transparent text-xs text-ink outline-none border border-border rounded-xl px-2 py-2 focus:border-sage-deep/50 transition-colors"
            >
              {TRAINING_TYPES.map((t) => (
                <option key={t} value={t}>{t || "未选择"}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-ink-lighter mb-0.5 block">场地</label>
            <select
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
              className="w-full bg-transparent text-xs text-ink outline-none border border-border rounded-xl px-2 py-2 focus:border-sage-deep/50 transition-colors"
            >
              {LOCATION_OPTIONS.map((l) => (
                <option key={l} value={l}>{l || "未选择"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-ink-lighter mb-0.5 block">时长(分钟)</label>
            <input
              type="number"
              value={form.duration_minutes ?? ""}
              onChange={(e) => updateField("duration_minutes", e.target.value ? parseInt(e.target.value) : null)}
              placeholder="45"
              className="w-full bg-transparent text-xs text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-ink-lighter mb-0.5 block">自评强度(1-10)</label>
            <select
              value={form.perceived_effort ?? ""}
              onChange={(e) => updateField("perceived_effort", e.target.value ? parseInt(e.target.value) : null)}
              className="w-full bg-transparent text-xs text-ink outline-none border border-border rounded-xl px-2 py-2 focus:border-sage-deep/50 transition-colors"
            >
              <option value="">--</option>
              {EFFORT_OPTIONS.filter((e) => e !== null).map((e) => (
                <option key={e} value={e!}>{e}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="text-[10px] text-ink-lighter mb-0.5 block">感受</label>
            <div className="flex gap-1.5 flex-wrap">
              {FEELING_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => updateField("feeling", opt)}
                  className={cn(
                    "shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-medium transition-colors",
                    form.feeling === opt && opt !== ""
                      ? "bg-sage-light text-sage-deep"
                      : form.feeling === "" && opt === ""
                        ? "bg-sage-light text-sage-deep"
                        : "bg-ink/5 text-ink-light hover:bg-ink/10",
                  )}
                >
                  {opt || "无"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-ink-lighter mb-0.5 block">备注</label>
          <textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="训练心得、注意事项..."
            className="w-full bg-transparent text-xs text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 h-16 resize-none focus:border-sage-deep/50 transition-colors"
          />
        </div>
      </div>

      {/* Exercise list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-ink-lighter uppercase tracking-wider">
            训练动作 ({exercises.length})
          </p>
        </div>

        {exercises.map((ex) => (
          <div key={ex.key} className="bg-card rounded-2xl border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                {ex.exercise_id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{ex.exercise_name}</span>
                    {ex.category && (
                      <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-1.5 py-0.5">{ex.category}</span>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={ex.exercise_name}
                    onChange={(e) => updateExercise(ex.key, "exercise_name", e.target.value)}
                    placeholder="动作名称"
                    className="w-full bg-transparent text-sm font-medium text-ink placeholder:text-ink-lighter outline-none border border-border rounded-lg px-2.5 py-1.5 focus:border-sage-deep/50"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => updateExercise(ex.key, "is_bodyweight", !ex.is_bodyweight)}
                className={cn(
                  "text-[10px] font-medium px-2 py-1 rounded-full shrink-0 transition-colors",
                  ex.is_bodyweight ? "bg-accent-warm/10 text-accent-warm" : "bg-ink/5 text-ink-lighter",
                )}
              >
                自重
              </button>
              <button
                type="button"
                onClick={() => removeExercise(ex.key)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:text-accent-rose shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Sets editor */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[10px] text-ink-lighter font-medium px-1">
                <span>次数</span>
                <span>重量(kg)</span>
                <span className="w-10" />
              </div>
              {ex.sets.map((set, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] text-ink-lighter w-8 shrink-0">第{idx + 1}组</span>
                  <input
                    type="number"
                    value={set.reps || ""}
                    onChange={(e) => updateSet(ex.key, idx, "reps", e.target.value ? parseInt(e.target.value) : 0)}
                    placeholder="12"
                    className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-lighter outline-none border border-border rounded-lg px-2 py-1.5 focus:border-sage-deep/50"
                  />
                  <input
                    type="number"
                    value={set.weight || ""}
                    onChange={(e) => updateSet(ex.key, idx, "weight", e.target.value ? parseFloat(e.target.value) : 0)}
                    placeholder={ex.is_bodyweight ? "自重" : "20"}
                    disabled={ex.is_bodyweight}
                    className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-lighter outline-none border border-border rounded-lg px-2 py-1.5 focus:border-sage-deep/50 disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={() => updateSet(ex.key, idx, "completed", !set.completed)}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                      set.completed ? "bg-emerald-100 text-emerald-600" : "bg-ink/5 text-ink-lighter",
                    )}
                    title={set.completed ? "已完成" : "未完成"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSet(ex.key, idx)}
                    className="w-6 h-8 flex items-center justify-center text-ink-lighter hover:text-accent-rose shrink-0"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addSet(ex.key)}
                className="flex items-center gap-1 text-[10px] font-medium text-sage-deep hover:bg-sage-light/20 rounded-lg px-2 py-1 transition-colors"
              >
                <Plus size={10} />添加组
              </button>
            </div>

            {/* Exercise notes */}
            <input
              type="text"
              value={ex.notes || ""}
              onChange={(e) => updateExercise(ex.key, "notes", e.target.value)}
              placeholder="动作备注..."
              className="w-full bg-transparent text-[10px] text-ink placeholder:text-ink-lighter outline-none border border-border rounded-lg px-2.5 py-1.5 focus:border-sage-deep/50"
            />
          </div>
        ))}

        {/* Add exercise buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowSelector(true)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-sage-light/50 py-3 text-xs font-medium text-sage-deep hover:bg-sage-light/10 transition-colors"
          >
            <Search size={13} />从动作库选择
          </button>
          <button
            type="button"
            onClick={addCustomExercise}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border/50 py-3 text-xs font-medium text-ink-lighter hover:bg-ink/5 transition-colors"
          >
            <Plus size={13} />自定义动作
          </button>
        </div>
      </div>

      {/* Submit buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !form.title.trim()}
          className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors"
        >
          {isSubmitting ? "保存中..." : initialData ? "更新训练" : "保存训练"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 text-sm text-ink-light hover:bg-ink/5 rounded-xl transition-colors"
        >
          取消
        </button>
      </div>

      {/* Exercise selector modal */}
      {showSelector && (
        <ExerciseSelector
          exercises={exerciseLibrary}
          onSelect={addExercise}
          onClose={() => setShowSelector(false)}
        />
      )}
    </div>
  );
}
