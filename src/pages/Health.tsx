import { useState, useMemo, useCallback } from "react";
import {
  Heart, Sparkles, Dumbbell, Utensils, Calendar, Loader2, Plus,
  Trash2, ExternalLink, Play, Flame, Target, Activity, Apple,
  ChevronLeft, ChevronRight, Star, Clock, Zap, AlertTriangle, CheckCircle2,
  Image, X, ArrowRight, Trophy, Brain, Search, RotateCw, SlidersHorizontal,
  BookOpen, ChefHat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import VideoPlayer from "@/components/health/VideoPlayer";
import WorkoutJournalTab from "@/components/health/WorkoutJournalTab";
import RecipeDetailModal from "@/components/health/RecipeDetailModal";
import FoodJournalTab from "@/components/health/FoodJournalTab";
import {
  useBodyProfile, useUpdateBodyProfile,
  useWorkoutVideos, useCreateWorkoutVideo, useUpdateWorkoutVideo, useDeleteWorkoutVideo, useRetryWorkoutAnalysis,
  useRecipes, useCreateRecipe, useUpdateRecipe, useDeleteRecipe, useRetryRecipeAnalysis,
  useMealPlans, useUpsertMealPlan,
  useHealthContext, useCoachInsight, useGenerateCoachInsight,
  useWorkoutRecords, useCreateWorkoutRecord, useDeleteWorkoutRecord,
  useFoodRecords, useCreateFoodRecord, useDeleteFoodRecord,
  useMealAnalysis, useGenerateMealAnalysis,
  useHealthGoals,
  useExerciseLibrary,
  useWorkoutSessions, useWorkoutSession, useCreateWorkoutSession, useUpdateWorkoutSession, useDeleteWorkoutSession,
  type WorkoutVideo, type Recipe, type RecipeIngredient, type RecipeStep, type RecipeSourceType, type MealPlan, type MealPlanSlot, type FoodRecord,
  type WorkoutSession, type WorkoutSessionInput,
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

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_LABELS: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
const MEAL_ICONS: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍪" };
const FEELING_OPTIONS = [
  { key: "", label: "无" },
  { key: "饱", label: "饱" },
  { key: "刚好", label: "刚好" },
  { key: "还饿", label: "还饿" },
  { key: "撑", label: "撑" },
] as const;

const DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

type Tab = "coach" | "workout" | "diet" | "plan" | "goals";
type WorkoutSubTab = "library" | "journal";
type DietSubTab = "journal" | "recipe";

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
  const [workoutSubTab, setWorkoutSubTab] = useState<WorkoutSubTab>("library");
  const [dietSubTab, setDietSubTab] = useState<DietSubTab>("journal");

  // Shared state for "start training from video"
  const [startFromVideo, setStartFromVideo] = useState<WorkoutVideo | null>(null);

  const handleStartFromVideo = useCallback((video: WorkoutVideo) => {
    setStartFromVideo(video);
    setTab("workout");
    setWorkoutSubTab("journal");
  }, []);

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
          { key: "workout" as Tab, label: "训练", icon: Dumbbell },
          { key: "diet" as Tab, label: "饮食", icon: Apple },
          { key: "plan" as Tab, label: "周计划", icon: Calendar },
          { key: "goals" as Tab, label: "健康目标", icon: Target },
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
      {tab === "workout" && (
        <div className="space-y-3">
          {/* Sub-tabs */}
          <div className="flex bg-ink/5 rounded-xl p-1">
            <button
              onClick={() => setWorkoutSubTab("library")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                workoutSubTab === "library" ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
              )}
            >
              <Dumbbell size={12} />训练库
            </button>
            <button
              onClick={() => setWorkoutSubTab("journal")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                workoutSubTab === "journal" ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
              )}
            >
              <BookOpen size={12} />训练日志
            </button>
          </div>
          {workoutSubTab === "library" ? (
            <WorkoutLibraryTab onStartTraining={handleStartFromVideo} />
          ) : (
            <WorkoutJournalSection startFromVideo={startFromVideo} onConsumedVideo={() => setStartFromVideo(null)} />
          )}
        </div>
      )}
      {tab === "diet" && (
        <div className="space-y-3">
          {/* Sub-tabs */}
          <div className="flex bg-ink/5 rounded-xl p-1">
            <button
              onClick={() => setDietSubTab("journal")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                dietSubTab === "journal" ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
              )}
            >
              <Apple size={12} />饮食日志
            </button>
            <button
              onClick={() => setDietSubTab("recipe")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                dietSubTab === "recipe" ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
              )}
            >
              <Utensils size={12} />食谱库
            </button>
          </div>
          {dietSubTab === "journal" ? <FoodJournalTab /> : <RecipeBoxTab />}
        </div>
      )}
      {tab === "plan" && <WeeklyPlanTab />}
      {tab === "goals" && <GoalsTab />}
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
  const generateAnalysis = useGenerateMealAnalysis();

  const [logType, setLogType] = useState<"workout" | "food" | null>(null);
  const [workoutForm, setWorkoutForm] = useState({ exercise_name: "", duration_minutes: null as number | null, notes: "" });
  const [foodForm, setFoodForm] = useState({
    meal_type: "breakfast" as string,
    food_name: "",
    portion: "",
    feeling: "",
    record_time: "",
  });
  const [analyzingMeal, setAnalyzingMeal] = useState<string | null>(null);
  const [mealAnalysisError, setMealAnalysisError] = useState<Record<string, string>>({});
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Group food records by meal type
  const foodsByMeal = (foodRecords || []).reduce<Record<string, typeof foodRecords>>((acc, r) => {
    const mt = r.meal_type || "other";
    if (!acc[mt]) acc[mt] = [];
    acc[mt].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
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
            placeholder="吃了什么？如：番茄炒蛋 + 米饭"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors"
            autoFocus
          />
          <div className="flex gap-2">
            <input
              type="text" value={foodForm.portion}
              onChange={(e) => setFoodForm((f) => ({ ...f, portion: e.target.value }))}
              placeholder="份量，如：1碗、半盘"
              className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors"
            />
            <input
              type="time" value={foodForm.record_time}
              onChange={(e) => setFoodForm((f) => ({ ...f, record_time: e.target.value }))}
              className="w-28 bg-transparent text-xs text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-2 py-2 focus:border-sage-deep/50 transition-colors"
            />
          </div>
          <div className="flex gap-1.5">
            {FEELING_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFoodForm((f) => ({ ...f, feeling: opt.key }))}
                className={cn(
                  "flex-1 py-1 rounded-lg text-[10px] font-medium transition-colors",
                  foodForm.feeling === opt.key
                    ? "bg-accent-rose/10 text-accent-rose"
                    : opt.key === "" && foodForm.feeling === ""
                      ? "bg-ink/5 text-ink-light"
                      : "bg-ink/5 text-ink-light hover:bg-ink/10",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Image picker */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                className="hidden"
                id="food-image-input"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  const remaining = 3 - imageFiles.length;
                  const toAdd = files.slice(0, remaining);
                  setImageFiles((prev) => [...prev, ...toAdd].slice(0, 3));
                  for (const f of toAdd) {
                    setImagePreviews((prev) => [...prev, URL.createObjectURL(f)].slice(0, 3));
                  }
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => document.getElementById("food-image-input")?.click()}
                disabled={imageFiles.length >= 3}
                className="flex items-center gap-1 text-[10px] font-medium text-ink-lighter bg-ink/5 rounded-lg px-2 py-1.5 hover:bg-ink/10 disabled:opacity-40 transition-colors"
              >
                <Image size={12} />
                {imageFiles.length > 0 ? `已选 ${imageFiles.length}/3` : "添加图片"}
              </button>
              {imageFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setImageFiles([]); setImagePreviews([]); }}
                  className="text-[10px] text-ink-lighter hover:text-accent-rose"
                >
                  清除
                </button>
              )}
            </div>
            {imagePreviews.length > 0 && (
              <div className="flex gap-1.5">
                {imagePreviews.map((url, i) => (
                  <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden bg-ink/5">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFiles((prev) => prev.filter((_, idx) => idx !== i));
                        setImagePreviews((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="absolute top-0 right-0 w-4 h-4 bg-black/40 rounded-bl-lg flex items-center justify-center"
                    >
                      <X size={9} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (!foodForm.food_name.trim()) return;
              createFood.mutate({
                date,
                meal_type: foodForm.meal_type,
                food_name: foodForm.food_name.trim(),
                portion: foodForm.portion || undefined,
                image_files: imageFiles.length > 0 ? imageFiles : undefined,
                feeling: foodForm.feeling || undefined,
                record_time: foodForm.record_time || undefined,
              }, {
                onSuccess: () => {
                  setFoodForm({ meal_type: "breakfast", food_name: "", portion: "", feeling: "", record_time: "" });
                  setImageFiles([]);
                  setImagePreviews([]);
                  setLogType(null);
                },
              });
            }}
            disabled={!foodForm.food_name.trim() || createFood.isPending}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2 text-xs font-semibold disabled:opacity-50"
          >
            {createFood.isPending ? "保存中..." : "保存"}
          </button>
        </div>
      )}

      {/* Workout records */}
      {(workoutRecords?.length ?? 0) > 0 && (
        <div className="bg-card rounded-2xl border border-border p-3 space-y-2">
          {(workoutRecords || []).map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5"><Dumbbell size={11} className="text-accent-sky" />{r.exercise_name}{r.duration_minutes ? ` · ${r.duration_minutes}分钟` : ""}</span>
              <button onClick={() => deleteWorkout.mutate(r.id)} className="text-ink-lighter hover:text-accent-rose"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Food records by meal type */}
      {Object.keys(foodsByMeal).length > 0 && (
        <div className="space-y-2">
          {MEAL_TYPES.map((mt) => {
            const meals = foodsByMeal[mt];
            if (!meals || meals.length === 0) return null;
            return (
              <MealSection
                key={mt}
                mealType={mt}
                date={date}
                foods={meals}
                onDelete={(id) => deleteFood.mutate(id)}
                onAnalyze={(mt) => {
                  setAnalyzingMeal(mt);
                  setMealAnalysisError((prev) => ({ ...prev, [mt]: "" }));
                  generateAnalysis.mutate({
                    date,
                    meal_type: mt,
                    food_records: meals.map((f) => ({
                      food_name: f.food_name,
                      portion: f.portion ?? undefined,
                      feeling: f.feeling ?? undefined,
                    })),
                  }, {
                    onSuccess: () => {
                      setAnalyzingMeal(null);
                      setMealAnalysisError((prev) => ({ ...prev, [mt]: "" }));
                    },
                    onError: (err) => {
                      setAnalyzingMeal(null);
                      setMealAnalysisError((prev) => ({ ...prev, [mt]: (err as Error).message || "分析失败" }));
                    },
                  });
                }}
                isAnalyzing={generateAnalysis.isPending && analyzingMeal === mt}
                analysisError={mealAnalysisError[mt] || null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Meal Section with AI Analysis ──

function MealSection({
  mealType,
  date,
  foods,
  onDelete,
  onAnalyze,
  isAnalyzing,
  analysisError,
}: {
  mealType: string;
  date: string;
  foods: FoodRecord[];
  onDelete: (id: string) => void;
  onAnalyze: (mt: string) => void;
  isAnalyzing: boolean;
  analysisError: string | null;
}) {
  const { data: analysis } = useMealAnalysis(date, mealType);
  const analysisData = analysis?.data;

  return (
    <div className="bg-card rounded-2xl border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-light">
          {MEAL_ICONS[mealType]} {MEAL_LABELS[mealType]}
        </p>
        <button
          onClick={() => onAnalyze(mealType)}
          disabled={isAnalyzing}
          className="flex items-center gap-1 text-[10px] font-medium text-sage-deep bg-sage-light/50 rounded-full px-2 py-0.5 hover:bg-sage-light transition-colors disabled:opacity-50"
        >
          {isAnalyzing ? (
            <><Loader2 size={10} className="animate-spin" />分析中</>
          ) : (
            <><Sparkles size={10} />{analysis ? "重新分析" : "AI 分析"}</>
          )}
        </button>
      </div>

      {/* AI Analysis error */}
      {analysisError && (
        <div className="flex items-center gap-1.5 text-[10px] text-accent-rose bg-accent-rose/5 rounded-lg px-2 py-1.5">
          <AlertTriangle size={10} className="shrink-0" />
          <span className="leading-relaxed">{analysisError}</span>
        </div>
      )}

      {/* Food items */}
      {foods.map((f) => (
        <div key={f.id}>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Apple size={11} className="text-accent-rose shrink-0" />
              <span className="text-ink truncate">{f.food_name}</span>
              {f.portion && <span className="text-[10px] text-ink-lighter shrink-0">({f.portion})</span>}
              {f.feeling && <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-1 shrink-0">{f.feeling}</span>}
            </div>
            <button onClick={() => onDelete(f.id)} className="text-ink-lighter hover:text-accent-rose shrink-0 ml-2"><Trash2 size={11} /></button>
          </div>
          {/* Thumbnails for this food record */}
          {f.image_urls && f.image_urls.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {f.image_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-ink/5 hover:opacity-80 transition-opacity">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* AI Analysis result */}
      {analysisData && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
          <div className="flex items-center gap-3 text-[10px] text-ink-lighter">
            {analysisData.estimated_calories != null && (
              <span className="flex items-center gap-0.5"><Flame size={10} className="text-accent-warm" />{analysisData.estimated_calories}千卡</span>
            )}
            {analysisData.estimated_protein != null && (
              <span>蛋白质 {analysisData.estimated_protein}g</span>
            )}
            {analysisData.estimated_carbs != null && (
              <span>碳水 {analysisData.estimated_carbs}g</span>
            )}
            {analysisData.estimated_fat != null && (
              <span>脂肪 {analysisData.estimated_fat}g</span>
            )}
          </div>
          {analysisData.assessment && (
            <p className="text-[11px] text-ink-light leading-relaxed">{analysisData.assessment}</p>
          )}
          {analysisData.suggestions && analysisData.suggestions.length > 0 && (
            <div className="space-y-0.5">
              {analysisData.suggestions.map((s, i) => (
                <p key={i} className="text-[10px] text-ink-lighter flex items-start gap-1">
                  <span className="text-sage-deep shrink-0 mt-0.5">•</span>
                  {s}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Workout Library ──

const SEARCH_SYNONYMS: Record<string, string[]> = {
  "臀": ["臀", "屁股", "翘臀", "臀腿", "臀大肌"],
  "背": ["背", "背部", "背肌", "背阔肌"],
  "腹": ["腹", "核心", "马甲线", "腹肌"],
  "腿": ["腿", "腿部", "下肢"],
};

const DIFFICULTY_ORDER: Record<string, number> = { "初级": 0, "中级": 1, "高级": 2 };

function expandSearchTerms(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const terms = new Set<string>([trimmed]);
  for (const synonyms of Object.values(SEARCH_SYNONYMS)) {
    if (synonyms.some((s) => trimmed.includes(s))) {
      for (const s of synonyms) terms.add(s);
    }
  }
  return [...terms];
}

function matchesSearch(video: WorkoutVideo, terms: string[]): boolean {
  const searchable = [
    video.title,
    ...(video.tags || []),
    ...(video.target_muscles || []),
    video.equipment,
    video.training_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return terms.some((t) => searchable.includes(t.toLowerCase()));
}

const FILTER_TRAINING_TYPES = [
  { key: "all", label: "全部" },
  { key: "力量训练", label: "力量" },
  { key: "塑形训练", label: "塑形" },
  { key: "有氧燃脂", label: "有氧燃脂" },
  { key: "HIIT", label: "HIIT" },
  { key: "拉伸", label: "拉伸" },
  { key: "瑜伽", label: "瑜伽" },
  { key: "康复", label: "康复" },
];

const FILTER_DIFFICULTIES = [
  { key: "all", label: "全部" },
  { key: "初级", label: "初级" },
  { key: "中级", label: "中级" },
  { key: "高级", label: "高级" },
];

const SORT_OPTIONS = [
  { key: "newest", label: "最新" },
  { key: "duration_asc", label: "最短时长" },
  { key: "difficulty_asc", label: "难度↓→高" },
  { key: "difficulty_desc", label: "难度高→低" },
];

function WorkoutLibraryTab({ onStartTraining }: { onStartTraining: (video: WorkoutVideo) => void }) {
  const { data: videos, isLoading } = useWorkoutVideos();
  const createVideo = useCreateWorkoutVideo();
  const updateVideo = useUpdateWorkoutVideo();
  const deleteVideo = useDeleteWorkoutVideo();
  const { retryWorkoutAnalysis, isRetrying, retryError } = useRetryWorkoutAnalysis();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    category: "all",
    training_type: "all",
    difficulty: "all",
    equipment: "all",
  });
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", category: "", difficulty: "", estimated_duration: null as number | null,
    training_type: "", equipment: "", tags: "",
  });
  const [retryProgress, setRetryProgress] = useState({ current: 0, total: 0 });
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  const handleReanalyzeVideo = async (video: WorkoutVideo) => {
    setReanalyzingId(video.id);
    try {
      await retryWorkoutAnalysis({ id: video.id, url: video.url });
    } catch {
      // Error handled by hook
    }
    setReanalyzingId(null);
  };

  // Dynamic equipment list from existing data
  const equipmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos || []) {
      if (v.equipment) {
        v.equipment.split(/[,，]/).forEach((e) => {
          const trimmed = e.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    }
    return [...set];
  }, [videos]);

  // Client-side search → filter → sort
  const filtered = useMemo(() => {
    let result = videos || [];

    // 1. Search with synonym expansion
    const terms = expandSearchTerms(search);
    if (terms.length > 0) {
      result = result.filter((v) => matchesSearch(v, terms));
    }

    // 2. Multi-dimensional filter (AND logic)
    if (filters.category !== "all") {
      result = result.filter((v) => v.category === filters.category || v.training_type === filters.category);
    }
    if (filters.training_type !== "all") {
      result = result.filter((v) => v.training_type === filters.training_type);
    }
    if (filters.difficulty !== "all") {
      result = result.filter((v) => v.difficulty === filters.difficulty);
    }
    if (filters.equipment !== "all") {
      result = result.filter((v) => v.equipment?.includes(filters.equipment));
    }

    // 3. Sort
    switch (sort) {
      case "duration_asc":
        result = [...result].sort((a, b) => (a.estimated_duration ?? 999) - (b.estimated_duration ?? 999));
        break;
      case "difficulty_asc":
        result = [...result].sort((a, b) => (DIFFICULTY_ORDER[a.difficulty ?? ""] ?? 99) - (DIFFICULTY_ORDER[b.difficulty ?? ""] ?? 99));
        break;
      case "difficulty_desc":
        result = [...result].sort((a, b) => (DIFFICULTY_ORDER[b.difficulty ?? ""] ?? -1) - (DIFFICULTY_ORDER[a.difficulty ?? ""] ?? -1));
        break;
      // "newest" — preserved from query (created_at desc)
    }

    return result;
  }, [videos, search, filters, sort]);

  // Data quality stats
  const qualityStats = useMemo(() => {
    const all = videos || [];
    const completed = all.filter((v) => v.ai_analysis_status === "completed").length;
    const pending = all.filter((v) => v.ai_analysis_status === "pending" || v.ai_analysis_status === "failed").length;
    return { completed, pending, total: all.length };
  }, [videos]);

  const handleRetryPending = async () => {
    const pending = (videos || []).filter(
      (v) => v.ai_analysis_status === "pending" || v.ai_analysis_status === "failed",
    );
    if (pending.length === 0) return;

    setRetryProgress({ current: 0, total: pending.length });

    for (let i = 0; i < pending.length; i++) {
      try {
        await retryWorkoutAnalysis({ id: pending[i].id, url: pending[i].url });
      } catch {
        // Individual failure — continue with remaining videos
      }
      setRetryProgress({ current: i + 1, total: pending.length });
    }
  };

  const handleAdd = () => {
    if (!url.trim()) return;
    createVideo.mutate({ url: url.trim() }, { onSuccess: () => { setUrl(""); setShowAdd(false); } });
  };

  const startEdit = (v: WorkoutVideo) => {
    setEditingId(v.id);
    setEditForm({
      title: v.title || "",
      category: v.category || "",
      difficulty: v.difficulty || "",
      estimated_duration: v.estimated_duration,
      training_type: v.training_type || "",
      equipment: v.equipment || "",
      tags: (v.tags || []).join("，"),
    });
  };

  const saveEdit = (id: string) => {
    updateVideo.mutate({
      id,
      title: editForm.title,
      category: editForm.category,
      difficulty: editForm.difficulty,
      estimated_duration: editForm.estimated_duration ?? undefined,
      training_type: editForm.training_type || undefined,
      equipment: editForm.equipment || undefined,
      tags: editForm.tags ? editForm.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : undefined,
    }, { onSuccess: () => setEditingId(null) });
  };

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const getPlatformBadge = (platform: string) => {
    const map: Record<string, string> = { bilibili: "B站", douyin: "抖音", youtube: "YT", xiaohongshu: "小红书" };
    return map[platform] || platform;
  };

  return (
    <div className="space-y-3">
      {/* Search bar + sort */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-lighter" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索训练视频..."
            className="w-full bg-card border border-border rounded-xl pl-9 pr-8 py-2.5 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-ink/10 flex items-center justify-center hover:bg-ink/15"
            >
              <X size={10} className="text-ink-lighter" />
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-card border border-border rounded-xl px-2.5 py-2.5 text-xs text-ink outline-none focus:border-sage-deep/50 transition-colors appearance-none cursor-pointer shrink-0"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Filter toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-1 text-[10px] text-ink-lighter hover:text-ink-light transition-colors"
      >
        <SlidersHorizontal size={11} />
        筛选
        {showFilters ? null : ` · ${filters.category === "all" && filters.training_type === "all" && filters.difficulty === "all" && filters.equipment === "all" ? "全部" : "已选"}`}
      </button>

      {/* Filter panel */}
      {showFilters && (
        <div className="space-y-2 bg-card rounded-2xl border border-border p-3">
          {/* Category (body part) */}
          <div className="space-y-1">
            <p className="text-[10px] text-ink-lighter font-medium">训练部位</p>
            <div className="flex gap-1.5 flex-wrap">
              {WORKOUT_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFilter("category", c.key)}
                  className={cn(
                    "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
                    filters.category === c.key ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Training type */}
          <div className="space-y-1">
            <p className="text-[10px] text-ink-lighter font-medium">训练方式</p>
            <div className="flex gap-1.5 flex-wrap">
              {FILTER_TRAINING_TYPES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFilter("training_type", c.key)}
                  className={cn(
                    "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
                    filters.training_type === c.key ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-1">
            <p className="text-[10px] text-ink-lighter font-medium">难度</p>
            <div className="flex gap-1.5 flex-wrap">
              {FILTER_DIFFICULTIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFilter("difficulty", c.key)}
                  className={cn(
                    "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
                    filters.difficulty === c.key ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment (dynamic) */}
          {equipmentOptions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-ink-lighter font-medium">器材</p>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilter("equipment", "all")}
                  className={cn(
                    "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
                    filters.equipment === "all" ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
                  )}
                >
                  全部
                </button>
                {equipmentOptions.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => setFilter("equipment", eq)}
                    className={cn(
                      "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
                      filters.equipment === eq ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
                    )}
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data quality toolstrip */}
      {qualityStats.total > 0 && (
        <div className={cn(
          "flex items-center justify-between rounded-xl px-3 py-2 text-xs",
          qualityStats.pending > 0 ? "bg-amber-50 border border-amber-100" : "bg-emerald-50 border border-emerald-100",
        )}>
          <span className={cn(
            "font-medium",
            qualityStats.pending > 0 ? "text-amber-700" : "text-emerald-700",
          )}>
            {qualityStats.pending > 0
              ? `有 ${qualityStats.pending} 个训练等待AI整理`
              : `已智能整理 ${qualityStats.completed} 个训练`}
          </span>
          {qualityStats.pending > 0 && (
            <button
              onClick={handleRetryPending}
              disabled={isRetrying}
              className="flex items-center gap-1 text-[10px] font-semibold bg-amber-600 text-white rounded-lg px-2.5 py-1 hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {isRetrying ? (
                <><Loader2 size={10} className="animate-spin" />整理中 {retryProgress.current}/{retryProgress.total}</>
              ) : (
                <><RotateCw size={10} />立即整理</>
              )}
            </button>
          )}
          {retryError && (
            <p className="text-[10px] text-red-600 mt-1">{(retryError as Error).message || "重试失败"}</p>
          )}
        </div>
      )}

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
          <p className="text-[10px] text-ink-lighter">支持 B站和 YouTube 链接。添加后 AI 会自动分析训练类型、部位、难度等信息。</p>
        </div>
      )}

      {/* Video count */}
      {!isLoading && search && (
        <p className="text-[10px] text-ink-lighter">
          找到 {filtered.length} 个视频
        </p>
      )}

      {/* Video list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-sage-deep" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10">
          <Dumbbell size={32} className="text-ink-lighter mx-auto mb-3 opacity-25" />
          <p className="text-sm text-ink-lighter">{search || filters.category !== "all" || filters.training_type !== "all" || filters.difficulty !== "all" || filters.equipment !== "all" ? "没有匹配的训练视频" : "训练库为空"}</p>
          <p className="text-xs text-ink-lighter mt-1">{search || filters.category !== "all" || filters.training_type !== "all" || filters.difficulty !== "all" || filters.equipment !== "all" ? "试试其他关键词或筛选条件" : "添加抖音或B站健身视频，替代收藏夹"}</p>
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
                      <option value="">训练部位</option>
                      {WORKOUT_CATEGORIES.filter((c) => c.key !== "all").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <select value={editForm.training_type} onChange={(e) => setEditForm((f) => ({ ...f, training_type: e.target.value }))} className="bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2 py-1.5">
                      <option value="">训练方式</option>
                      <option value="力量训练">力量训练</option><option value="塑形训练">塑形训练</option><option value="有氧燃脂">有氧燃脂</option><option value="HIIT">HIIT</option><option value="拉伸">拉伸</option><option value="瑜伽">瑜伽</option><option value="康复">康复</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={editForm.difficulty} onChange={(e) => setEditForm((f) => ({ ...f, difficulty: e.target.value }))} className="bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2 py-1.5">
                      <option value="">难度</option>
                      <option value="初级">初级</option><option value="中级">中级</option><option value="高级">高级</option>
                    </select>
                    <input type="number" value={editForm.estimated_duration ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, estimated_duration: e.target.value ? parseInt(e.target.value) : null }))} placeholder="时长(分钟)" className="bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2.5 py-1.5" />
                  </div>
                  <input type="text" value={editForm.equipment} onChange={(e) => setEditForm((f) => ({ ...f, equipment: e.target.value }))} placeholder="器材（如：哑铃、弹力带）" className="w-full bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2.5 py-1.5" />
                  <input type="text" value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} placeholder="标签，逗号分隔（如：翘臀, 无器械, 新手友好）" className="w-full bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2.5 py-1.5" />
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
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-ink truncate">{v.title || "未命名视频"}</p>
                          {v.ai_analysis_status === "pending" && (
                            <span title="AI 分析中..." className="shrink-0"><Loader2 size={11} className="animate-spin text-ink-lighter" /></span>
                          )}
                          {v.ai_analysis_status === "failed" && (
                            <span title="AI 分析失败" className="shrink-0"><AlertTriangle size={11} className="text-amber-500" /></span>
                          )}
                          {v.ai_analysis_status === "completed" && (
                            <span title="AI 分析完成" className="shrink-0"><Brain size={11} className="text-sage-deep" /></span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-1.5 py-0.5">{getPlatformBadge(v.platform)}</span>
                          {v.training_type && <span className="text-[10px] text-accent-sky bg-accent-sky/5 rounded-full px-1.5 py-0.5">{v.training_type}</span>}
                          {v.category && <span className="text-[10px] text-sage-deep bg-sage-light/50 rounded-full px-1.5 py-0.5">{v.category}</span>}
                          {v.estimated_duration && <span className="text-[10px] text-ink-lighter flex items-center gap-0.5"><Clock size={9} />{v.estimated_duration}分钟</span>}
                          {v.difficulty && <span className="text-[10px] text-ink-lighter">{v.difficulty}</span>}
                        </div>
                        {(v.target_muscles?.length || v.tags?.length || v.equipment) && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {v.target_muscles?.map((m) => (
                              <span key={m} className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-1.5 py-0.5">{m}</span>
                            ))}
                            {v.tags?.map((t) => (
                              <span key={t} className="text-[10px] text-ink-lighter bg-accent-warm/5 rounded-full px-1.5 py-0.5">{t}</span>
                            ))}
                            {v.equipment && (
                              <span className="text-[10px] text-ink-lighter flex items-center gap-0.5"><Zap size={9} />{v.equipment}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => onStartTraining(v)}
                          className="h-7 px-2 rounded-lg flex items-center justify-center gap-1 text-[10px] font-medium text-sage-deep bg-sage-light hover:bg-sage-light/80 transition-colors"
                          title="开始训练"
                        >
                          <Dumbbell size={11} />开始
                        </button>
                        {v.ai_analysis_status === "completed" && (
                          <button
                            onClick={() => handleReanalyzeVideo(v)}
                            disabled={reanalyzingId === v.id || isRetrying}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:text-accent-sky hover:bg-accent-sky/5 disabled:opacity-50"
                            title="重新智能分析"
                          >
                            {reanalyzingId === v.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Brain size={12} />
                            )}
                          </button>
                        )}
                        <button onClick={() => startEdit(v)} className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5" title="编辑">
                          <Star size={12} />
                        </button>
                        <button onClick={() => deleteVideo.mutate(v.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:text-accent-rose" title="删除">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {v.embed_url ? (
                      <div className="mt-3">
                        <VideoPlayer
                          embedUrl={v.embed_url}
                          thumbnailUrl={v.thumbnail_url}
                          title={v.title || ""}
                          platform={v.platform}
                          sourceUrl={v.url}
                        />
                      </div>
                    ) : (
                      <a href={v.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-sage-deep font-medium hover:underline">
                        <ExternalLink size={11} />
                        {v.platform === "douyin" ? "在抖音打开" : v.platform === "xiaohongshu" ? "在小红书打开" : "打开视频训练"}
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

// ── Workout Journal Section (hooks + WorkoutJournalTab) ──

function WorkoutJournalSection({ startFromVideo, onConsumedVideo }: { startFromVideo: WorkoutVideo | null; onConsumedVideo: () => void }) {
  const { data: sessions, isLoading: loadingSessions } = useWorkoutSessions();
  const { data: exerciseLibrary } = useExerciseLibrary();
  const createSession = useCreateWorkoutSession();
  const updateSession = useUpdateWorkoutSession();
  const deleteSession = useDeleteWorkoutSession();
  const { data: ctx } = useHealthContext();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: expandedSession } = useWorkoutSession(expandedId || "");

  // Consume startFromVideo to pre-open the form
  const [prefillVideo, setPrefillVideo] = useState<WorkoutVideo | null>(null);
  if (startFromVideo && prefillVideo?.id !== startFromVideo.id) {
    setPrefillVideo(startFromVideo);
  }

  const handleCreateSession = async (input: WorkoutSessionInput) => {
    const result = await createSession.mutateAsync(input);
    if (prefillVideo) { setPrefillVideo(null); onConsumedVideo(); }
    return result;
  };

  const handleUpdateSession = async (input: { id: string } & Partial<WorkoutSessionInput>) => {
    return updateSession.mutateAsync(input);
  };

  const handleDeleteSession = (id: string) => {
    if (expandedId === id) setExpandedId(null);
    deleteSession.mutate(id);
  };

  return (
    <WorkoutJournalTab
      sessions={(sessions || []) as WorkoutSession[]}
      isLoading={loadingSessions}
      exerciseLibrary={exerciseLibrary || []}
      onCreateSession={handleCreateSession}
      onUpdateSession={handleUpdateSession}
      onDeleteSession={handleDeleteSession}
      expandedSession={expandedSession as WorkoutSession | null}
      onExpandSession={setExpandedId}
      prefillVideo={prefillVideo}
      onConsumedPrefill={() => { setPrefillVideo(null); onConsumedVideo(); }}
      workoutsThisWeek={ctx?.workoutsThisWeek}
    />
  );
}

// ── Tab 3: Recipe Box ──

const SOURCE_TYPES = [
  { key: "bilibili" as const, label: "B站视频", icon: "🎬", placeholder: "输入 B站视频链接，例如：\nhttps://www.bilibili.com/video/BVxxxx" },
  { key: "xiaohongshu" as const, label: "小红书笔记", icon: "📕", placeholder: "输入小红书笔记链接" },
  { key: "douyin" as const, label: "抖音视频", icon: "🎵", placeholder: "输入抖音视频链接\n\n提示：抖音限制较多，若无法获取请上传视频" },
  { key: "upload" as const, label: "上传视频", icon: "📁", placeholder: "上传 mp4/mov 视频文件（即将支持）" },
  { key: "manual" as const, label: "手动输入", icon: "✍️", placeholder: "直接输入食谱名称、食材和步骤" },
] as const;

function RecipeBoxTab() {
  const { data: recipes, isLoading } = useRecipes();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const { retryRecipeAnalysis, isRetrying, retryError } = useRetryRecipeAnalysis();

  const [filter, setFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [sourceType, setSourceType] = useState<RecipeSourceType>("bilibili");
  const [inputText, setInputText] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const filtered = (recipes || []).filter((r) => {
    if (filter === "all") return true;
    if (filter === "高蛋白") return (r.protein_grams ?? 0) >= 25;
    if (filter === "减脂") return (Array.isArray(r.goal) ? r.goal.includes("减脂") : r.goal === "减脂") || r.category === "减脂";
    return (r.meal_time || []).includes(filter);
  });

  const todayPicks = (recipes || []).filter((r) => r.is_favorite).slice(0, 3);

  const currentSource = SOURCE_TYPES.find(s => s.key === sourceType) || SOURCE_TYPES[0];

  const handleAdd = () => {
    const text = inputText.trim();
    if (!text) return;

    if (sourceType === "manual") {
      createRecipe.mutate(
        { source_url: text, source_type: "manual", source_context: text || undefined },
        { onSuccess: () => { setInputText(""); setShowAdd(false); } },
      );
      return;
    }

    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    const url = urlMatch ? urlMatch[1] : text;
    const context = urlMatch
      ? text.replace(urlMatch[0], "").replace(/\n+/g, " ").trim()
      : "";

    createRecipe.mutate(
      { source_url: url, source_type: sourceType, source_context: context || undefined },
      { onSuccess: () => { setInputText(""); setShowAdd(false); } },
    );
  };

  const getPlatformBadge = (platform: string | null) => {
    const map: Record<string, string> = { bilibili: "B站", douyin: "抖音", xiaohongshu: "小红书", youtube: "YT" };
    return map[platform || ""] || platform || "web";
  };

  const getSourceTypeLabel = (st: string | null) => {
    return SOURCE_TYPES.find(s => s.key === st)?.label || "";
  };

  const handleUpdate = async (input: {
    id: string;
    name?: string;
    image_url?: string;
    ingredients_json?: RecipeIngredient[];
    steps_json?: RecipeStep[];
  }) => {
    await updateRecipe.mutateAsync(input);
  };

  const getStatusBadge = (status: string | null) => {
    if (status === "completed") return { label: "AI已整理", cls: "bg-emerald-50 text-emerald-600" };
    if (status === "processing") return { label: "正在处理", cls: "bg-blue-50 text-blue-600" };
    if (status === "partial") return { label: "部分整理", cls: "bg-amber-50 text-amber-600" };
    if (status === "failed") return { label: "处理失败", cls: "bg-red-50 text-red-500" };
    return { label: "等待处理", cls: "bg-slate-50 text-slate-500" };
  };

  const getIngredientsPreview = (r: Recipe): string => {
    const items = Array.isArray(r.ingredients_json) ? r.ingredients_json : [];
    if (items.length === 0) return "";
    return items.slice(0, 3).map((i: { name: string }) => i.name).join("、") + (items.length > 3 ? "…" : "");
  };

  return (
    <div className="space-y-3">
      {/* Today's picks */}
      {todayPicks.length > 0 && (
        <div className="bg-gradient-to-r from-accent-rose/5 to-white border border-accent-rose/10 rounded-2xl p-4">
          <p className="text-xs font-semibold text-accent-rose mb-2 flex items-center gap-1.5"><Sparkles size={12} />今日推荐</p>
          <div className="space-y-1.5">
            {todayPicks.map((r) => (
              <button key={r.id} onClick={() => setSelectedRecipe(r)} className="w-full flex items-center justify-between text-sm text-left hover:bg-ink/5 rounded-lg px-1 -mx-1 py-0.5 transition-colors">
                <span className="text-ink font-medium">{r.name}</span>
                <span className="text-[11px] text-ink-lighter">{r.calories_per_serving ? `${r.calories_per_serving}千卡` : ""}{r.protein_grams ? ` · ${r.protein_grams}g蛋白` : ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add button */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sage-light/50 py-3.5 text-sm text-sage-deep hover:bg-sage-light/10 transition-colors">
          <Plus size={15} />创建食谱
        </button>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          {/* Source type selector */}
          <div>
            <p className="text-xs font-medium text-ink-light mb-2">选择来源</p>
            <div className="grid grid-cols-5 gap-1.5">
              {SOURCE_TYPES.map((st) => (
                <button
                  key={st.key}
                  onClick={() => setSourceType(st.key)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 text-[10px] font-medium transition-colors",
                    sourceType === st.key
                      ? "bg-sage-light text-sage-deep ring-1 ring-sage-deep/30"
                      : "bg-ink/5 text-ink-light hover:bg-ink/10",
                  )}
                >
                  <span className="text-base">{st.icon}</span>
                  <span className="leading-tight text-center">{st.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input area */}
          {sourceType === "manual" ? (
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="输入食谱名称，保存后可编辑食材和步骤"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors resize-none"
              rows={2}
              autoFocus
            />
          ) : (
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={currentSource.placeholder}
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors resize-none"
              rows={3}
              autoFocus
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!inputText.trim() || createRecipe.isPending}
              className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors"
            >
              {createRecipe.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
              {createRecipe.isPending ? "创建中..." : (sourceType === "manual" ? "创建食谱" : "提取食谱")}
            </button>
            <button onClick={() => { setShowAdd(false); setInputText(""); }} className="px-4 py-2.5 text-sm text-ink-light hover:bg-ink/5 rounded-xl transition-colors">取消</button>
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
          <p className="text-xs text-ink-lighter mt-1">收藏食谱视频，AI 帮你解析食材和做法</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const statusBadge = getStatusBadge(r.ai_analysis_status || null);
            const ingPreview = getIngredientsPreview(r);
            return (
              <button
                key={r.id}
                onClick={() => setSelectedRecipe(r)}
                className="w-full bg-card rounded-2xl border border-border hover:border-sage-light/30 transition-colors overflow-hidden text-left"
              >
                <div className="flex gap-3 p-3.5">
                  {/* Thumbnail */}
                  <div className="shrink-0 w-16 h-16 rounded-xl bg-ink/5 overflow-hidden">
                    {r.image_url ? (
                      <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        {r.category === "高蛋白" ? "🥩" : r.category === "减脂" ? "🥗" : "🍳"}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink truncate">{r.name || "未命名食谱"}</p>
                      <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </div>

                    {/* Goal tags */}
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {r.source_platform && (
                        <span className="text-[9px] text-ink-lighter bg-ink/5 rounded-full px-1.5 py-0.5">{getPlatformBadge(r.source_platform)}</span>
                      )}
                      {Array.isArray(r.goal) && r.goal.map((g) => (
                        <span key={g} className="text-[9px] text-accent-rose bg-accent-rose/5 rounded-full px-1.5 py-0.5">{g}</span>
                      ))}
                      {!Array.isArray(r.goal) && r.goal && (
                        <span className="text-[9px] text-accent-rose bg-accent-rose/5 rounded-full px-1.5 py-0.5">{r.goal}</span>
                      )}
                    </div>

                    {/* Ingredients preview */}
                    {ingPreview && (
                      <p className="text-[10px] text-ink-lighter mt-1.5 line-clamp-1 flex items-center gap-1">
                        <ChefHat size={10} className="shrink-0" />{ingPreview}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onUpdate={handleUpdate}
          onDelete={(id) => { deleteRecipe.mutate(id); }}
          onRetryAnalysis={retryRecipeAnalysis}
          isRetrying={isRetrying}
          retryError={retryError as Error | null}
        />
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

// ── Tab 5: Health Goals ──

function GoalsTab() {
  const { data: bodyProfile, isLoading: loadingBody } = useBodyProfile();
  const { data: healthGoals, isLoading: loadingGoals } = useHealthGoals();

  const goto = (path: string) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const isLoading = loadingBody || loadingGoals;

  const HEALTH_DIRECTIONS = [
    { key: "减脂", icon: "🔥", desc: "降低体脂率，保持肌肉量" },
    { key: "增肌", icon: "💪", desc: "增加肌肉量，提升力量" },
    { key: "饮食改善", icon: "🥗", desc: "优化饮食结构，减少加工食品" },
    { key: "睡眠改善", icon: "😴", desc: "保证7小时以上优质睡眠" },
    { key: "生活习惯", icon: "✅", desc: "建立健康的日常routine" },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Body Stats Summary (read-only) */}
      {bodyProfile && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold text-ink-lighter uppercase tracking-wider mb-3">身体档案</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-ink/5 rounded-xl p-3">
              <p className="text-[10px] text-ink-lighter">当前体重</p>
              <p className="text-lg font-bold text-ink">{bodyProfile.weight ?? "--"} <span className="text-xs font-normal text-ink-lighter">kg</span></p>
            </div>
            <div className="bg-ink/5 rounded-xl p-3">
              <p className="text-[10px] text-ink-lighter">目标体重</p>
              <p className="text-lg font-bold text-ink">{bodyProfile.target_weight ?? "--"} <span className="text-xs font-normal text-ink-lighter">kg</span></p>
            </div>
            <div className="bg-ink/5 rounded-xl p-3">
              <p className="text-[10px] text-ink-lighter">体脂率</p>
              <p className="text-lg font-bold text-ink">{bodyProfile.body_fat_percentage != null ? `${bodyProfile.body_fat_percentage}%` : "--"}</p>
            </div>
            <div className="bg-ink/5 rounded-xl p-3">
              <p className="text-[10px] text-ink-lighter">健身目标</p>
              <p className="text-lg font-bold text-ink">{bodyProfile.fitness_goal || "未设置"}</p>
            </div>
          </div>
          {bodyProfile.focus_areas && bodyProfile.focus_areas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {bodyProfile.focus_areas.map((area) => (
                <span key={area} className="text-[10px] px-2 py-1 rounded-full bg-sage-light/50 text-sage-deep font-medium">
                  {area}
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-ink-lighter mt-2">
            在「今日建议」标签页中编辑身体档案
          </p>
        </div>
      )}

      {/* Health Directions */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-semibold text-ink-lighter uppercase tracking-wider mb-3">健康方向</p>
        <div className="space-y-2">
          {HEALTH_DIRECTIONS.map((dir) => (
            <div key={dir.key} className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-ink/5">
              <span className="text-lg shrink-0">{dir.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">{dir.key}</p>
                <p className="text-[10px] text-ink-lighter">{dir.desc}</p>
              </div>
              <button
                onClick={() => {
                  goto("/plan");
                }}
                className="text-[10px] font-medium text-sage-deep bg-sage-light/50 rounded-full px-2 py-1 hover:bg-sage-light transition-colors shrink-0"
              >
                设定目标
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Active Health Goals from Plan OS */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-ink-lighter uppercase tracking-wider">
            进行中的健康目标
          </p>
          <button
            onClick={() => {
              goto("/plan");
            }}
            className="flex items-center gap-1 text-[10px] font-medium text-sage-deep hover:underline"
          >
            在 Plan OS 中管理
            <ArrowRight size={10} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin text-sage-deep" />
          </div>
        ) : healthGoals && healthGoals.length > 0 ? (
          <div className="space-y-2">
            {healthGoals.map((goal) => (
              <div
                key={goal.id}
                className="flex items-center gap-3 rounded-xl px-3 py-3 bg-sage-light/10"
              >
                <Trophy size={16} className="text-sage-deep shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{goal.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {goal.target_metric && (
                      <span className="text-[10px] text-ink-lighter">
                        目标: {goal.target_metric}
                        {goal.current_metric ? ` · 当前: ${goal.current_metric}` : ""}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 bg-ink/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(goal.progress || 0, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-ink-lighter">{goal.progress || 0}%</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    goto("/plan");
                  }}
                  className="shrink-0 text-ink-lighter hover:text-ink-light"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Target size={28} className="text-ink-lighter mx-auto mb-2 opacity-25" />
            <p className="text-sm text-ink-lighter">暂无健康目标</p>
            <p className="text-xs text-ink-lighter mt-1">
              在 Plan OS 中创建目标，选择分类为「健康」
            </p>
            <button
              onClick={() => {
                goto("/plan");
              }}
              className="mt-3 inline-flex items-center gap-1.5 bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-xs font-semibold hover:bg-sage-light/80 transition-colors"
            >
              <Plus size={12} />
              创建健康目标
            </button>
          </div>
        )}
      </div>
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
