import { useState } from "react";
import {
  Heart, Sparkles, Dumbbell, Utensils, Calendar, Loader2, Plus,
  Trash2, ExternalLink, Play, Flame, Target, Activity, Apple,
  ChevronLeft, ChevronRight, Star, Clock, Zap, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBodyProfile, useUpdateBodyProfile,
  useWorkoutVideos, useCreateWorkoutVideo, useUpdateWorkoutVideo, useDeleteWorkoutVideo,
  useRecipes, useCreateRecipe, useUpdateRecipe, useDeleteRecipe,
  useMealPlans, useUpsertMealPlan,
  useHealthContext, useCoachInsight, useGenerateCoachInsight,
  useWorkoutRecords, useCreateWorkoutRecord, useDeleteWorkoutRecord,
  useFoodRecords, useCreateFoodRecord, useDeleteFoodRecord,
  type WorkoutVideo, type Recipe, type MealPlan, type MealPlanSlot,
} from "@/lib/hooks/useHealth";

// ── Constants ──

const WORKOUT_CATEGORIES = [
  { key: "all", label: "全部" },
  { key: "臀腿", label: "臀腿" },
  { key: "背部", label: "背部" },
  { key: "肩胸", label: "肩胸" },
  { key: "核心", label: "核心" },
  { key: "有氧", label: "有氧" },
  { key: "拉伸", label: "拉伸" },
] as const;

const RECIPE_FILTERS = [
  { key: "all", label: "全部" },
  { key: "breakfast", label: "早餐" },
  { key: "lunch", label: "午餐" },
  { key: "dinner", label: "晚餐" },
  { key: "高蛋白", label: "高蛋白" },
  { key: "减脂", label: "减脂" },
] as const;

const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
const MEAL_LABELS: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };
const MEAL_ICONS: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙" };

const DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

type Tab = "coach" | "workout" | "recipe" | "plan";

function today() { return new Date().toISOString().split("T")[0]; }

function getWeekMonday(date?: Date): string {
  const t = date || new Date();
  const dow = t.getDay();
  const mon = new Date(t);
  mon.setDate(t.getDate() - (dow === 0 ? 6 : dow - 1));
  return mon.toISOString().split("T")[0];
}

function formatWeekRange(mondayStr: string): string {
  const mon = new Date(mondayStr + "T00:00:00");
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.toISOString().split("T")[0]} → ${sun.toISOString().split("T")[0]}`;
}

// ── Page ──

export default function Health() {
  const [tab, setTab] = useState<Tab>("coach");

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-ink-lighter">健康管理</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Health OS</h1>
      </header>

      {/* Tab bar */}
      <div className="flex bg-ink/5 rounded-xl p-1">
        {([
          { key: "coach" as Tab, label: "今日建议", icon: Sparkles },
          { key: "workout" as Tab, label: "训练库", icon: Dumbbell },
          { key: "recipe" as Tab, label: "食谱库", icon: Utensils },
          { key: "plan" as Tab, label: "周计划", icon: Calendar },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all",
              tab === key ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
            )}
          >
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {tab === "coach" && <CoachTab />}
      {tab === "workout" && <WorkoutLibraryTab />}
      {tab === "recipe" && <RecipeBoxTab />}
      {tab === "plan" && <WeeklyPlanTab />}
    </div>
  );
}

// ── Tab 1: AI Coach ──

function CoachTab() {
  const { data: ctx, isLoading: loadingCtx } = useHealthContext();
  const { data: insight } = useCoachInsight();
  const generateInsight = useGenerateCoachInsight();
  const updateProfile = useUpdateBodyProfile();

  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    weight: null as number | null,
    body_fat_percentage: null as number | null,
    target_weight: null as number | null,
    fitness_goal: "",
    notes: "",
  });
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Sync profile form once
  if (ctx?.bodyProfile && !profileLoaded) {
    const bp = ctx.bodyProfile;
    setProfileForm({
      weight: bp.weight,
      body_fat_percentage: bp.body_fat_percentage,
      target_weight: bp.target_weight,
      fitness_goal: bp.fitness_goal || "",
      notes: bp.notes || "",
    });
    setProfileLoaded(true);
  }

  const handleSaveProfile = () => {
    updateProfile.mutate(profileForm);
  };

  if (loadingCtx) {
    return <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-sage-deep" /></div>;
  }

  const insightData = insight?.data as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      {/* AI Insight Card */}
      <div className="bg-gradient-to-br from-sage-light/5 to-white border border-sage-light/30 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-sage-light flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-sage-deep" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">今日健康建议</p>
            {insight ? (
              <div className="mt-2 space-y-2">
                {insightData?.training_advice ? (
                  <div className="flex items-start gap-2">
                    <Dumbbell size={14} className="text-accent-sky mt-0.5 shrink-0" />
                    <p className="text-xs text-ink-light leading-relaxed">{String(insightData.training_advice)}</p>
                  </div>
                ) : null}
                {insightData?.diet_advice ? (
                  <div className="flex items-start gap-2">
                    <Apple size={14} className="text-accent-rose mt-0.5 shrink-0" />
                    <p className="text-xs text-ink-light leading-relaxed">{String(insightData.diet_advice)}</p>
                  </div>
                ) : null}
                {insightData?.warnings ? (
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-accent-warm mt-0.5 shrink-0" />
                    <p className="text-xs text-ink-light leading-relaxed">{String(insightData.warnings)}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-ink-lighter mt-1.5">
                根据你的运动、饮食和身体数据，AI 会生成今日训练和饮食建议。
              </p>
            )}
            <button
              onClick={() => generateInsight.mutate()}
              disabled={generateInsight.isPending}
              className="mt-3 flex items-center gap-2 bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors"
            >
              {generateInsight.isPending ? (
                <><Loader2 size={12} className="animate-spin" />分析中...</>
              ) : (
                <><Sparkles size={12} />{insight ? "重新生成建议" : "生成今日建议"}</>
              )}
            </button>
            {generateInsight.error && (
              <p className="text-xs text-accent-rose mt-1">{(generateInsight.error as Error).message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card rounded-2xl border border-border p-3 text-center">
          <Activity size={14} className="text-accent-sky mx-auto mb-1" />
          <p className="text-lg font-bold text-ink">{ctx?.workoutsThisWeek ?? 0}</p>
          <p className="text-[10px] text-ink-lighter">本周运动/天</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-3 text-center">
          <Flame size={14} className="text-accent-warm mx-auto mb-1" />
          <p className="text-lg font-bold text-ink">{ctx?.workoutStreak ?? 0}</p>
          <p className="text-[10px] text-ink-lighter">连续运动/天</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-3 text-center">
          <Target size={14} className="text-sage-deep mx-auto mb-1" />
          <p className="text-lg font-bold text-ink">{ctx?.bodyProfile?.weight ?? "--"}</p>
          <p className="text-[10px] text-ink-lighter">体重/kg</p>
        </div>
      </div>

      {/* Body profile (collapsed by default) */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-card-hover transition-colors"
        >
          <span className="text-xs font-semibold text-ink-lighter uppercase tracking-wider">身体档案</span>
          <span className="text-[10px] text-ink-lighter">{showProfile ? "收起" : "编辑"}</span>
        </button>
        {showProfile && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="体重 (kg)" value={profileForm.weight} onChange={(v) => setProfileForm((f) => ({ ...f, weight: v }))} placeholder="68" />
              <NumberField label="目标体重 (kg)" value={profileForm.target_weight} onChange={(v) => setProfileForm((f) => ({ ...f, target_weight: v }))} placeholder="62" />
              <NumberField label="体脂率 (%)" value={profileForm.body_fat_percentage} onChange={(v) => setProfileForm((f) => ({ ...f, body_fat_percentage: v }))} placeholder="22" />
              <TextField label="健身目标" value={profileForm.fitness_goal} onChange={(v) => setProfileForm((f) => ({ ...f, fitness_goal: v }))} placeholder="减脂/增肌" />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={updateProfile.isPending}
              className="flex items-center gap-2 bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors"
            >
              {updateProfile.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              保存
            </button>
          </div>
        )}
      </div>

      {/* Today's quick log */}
      <QuickLog />
    </div>
  );
}

// ── Quick Workout/Food Log ──

function QuickLog() {
  const date = today();
  const { data: workoutRecords } = useWorkoutRecords(date);
  const { data: foodRecords } = useFoodRecords(date);
  const createWorkout = useCreateWorkoutRecord();
  const deleteWorkout = useDeleteWorkoutRecord();
  const createFood = useCreateFoodRecord();
  const deleteFood = useDeleteFoodRecord();

  const [logType, setLogType] = useState<"workout" | "food" | null>(null);
  const [workoutForm, setWorkoutForm] = useState({ exercise_name: "", duration_minutes: null as number | null, notes: "" });
  const [foodForm, setFoodForm] = useState({ meal_type: "breakfast", food_name: "", notes: "" });

  return (
    <div className="space-y-2">
      {/* Quick action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setLogType(logType === "workout" ? null : "workout")}
          className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors", logType === "workout" ? "bg-accent-sky/10 text-accent-sky" : "bg-card border border-border text-ink-light hover:text-ink")}
        >
          <Dumbbell size={12} />记录训练
        </button>
        <button
          onClick={() => setLogType(logType === "food" ? null : "food")}
          className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors", logType === "food" ? "bg-accent-rose/10 text-accent-rose" : "bg-card border border-border text-ink-light hover:text-ink")}
        >
          <Apple size={12} />记录饮食
        </button>
      </div>

      {/* Workout form */}
      {logType === "workout" && (
        <div className="bg-card rounded-2xl border border-border p-3 space-y-2">
          <input
            type="text" value={workoutForm.exercise_name}
            onChange={(e) => setWorkoutForm((f) => ({ ...f, exercise_name: e.target.value }))}
            placeholder="训练内容，如：背部力量训练"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors"
            autoFocus
          />
          <div className="flex gap-2">
            <input
              type="number" value={workoutForm.duration_minutes ?? ""}
              onChange={(e) => setWorkoutForm((f) => ({ ...f, duration_minutes: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="分钟" className="w-24 bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors"
            />
            <button
              onClick={() => {
                if (!workoutForm.exercise_name.trim()) return;
                createWorkout.mutate({ date, exercise_name: workoutForm.exercise_name.trim(), duration_minutes: workoutForm.duration_minutes ?? undefined, notes: workoutForm.notes || undefined }, {
                  onSuccess: () => { setWorkoutForm({ exercise_name: "", duration_minutes: null, notes: "" }); setLogType(null); },
                });
              }}
              disabled={!workoutForm.exercise_name.trim() || createWorkout.isPending}
              className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2 text-xs font-semibold disabled:opacity-50"
            >
              {createWorkout.isPending ? "..." : "保存"}
            </button>
          </div>
        </div>
      )}

      {/* Food form */}
      {logType === "food" && (
        <div className="bg-card rounded-2xl border border-border p-3 space-y-2">
          <div className="flex gap-1">
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt}
                onClick={() => setFoodForm((f) => ({ ...f, meal_type: mt }))}
                className={cn("flex-1 py-1.5 rounded-lg text-[11px] font-medium", foodForm.meal_type === mt ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light")}
              >
                {MEAL_ICONS[mt]} {MEAL_LABELS[mt]}
              </button>
            ))}
          </div>
          <input
            type="text" value={foodForm.food_name}
            onChange={(e) => setFoodForm((f) => ({ ...f, food_name: e.target.value }))}
            placeholder="吃了什么？"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors"
            autoFocus
          />
          <button
            onClick={() => {
              if (!foodForm.food_name.trim()) return;
              createFood.mutate({ date, meal_type: foodForm.meal_type, food_name: foodForm.food_name.trim(), notes: foodForm.notes || undefined }, {
                onSuccess: () => { setFoodForm({ meal_type: "breakfast", food_name: "", notes: "" }); setLogType(null); },
              });
            }}
            disabled={!foodForm.food_name.trim() || createFood.isPending}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2 text-xs font-semibold disabled:opacity-50"
          >
            {createFood.isPending ? "保存中..." : "保存"}
          </button>
        </div>
      )}

      {/* Today's records list */}
      {((workoutRecords?.length ?? 0) > 0 || (foodRecords?.length ?? 0) > 0) && (
        <div className="bg-card rounded-2xl border border-border p-3 space-y-2">
          {(workoutRecords || []).map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5"><Dumbbell size={11} className="text-accent-sky" />{r.exercise_name}{r.duration_minutes ? ` · ${r.duration_minutes}分钟` : ""}</span>
              <button onClick={() => deleteWorkout.mutate(r.id)} className="text-ink-lighter hover:text-accent-rose"><Trash2 size={11} /></button>
            </div>
          ))}
          {(foodRecords || []).map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5"><Apple size={11} className="text-accent-rose" />{MEAL_LABELS[r.meal_type] || r.meal_type} · {r.food_name}</span>
              <button onClick={() => deleteFood.mutate(r.id)} className="text-ink-lighter hover:text-accent-rose"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Workout Library ──

function WorkoutLibraryTab() {
  const { data: videos, isLoading } = useWorkoutVideos();
  const createVideo = useCreateWorkoutVideo();
  const updateVideo = useUpdateWorkoutVideo();
  const deleteVideo = useDeleteWorkoutVideo();

  const [category, setCategory] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", category: "", difficulty: "", estimated_duration: null as number | null });

  const filtered = category === "all"
    ? (videos || [])
    : (videos || []).filter((v) => v.category === category || v.training_type === category);

  const handleAdd = () => {
    if (!url.trim()) return;
    createVideo.mutate({ url: url.trim() }, { onSuccess: () => { setUrl(""); setShowAdd(false); } });
  };

  const startEdit = (v: WorkoutVideo) => {
    setEditingId(v.id);
    setEditForm({ title: v.title || "", category: v.category || "", difficulty: v.difficulty || "", estimated_duration: v.estimated_duration });
  };

  const saveEdit = (id: string) => {
    updateVideo.mutate({ id, ...editForm, estimated_duration: editForm.estimated_duration ?? undefined }, { onSuccess: () => setEditingId(null) });
  };

  const getPlatformBadge = (platform: string) => {
    const map: Record<string, string> = { bilibili: "B站", douyin: "抖音", youtube: "YT", xiaohongshu: "小红书" };
    return map[platform] || platform;
  };

  return (
    <div className="space-y-3">
      {/* Add button */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sage-light/50 py-3.5 text-sm text-sage-deep hover:bg-sage-light/10 transition-colors">
          <Plus size={15} />添加健身视频
        </button>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-3 space-y-2">
          <input
            type="url" value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴抖音/B站视频链接..."
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!url.trim() || createVideo.isPending} className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
              {createVideo.isPending ? "添加中..." : "保存链接"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 text-sm text-ink-light hover:bg-ink/5 rounded-xl">取消</button>
          </div>
          {createVideo.error && <p className="text-xs text-accent-rose">{(createVideo.error as Error).message}</p>}
          <p className="text-[10px] text-ink-lighter">添加后点击卡片可编辑标题、分类等信息。AI 自动解析功能即将上线。</p>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {WORKOUT_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={cn("shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors", category === c.key ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10")}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Video list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-sage-deep" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10">
          <Dumbbell size={32} className="text-ink-lighter mx-auto mb-3 opacity-25" />
          <p className="text-sm text-ink-lighter">训练库为空</p>
          <p className="text-xs text-ink-lighter mt-1">添加抖音或B站健身视频，替代收藏夹</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => (
            <div key={v.id} className="bg-card rounded-2xl border border-border p-3.5 hover:border-sage-light/30 transition-colors group">
              {editingId === v.id ? (
                /* Edit mode */
                <div className="space-y-2">
                  <input type="text" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} placeholder="视频标题" className="w-full bg-transparent text-sm text-ink outline-none border border-border rounded-lg px-2.5 py-1.5" autoFocus />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} className="bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2 py-1.5">
                      <option value="">选择分类</option>
                      {WORKOUT_CATEGORIES.filter((c) => c.key !== "all").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <select value={editForm.difficulty} onChange={(e) => setEditForm((f) => ({ ...f, difficulty: e.target.value }))} className="bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2 py-1.5">
                      <option value="">难度</option>
                      <option value="初级">初级</option><option value="中级">中级</option><option value="高级">高级</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(v.id)} className="flex-1 bg-sage-light text-sage-deep rounded-lg py-1.5 text-xs font-semibold">保存</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-ink-light hover:bg-ink/5 rounded-lg">取消</button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-accent-sky/10 flex items-center justify-center shrink-0">
                    <Play size={14} className="text-accent-sky" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{v.title || "未命名视频"}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-1.5 py-0.5">{getPlatformBadge(v.platform)}</span>
                          {v.category && <span className="text-[10px] text-accent-sky bg-accent-sky/5 rounded-full px-1.5 py-0.5">{v.category}</span>}
                          {v.estimated_duration && <span className="text-[10px] text-ink-lighter flex items-center gap-0.5"><Clock size={9} />{v.estimated_duration}分钟</span>}
                          {v.difficulty && <span className="text-[10px] text-ink-lighter">{v.difficulty}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => startEdit(v)} className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5" title="编辑">
                          <Star size={12} />
                        </button>
                        <button onClick={() => deleteVideo.mutate(v.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:text-accent-rose" title="删除">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-sage-deep font-medium hover:underline">
                      <ExternalLink size={11} />打开视频训练
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Recipe Box ──

function RecipeBoxTab() {
  const { data: recipes, isLoading } = useRecipes();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();

  const [filter, setFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", category: "", goal: "", calories_per_serving: null as number | null, protein_grams: null as number | null, ingredients: "" });

  const filtered = (recipes || []).filter((r) => {
    if (filter === "all") return true;
    if (filter === "高蛋白") return (r.protein_grams ?? 0) >= 25;
    if (filter === "减脂") return r.goal === "减脂" || r.category === "减脂";
    return (r.meal_time || []).includes(filter);
  });

  // Today's recommendations: pick 3 recipes (one per meal type)
  const todayPicks = (recipes || []).filter((r) => r.is_favorite).slice(0, 3);

  const handleAdd = () => {
    if (!url.trim()) return;
    createRecipe.mutate({ source_url: url.trim() }, { onSuccess: () => { setUrl(""); setShowAdd(false); } });
  };

  const startEdit = (r: Recipe) => {
    setEditingId(r.id);
    setEditForm({ name: r.name || "", category: r.category || "", goal: r.goal || "", calories_per_serving: r.calories_per_serving, protein_grams: r.protein_grams, ingredients: r.ingredients || "" });
  };

  const saveEdit = (id: string) => {
    const update: Record<string, unknown> = { name: editForm.name, category: editForm.category, goal: editForm.goal, calories_per_serving: editForm.calories_per_serving ?? undefined, protein_grams: editForm.protein_grams ?? undefined, ingredients: editForm.ingredients || undefined };
    updateRecipe.mutate({ id, ...update } as never, { onSuccess: () => setEditingId(null) });
  };

  const getPlatformBadge = (platform: string | null) => {
    const map: Record<string, string> = { bilibili: "B站", douyin: "抖音", xiaohongshu: "小红书", youtube: "YT" };
    return map[platform || ""] || platform || "web";
  };

  return (
    <div className="space-y-3">
      {/* Today's picks */}
      {todayPicks.length > 0 && (
        <div className="bg-gradient-to-r from-accent-rose/5 to-white border border-accent-rose/10 rounded-2xl p-4">
          <p className="text-xs font-semibold text-accent-rose mb-2 flex items-center gap-1.5"><Sparkles size={12} />今日推荐</p>
          <div className="space-y-1.5">
            {todayPicks.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-ink font-medium">{r.name}</span>
                <span className="text-[11px] text-ink-lighter">{r.calories_per_serving ? `${r.calories_per_serving}千卡` : ""}{r.protein_grams ? ` · ${r.protein_grams}g蛋白` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add button */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sage-light/50 py-3.5 text-sm text-sage-deep hover:bg-sage-light/10 transition-colors">
          <Plus size={15} />添加食谱链接
        </button>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-3 space-y-2">
          <input
            type="url" value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴抖音/小红书/B站食谱链接..."
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!url.trim() || createRecipe.isPending} className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
              {createRecipe.isPending ? "添加中..." : "保存链接"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 text-sm text-ink-light hover:bg-ink/5 rounded-xl">取消</button>
          </div>
          {createRecipe.error && <p className="text-xs text-accent-rose">{(createRecipe.error as Error).message}</p>}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {RECIPE_FILTERS.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={cn("shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors", filter === c.key ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10")}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Recipe list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-sage-deep" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10">
          <Utensils size={32} className="text-ink-lighter mx-auto mb-3 opacity-25" />
          <p className="text-sm text-ink-lighter">食谱库为空</p>
          <p className="text-xs text-ink-lighter mt-1">收藏减脂食谱视频，AI 帮你解析营养信息</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="bg-card rounded-2xl border border-border p-3.5 hover:border-sage-light/30 transition-colors group">
              {editingId === r.id ? (
                <div className="space-y-2">
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="食谱名称" className="w-full bg-transparent text-sm text-ink outline-none border border-border rounded-lg px-2.5 py-1.5" autoFocus />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} className="bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2 py-1.5">
                      <option value="">分类</option>
                      <option value="高蛋白">高蛋白</option><option value="减脂">减脂</option><option value="快手">快手</option>
                    </select>
                    <select value={editForm.goal} onChange={(e) => setEditForm((f) => ({ ...f, goal: e.target.value }))} className="bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2 py-1.5">
                      <option value="">适合目标</option>
                      <option value="减脂">减脂</option><option value="增肌">增肌</option><option value="保持">保持</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={editForm.calories_per_serving ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, calories_per_serving: e.target.value ? parseInt(e.target.value) : null }))} placeholder="热量(千卡)" className="bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2.5 py-1.5" />
                    <input type="number" value={editForm.protein_grams ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, protein_grams: e.target.value ? parseInt(e.target.value) : null }))} placeholder="蛋白质(g)" className="bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2.5 py-1.5" />
                  </div>
                  <textarea value={editForm.ingredients} onChange={(e) => setEditForm((f) => ({ ...f, ingredients: e.target.value }))} placeholder="食材清单" className="w-full bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2.5 py-1.5 h-14 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(r.id)} className="flex-1 bg-sage-light text-sage-deep rounded-lg py-1.5 text-xs font-semibold">保存</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-ink-light hover:bg-ink/5 rounded-lg">取消</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0">
                    {r.category === "高蛋白" ? "🥩" : r.category === "减脂" ? "🥗" : "🍳"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{r.name || "未命名食谱"}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {r.source_platform && <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-1.5 py-0.5">{getPlatformBadge(r.source_platform)}</span>}
                          {r.calories_per_serving && <span className="text-[10px] text-ink-lighter">{r.calories_per_serving}千卡</span>}
                          {r.protein_grams && <span className="text-[10px] text-accent-sky bg-accent-sky/5 rounded-full px-1.5 py-0.5">{r.protein_grams}g蛋白</span>}
                          {r.goal && <span className="text-[10px] text-accent-rose bg-accent-rose/5 rounded-full px-1.5 py-0.5">{r.goal}</span>}
                          {r.meal_time && r.meal_time.map((mt) => <span key={mt} className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-1.5 py-0.5">{MEAL_LABELS[mt] || mt}</span>)}
                        </div>
                        {r.ingredients && <p className="text-[11px] text-ink-light mt-1.5 line-clamp-1">食材: {r.ingredients}</p>}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => startEdit(r)} className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5" title="编辑"><Star size={12} /></button>
                        <button onClick={() => deleteRecipe.mutate(r.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:text-accent-rose" title="删除"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    {r.source_url && (
                      <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-sage-deep font-medium hover:underline">
                        <ExternalLink size={10} />查看视频
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Weekly Plan ──

function WeeklyPlanTab() {
  const [weekMonday, setWeekMonday] = useState(getWeekMonday());
  const { data: mealPlans, isLoading } = useMealPlans(weekMonday);
  const { data: recipes } = useRecipes();
  const upsertPlan = useUpsertMealPlan();

  const [editingSlot, setEditingSlot] = useState<{ day: number; meal: string } | null>(null);
  const [customMeal, setCustomMeal] = useState("");

  const weekMondayDate = new Date(weekMonday + "T00:00:00");

  const prevWeek = () => {
    const d = new Date(weekMondayDate);
    d.setDate(d.getDate() - 7);
    setWeekMonday(d.toISOString().split("T")[0]);
  };

  const nextWeek = () => {
    const d = new Date(weekMondayDate);
    d.setDate(d.getDate() + 7);
    setWeekMonday(d.toISOString().split("T")[0]);
  };

  // Build a map: `${day}-${meal}` → plan
  const planMap = new Map<string, MealPlan>();
  for (const p of (mealPlans || [])) {
    planMap.set(`${p.day_of_week}-${p.meal_type}`, p);
  }

  const getRecipe = (recipeId: string | null) => {
    if (!recipeId) return null;
    return (recipes || []).find((r) => r.id === recipeId) || null;
  };

  const setMeal = (day: number, meal: string, recipeId: string | null, custom: string | null) => {
    upsertPlan.mutate({ week_start: weekMonday, day_of_week: day, meal_type: meal, recipe_id: recipeId, custom_meal: custom || undefined });
    setEditingSlot(null);
    setCustomMeal("");
  };

  const clearMeal = (day: number, meal: string) => {
    const existing = planMap.get(`${day}-${meal}`);
    if (existing?.recipe_id) {
      // Clear recipe, keep slot with nothing
      upsertPlan.mutate({ week_start: weekMonday, day_of_week: day, meal_type: meal, recipe_id: null, custom_meal: undefined });
    }
  };

  return (
    <div className="space-y-3">
      {/* Week selector */}
      <div className="flex items-center justify-between bg-card rounded-2xl border border-border px-3 py-2.5">
        <button onClick={prevWeek} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors"><ChevronLeft size={16} className="text-ink-light" /></button>
        <p className="text-sm font-semibold text-ink">{formatWeekRange(weekMonday)}</p>
        <button onClick={nextWeek} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors"><ChevronRight size={16} className="text-ink-light" /></button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-sage-deep" /></div>
      ) : (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <div key={day} className="bg-card rounded-2xl border border-border p-3">
              <p className="text-xs font-semibold text-ink-lighter mb-2">{DAY_LABELS[day - 1]}</p>
              <div className="grid grid-cols-3 gap-2">
                {MEAL_TYPES.map((meal) => {
                  const slot = planMap.get(`${day}-${meal}`);
                  const recipe = getRecipe(slot?.recipe_id || null);
                  const isEditing = editingSlot?.day === day && editingSlot?.meal === meal;

                  return (
                    <div key={meal} className="relative">
                      <button
                        onClick={() => setEditingSlot(isEditing ? null : { day, meal })}
                        className={cn(
                          "w-full rounded-xl border p-2 text-left min-h-[56px] transition-colors hover:border-sage-light/50",
                          slot ? "border-sage-light/30 bg-sage-light/5" : "border-dashed border-border/50",
                        )}
                      >
                        <p className="text-[10px] text-ink-lighter mb-0.5">{MEAL_ICONS[meal]} {MEAL_LABELS[meal]}</p>
                        {recipe ? (
                          <p className="text-[11px] font-medium text-ink leading-tight line-clamp-2">{recipe.name}</p>
                        ) : slot?.custom_meal ? (
                          <p className="text-[11px] font-medium text-ink leading-tight line-clamp-2">{slot.custom_meal}</p>
                        ) : (
                          <p className="text-[11px] text-ink-lighter">+ 添加</p>
                        )}
                      </button>

                      {/* Edit popup */}
                      {isEditing && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl p-2 shadow-lg z-10 space-y-1.5">
                          <p className="text-[10px] text-ink-lighter font-medium">{DAY_LABELS[day - 1]} {MEAL_LABELS[meal]}</p>
                          {/* Quick pick from recipes */}
                          <div className="max-h-32 overflow-y-auto space-y-0.5">
                            {(recipes || []).slice(0, 8).map((r) => (
                              <button
                                key={r.id}
                                onClick={() => setMeal(day, meal, r.id, null)}
                                className="w-full text-left px-2 py-1 rounded-lg hover:bg-sage-light/20 text-[11px] text-ink transition-colors"
                              >
                                {r.name} {r.calories_per_serving ? `· ${r.calories_per_serving}千卡` : ""}
                              </button>
                            ))}
                          </div>
                          {/* Custom input */}
                          <div className="flex gap-1">
                            <input
                              type="text" value={customMeal}
                              onChange={(e) => setCustomMeal(e.target.value)}
                              placeholder="自定义..."
                              className="flex-1 bg-transparent text-[11px] text-ink placeholder:text-ink-lighter outline-none border border-border rounded-lg px-2 py-1"
                              onKeyDown={(e) => { if (e.key === "Enter" && customMeal.trim()) setMeal(day, meal, null, customMeal.trim()); }}
                            />
                            <button
                              onClick={() => customMeal.trim() && setMeal(day, meal, null, customMeal.trim())}
                              className="px-2 py-1 bg-sage-light text-sage-deep rounded-lg text-[10px] font-semibold"
                            >
                              确定
                            </button>
                          </div>
                          {slot && (
                            <button onClick={() => { clearMeal(day, meal); }} className="w-full text-[10px] text-accent-rose hover:bg-accent-rose/5 rounded-lg py-1">清除</button>
                          )}
                          <button onClick={() => setEditingSlot(null)} className="w-full text-[10px] text-ink-lighter hover:bg-ink/5 rounded-lg py-1">关闭</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Form field helpers ──

function NumberField({ label, value, onChange, placeholder }: {
  label: string; value: number | null; onChange: (v: number | null) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-medium text-ink-lighter mb-0.5 block">{label}</label>
      <input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))} placeholder={placeholder}
        className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors" />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-medium text-ink-lighter mb-0.5 block">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors" />
    </div>
  );
}
