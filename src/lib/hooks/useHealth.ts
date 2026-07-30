// ============================================
// Nancy OS — Health OS v2 Hooks
// AI-first action system: videos, recipes, meal plans, coach
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { normalizeUrl, detectUrlPlatform, extractVideoId, buildEmbedUrl, getDefaultVideoTitle, getYouTubeThumbnail } from "@/lib/utils";

// ── Types ──

export type BodyProfile = {
  id: string;
  user_id: string;
  height: number | null;
  weight: number | null;
  target_weight: number | null;
  body_fat_percentage: number | null;
  target_body_fat: number | null;
  fitness_goal: string | null;
  focus_areas: string[] | null;
  notes: string | null;
  updated_at: string;
};

export type WorkoutVideo = {
  id: string;
  user_id: string;
  url: string;
  platform: string;
  title: string | null;
  author: string | null;
  training_type: string | null;
  target_muscles: string[] | null;
  category: string | null;
  difficulty: string | null;
  estimated_duration: number | null;
  is_favorite: boolean;
  notes: string | null;
  video_id: string | null;
  embed_url: string | null;
  thumbnail_url: string | null;
  equipment: string | null;
  tags: string[] | null;
  ai_analysis_status: string | null;
  created_at: string;
};

export type RecipeSourceType = "bilibili" | "xiaohongshu" | "douyin" | "manual";

export type Recipe = {
  id: string;
  user_id: string;
  name: string;
  source_url: string | null;
  source_platform: string | null;
  // v3 source tracking
  source_type: RecipeSourceType | null;
  source_content: Record<string, unknown> | null;
  confidence: "high" | "medium" | "low" | null;
  // legacy TEXT columns (preserved)
  ingredients: string | null;
  steps: string | null;
  // v2 structured columns
  ingredients_json: RecipeIngredient[];
  steps_json: RecipeStep[];
  cook_count: number;
  last_cooked_at: string | null;
  ai_analysis_status: string | null;
  ai_analyzed_at: string | null;
  ai_summary: string | null;
  calories_per_serving: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fat_grams: number | null;
  category: string | null;
  meal_time: string[] | null;
  goal: string[] | null;
  health_level: string | null;
  budget_level: string | null;
  is_favorite: boolean;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeIngredient = {
  name: string;
  amount: string;
  category: string;
};

export type RecipeStep = {
  order: number;
  text: string;
  duration?: number;
};

export type MealPlan = {
  id: string;
  user_id: string;
  week_start: string;
  day_of_week: number;
  meal_type: string;
  recipe_id: string | null;
  custom_meal: string | null;
  notes: string | null;
  created_at: string;
};

export type MealPlanSlot = {
  id?: string;
  day_of_week: number;
  meal_type: string;
  recipe_id?: string | null;
  recipe?: Recipe | null;
  custom_meal?: string | null;
  notes?: string | null;
};

export type HealthCoachInsight = {
  id: string;
  user_id: string;
  agent_type: string;
  title: string | null;
  content: string | null;
  data: Record<string, unknown> | null;
  generated_at: string;
};

export type WorkoutRecord = {
  id: string;
  user_id: string;
  plan_id: string | null;
  date: string;
  exercise_name: string;
  sets_completed: number | null;
  reps_per_set: string | null;
  weight_used: number | null;
  duration_minutes: number | null;
  perceived_effort: number | null;
  notes: string | null;
  created_at: string;
};

export type FoodRecord = {
  id: string;
  user_id: string;
  recipe_id: string | null;
  date: string;
  meal_type: string;
  food_name: string;
  // v2 fields
  portion: string | null;
  image_urls: string[] | null;
  feeling: string | null;
  record_time: string | null;
  // deprecated — kept for historical data
  carb: string | null;
  protein: string | null;
  vegetables: string | null;
  drink: string | null;
  fullness: string | null;
  health_feeling: string | null;
  checklist: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
};

export type MealAnalysis = {
  id: string;
  user_id: string;
  agent_type: string;
  insight_type: string;
  title: string | null;
  content: string | null;
  data: {
    meal_type?: string;
    meal_date?: string;
    estimated_calories?: number;
    estimated_protein?: number;
    estimated_carbs?: number;
    estimated_fat?: number;
    assessment?: string;
    suggestions?: string[];
  } | null;
  generated_at: string;
};

export type HealthContext = {
  bodyProfile: BodyProfile | null;
  recentWorkouts: WorkoutRecord[];
  recentFoods: FoodRecord[];
  workoutStreak: number;
  workoutsThisWeek: number;
};

// ── Body Profile ──

async function fetchBodyProfile() {
  const { data, error } = await supabase
    .from("body_profiles")
    .select("*")
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return (data || null) as BodyProfile | null;
}

export function useBodyProfile() {
  return useQuery({
    queryKey: ["body_profile"],
    queryFn: fetchBodyProfile,
    staleTime: 60 * 1000,
  });
}

export function useUpdateBodyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BodyProfile>) => {
      const userId = await getUserId();
      const { data: existing } = await supabase
        .from("body_profiles")
        .select("id")
        .limit(1)
        .single();
      if (existing) {
        const { error } = await supabase
          .from("body_profiles")
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
        return existing.id;
      } else {
        const { data, error } = await supabase
          .from("body_profiles")
          .insert({ ...input, user_id: userId })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["body_profile"] });
      qc.invalidateQueries({ queryKey: ["health_context"] });
    },
  });
}

// ── Workout Videos ──

async function fetchWorkoutVideos(): Promise<WorkoutVideo[]> {
  const { data, error } = await supabase
    .from("workout_videos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as WorkoutVideo[];
}

export function useWorkoutVideos() {
  return useQuery({
    queryKey: ["workout_videos"],
    queryFn: fetchWorkoutVideos,
    staleTime: 60 * 1000,
  });
}

export function useCreateWorkoutVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { url: string }) => {
      const userId = await getUserId();
      const normalized = normalizeUrl(input.url);
      if (!normalized) throw new Error("无效的链接地址，请检查链接格式");
      const platform = detectUrlPlatform(normalized);
      const videoId = extractVideoId(normalized, platform);
      const embedUrl = videoId ? buildEmbedUrl(platform, videoId) : null;
      const thumbnailUrl = platform === "youtube" && videoId ? getYouTubeThumbnail(videoId) : null;

      // Step 1: Insert basic record
      const { data, error } = await supabase
        .from("workout_videos")
        .insert({
          user_id: userId,
          url: normalized,
          platform,
          title: getDefaultVideoTitle(platform),
          video_id: videoId,
          embed_url: embedUrl,
          thumbnail_url: thumbnailUrl,
          category: null,
          difficulty: null,
          estimated_duration: null,
          ai_analysis_status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      const record = data as WorkoutVideo;

      // Step 2: Trigger AI analysis (non-blocking)
      if (platform === "bilibili" || platform === "youtube") {
        supabase.functions.invoke("content-parser-agent", {
          body: {
            url: normalized,
            content_type: "workout",
            workout_video_id: record.id,
          },
        }).catch(() => {
          // AI failure is non-blocking — record already saved
        });
      }

      return record;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_videos"] });
    },
  });
}

export function useUpdateWorkoutVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      category?: string;
      training_type?: string;
      target_muscles?: string[];
      difficulty?: string;
      estimated_duration?: number;
      equipment?: string;
      tags?: string[];
      is_favorite?: boolean;
      notes?: string;
    }) => {
      const { id, ...fields } = input;
      const { data, error } = await supabase
        .from("workout_videos")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_videos"] });
    },
  });
}

export function useDeleteWorkoutVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workout_videos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_videos"] });
    },
  });
}

export function useRetryWorkoutAnalysis() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (video: { id: string; url: string }) => {
      const result = await Promise.race([
        supabase.functions.invoke("content-parser-agent", {
          body: { url: video.url, workout_video_id: video.id },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI整理超时，请稍后重试")), 30_000),
        ),
      ]);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_videos"] });
    },
  });

  return {
    retryWorkoutAnalysis: mutation.mutateAsync,
    isRetrying: mutation.isPending,
    retryError: mutation.error,
  };
}

// ── Recipes ──

async function fetchRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as Recipe[];
}

export function useRecipes() {
  return useQuery({
    queryKey: ["recipes"],
    queryFn: fetchRecipes,
    staleTime: 60 * 1000,
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { source_url: string; source_type: RecipeSourceType; source_context?: string }) => {
      const userId = await getUserId();

      if (input.source_type === "manual") {
        // Manual creation: insert shell, then run AI pipeline to parse text
        const rawText = input.source_context || "";
        const firstLine = rawText.split(/[\n\r]+/)[0]?.trim() || "";
        const initialName = firstLine.slice(0, 50) || "未命名食谱";

        const { data, error } = await supabase
          .from("recipes")
          .insert({
            user_id: userId,
            name: initialName,
            source_type: "manual",
            ai_analysis_status: "processing",
            notes: rawText || null,
          })
          .select()
          .single();
        if (error) throw error;
        const record = data as Recipe;

        invokeRecipePipeline(record.id, "", input.source_type, input.source_context);

        return record;
      }

      const normalized = normalizeUrl(input.source_url);
      if (!normalized) throw new Error("无效的链接地址，请检查链接格式");
      const platform = detectUrlPlatform(normalized);

      // Step 1: Insert with processing status
      const { data, error } = await supabase
        .from("recipes")
        .insert({
          user_id: userId,
          name: input.source_context?.slice(0, 80) || "",
          source_url: normalized,
          source_platform: platform,
          source_type: input.source_type,
          notes: input.source_context || null,
          ai_analysis_status: "processing",
        })
        .select()
        .single();
      if (error) throw error;
      const record = data as Recipe;

      // Step 2: Source extraction → AI parsing (non-blocking chain)
      invokeRecipePipeline(record.id, normalized, input.source_type, input.source_context);

      return record;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

async function invokeRecipePipeline(
  recipeId: string,
  url: string,
  sourceType: RecipeSourceType,
  sourceContext?: string,
) {
  // Step A: Set status → processing
  await supabase.from("recipes").update({ ai_analysis_status: "processing" }).eq("id", recipeId);

  // Step B: Extract source content
  let sourceContent: Record<string, unknown> | null = null;
  let extractionError: string | undefined;

  if (sourceType === "manual") {
    // Build sourceContent from manual text input
    const rawText = sourceContext || "";
    const lines = rawText.split(/[\n\r]+/).filter((l) => l.trim().length > 0);
    const title = lines[0]?.trim() || "";
    sourceContent = {
      title,
      description: rawText,
      source_type: "manual",
      source_material: `标题: ${title}\n正文: ${rawText.slice(0, 5000)}`,
    };
    await supabase.from("recipes").update({
      source_content: sourceContent,
      ai_analysis_status: "processing",
    }).eq("id", recipeId);
  } else {
    try {
      const extractResult = await supabase.functions.invoke("source-extractor-agent", {
        body: { url, source_type: sourceType, recipe_id: recipeId },
      });
      if (!extractResult.error && extractResult.data) {
        sourceContent = extractResult.data as Record<string, unknown>;
        extractionError = (extractResult.data as { extraction_error?: string }).extraction_error;
        // Save source_content to recipe
        await supabase.from("recipes").update({
          source_content: sourceContent,
          ai_analysis_status: "processing",
        }).eq("id", recipeId);
      }
    } catch {
      extractionError = "内容提取服务暂时不可用";
    }
  }

  // Check extraction result — handle platform-specific failure modes
  const extractionStatus = sourceContent
    ? (sourceContent as { extraction_status?: string }).extraction_status
    : "failed";

  if (sourceType === "douyin" && extractionStatus === "failed") {
    // Douyin: transparent failure — tell user why, don't call AI
    await supabase.from("recipes").update({
      ai_analysis_status: "partial",
      ai_summary: extractionError || "抖音无法自动获取视频正文。请使用 ✍️ 手动输入补充食材和步骤。",
      confidence: "low",
    }).eq("id", recipeId);
    return;
  }

  // Check if we have any real content at all
  const sc = sourceContent as Record<string, unknown> | null;
  const hasContent = sc
    && ((sc.title as string)?.length > 0
      || (sc.description as string)?.length > 30
      || (sc.transcript as string)?.length > 30
      || (sc.subtitle as string)?.length > 30
      || (sc.ocr_text as string)?.length > 30);
  if (sourceType !== "manual" && extractionStatus === "failed") {
    await supabase.from("recipes").update({
      ai_analysis_status: "partial",
      ai_summary: extractionError || "来源内容不足，请补充正文或上传图片。",
      confidence: "low",
    }).eq("id", recipeId);
    return;
  }
  if (sourceType !== "manual" && sourceContent && !hasContent && extractionStatus !== "ok") {
    // Has source_content object but all fields are effectively empty
    await supabase.from("recipes").update({
      ai_analysis_status: "partial",
      ai_summary: extractionError || "来源内容不足，请补充正文或上传图片。",
      confidence: "low",
    }).eq("id", recipeId);
    return;
  }

  // Step C: AI parsing
  try {
    const parseResult = await supabase.functions.invoke("content-parser-agent", {
      body: {
        content_type: "recipe",
        recipe_id: recipeId,
        source_type: sourceType,
        source_context: sourceContext || undefined,
        source_content: sourceContent,
      },
    });
    if (parseResult.error) throw parseResult.error;
  } catch {
    await supabase.from("recipes").update({
      ai_analysis_status: "failed",
      ai_summary: "AI 解析失败，请稍后重试。",
    }).eq("id", recipeId);
  }
}

export function useUpdateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      category?: string;
      meal_time?: string[];
      goal?: string[];
      ingredients?: string;
      ingredients_json?: RecipeIngredient[];
      steps_json?: RecipeStep[];
      calories_per_serving?: number;
      protein_grams?: number;
      carbs_grams?: number;
      fat_grams?: number;
      health_level?: string;
      budget_level?: string;
      image_url?: string;
      is_favorite?: boolean;
      notes?: string;
    }) => {
      const { id, ...fields } = input;
      const { data, error } = await supabase
        .from("recipes")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useRetryRecipeAnalysis() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (recipe: { id: string; source_url: string; source_type?: RecipeSourceType; source_context?: string }) => {
      if (!recipe.source_url && recipe.source_type !== "manual") throw new Error("该食谱没有来源链接");

      const sourceType = recipe.source_type || "bilibili";

      // Use the full pipeline with 30s timeout
      await Promise.race([
        invokeRecipePipeline(recipe.id, recipe.source_url, sourceType, recipe.source_context),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI整理超时，请稍后重试")), 60_000),
        ),
      ]);

      // Fetch updated recipe
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", recipe.id)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  return {
    retryRecipeAnalysis: mutation.mutateAsync,
    isRetrying: mutation.isPending,
    retryError: mutation.error,
  };
}

// ── Meal Plans ──

function getWeekMonday(): string {
  const t = new Date();
  const dow = t.getDay();
  const mon = new Date(t);
  mon.setDate(t.getDate() - (dow === 0 ? 6 : dow - 1));
  return mon.toISOString().split("T")[0];
}

async function fetchMealPlans(weekStart: string): Promise<MealPlan[]> {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("*, recipe:recipe_id(*)")
    .eq("week_start", weekStart)
    .order("day_of_week")
    .order("meal_type");
  if (error) throw error;
  return (data || []) as MealPlan[];
}

export function useMealPlans(weekStart?: string) {
  const ws = weekStart || getWeekMonday();
  return useQuery({
    queryKey: ["meal_plans", ws],
    queryFn: () => fetchMealPlans(ws),
    staleTime: 60 * 1000,
  });
}

export function useUpsertMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      week_start: string;
      day_of_week: number;
      meal_type: string;
      recipe_id?: string | null;
      custom_meal?: string;
      notes?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("meal_plans")
        .upsert(
          { ...input, user_id: userId },
          { onConflict: "user_id, week_start, day_of_week, meal_type" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["meal_plans", vars.week_start] });
    },
  });
}

// ── Workout Records ──

async function fetchWorkoutRecords(date?: string) {
  let query = supabase
    .from("workout_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (date) query = query.eq("date", date);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as WorkoutRecord[];
}

export function useWorkoutRecords(date?: string) {
  return useQuery({
    queryKey: ["workout_records", date],
    queryFn: () => fetchWorkoutRecords(date),
    staleTime: 30 * 1000,
  });
}

export function useCreateWorkoutRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      date: string;
      exercise_name: string;
      sets_completed?: number;
      duration_minutes?: number;
      perceived_effort?: number;
      notes?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("workout_records")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_records"] });
      qc.invalidateQueries({ queryKey: ["health_context"] });
    },
  });
}

export function useDeleteWorkoutRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workout_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_records"] });
      qc.invalidateQueries({ queryKey: ["health_context"] });
    },
  });
}

// ── Food Images (Storage) ──

const FOOD_IMAGES_BUCKET = "food-images";

export async function uploadFoodImages(userId: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${ts}_${safeName}`;
    const { error, data } = await supabase.storage
      .from(FOOD_IMAGES_BUCKET)
      .upload(path, file, { upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from(FOOD_IMAGES_BUCKET)
      .getPublicUrl(data.path);
    urls.push(urlData.publicUrl);
  }
  return urls;
}

export async function deleteFoodImages(urls: string[]): Promise<void> {
  if (!urls || urls.length === 0) return;
  const paths = urls
    .map((url) => {
      try {
        const u = new URL(url);
        const parts = u.pathname.split("/");
        const bucketIdx = parts.indexOf(FOOD_IMAGES_BUCKET);
        if (bucketIdx === -1) return null;
        return parts.slice(bucketIdx + 1).join("/");
      } catch {
        return null;
      }
    })
    .filter((p): p is string => p !== null);
  if (paths.length > 0) {
    await supabase.storage.from(FOOD_IMAGES_BUCKET).remove(paths);
  }
}

// ── Food Records ──

async function fetchFoodRecords(date?: string) {
  let query = supabase
    .from("food_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (date) query = query.eq("date", date);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as FoodRecord[];
}

export function useFoodRecords(date?: string) {
  return useQuery({
    queryKey: ["food_records", date],
    queryFn: () => fetchFoodRecords(date),
    staleTime: 30 * 1000,
  });
}

export function useCreateFoodRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      date: string;
      meal_type: string;
      food_name: string;
      portion?: string;
      image_files?: File[];
      feeling?: string;
      record_time?: string;
      recipe_id?: string;
      notes?: string;
    }) => {
      const userId = await getUserId();
      const imageFiles = input.image_files;
      delete (input as Record<string, unknown>).image_files;

      // Upload images first if provided
      let imageUrls: string[] | undefined;
      if (imageFiles && imageFiles.length > 0) {
        imageUrls = await uploadFoodImages(userId, imageFiles);
      }

      const { data, error } = await supabase
        .from("food_records")
        .insert({ ...input, user_id: userId, image_urls: imageUrls || [] })
        .select()
        .single();
      if (error) throw error;

      // If linked to a recipe, increment cook_count (non-blocking)
      if (input.recipe_id) {
        try {
          const { data: recipe } = await supabase
            .from("recipes")
            .select("cook_count")
            .eq("id", input.recipe_id)
            .maybeSingle();
          if (recipe) {
            const newCount = (recipe.cook_count ?? 0) + 1;
            await supabase
              .from("recipes")
              .update({ cook_count: newCount, last_cooked_at: new Date().toISOString() })
              .eq("id", input.recipe_id);
          }
        } catch {
          // Non-critical — don't block food record creation
        }
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food_records"] });
      qc.invalidateQueries({ queryKey: ["health_context"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useDeleteFoodRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch record first to get image_urls for cleanup
      const { data: record } = await supabase
        .from("food_records")
        .select("image_urls")
        .eq("id", id)
        .single();

      const { error } = await supabase.from("food_records").delete().eq("id", id);
      if (error) throw error;

      // Clean up images from storage
      if (record?.image_urls && Array.isArray(record.image_urls)) {
        await deleteFoodImages(record.image_urls as string[]).catch(() => {
          // Non-critical — image cleanup failure shouldn't block record deletion
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food_records"] });
      qc.invalidateQueries({ queryKey: ["health_context"] });
    },
  });
}

export function useUpdateFoodRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      food_name?: string;
      meal_type?: string;
      portion?: string;
      notes?: string;
      feeling?: string;
      image_urls?: string[];
    }) => {
      const { id, ...fields } = input;
      const { data, error } = await supabase
        .from("food_records")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food_records"] });
      qc.invalidateQueries({ queryKey: ["health_context"] });
    },
  });
}

export function useGenerateDailyDietSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string }) => {
      const { data, error } = await supabase.functions.invoke("diet-analyst-agent", {
        body: {
          date: input.date,
          mode: "daily_summary",
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["daily_diet_summary", variables.date] });
    },
  });
}

export function useDailyDietSummary(date: string) {
  return useQuery({
    queryKey: ["daily_diet_summary", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("*")
        .eq("agent_type", "diet_analyst")
        .eq("insight_type", "daily_summary")
        .contains("data", { meal_date: date })
        .order("generated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] || null) as { id: string; content: string | null; generated_at: string } | null;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!date,
  });
}

// ── Meal AI Analysis ──

async function fetchMealAnalysis(date: string, mealType: string) {
  const { data, error } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("agent_type", "diet_analyst")
    .eq("insight_type", "meal_analysis")
    .contains("data", { meal_date: date, meal_type: mealType })
    .order("generated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data || [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ...row,
    data: row.data as MealAnalysis["data"],
  } as MealAnalysis;
}

export function useMealAnalysis(date: string, mealType: string) {
  return useQuery({
    queryKey: ["meal_analysis", date, mealType],
    queryFn: () => fetchMealAnalysis(date, mealType),
    staleTime: 5 * 60 * 1000,
    enabled: !!date && !!mealType,
  });
}

export function useGenerateMealAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      date: string;
      meal_type: string;
      food_records: Array<{
        food_name: string;
        portion?: string;
        feeling?: string;
      }>;
    }) => {
      const { data, error } = await supabase.functions.invoke("diet-analyst-agent", {
        body: input,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["meal_analysis", variables.date, variables.meal_type],
      });
    },
  });
}

// ── Health Context (for AI Coach) ──

async function fetchHealthContext(): Promise<HealthContext> {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  const [
    { data: bodyProfile },
    { data: recentWorkouts },
    { data: recentFoods },
    { data: weekWorkouts },
  ] = await Promise.all([
    supabase.from("body_profiles").select("*").limit(1).single(),
    supabase.from("workout_records")
      .select("*")
      .gte("date", weekAgoStr).lte("date", today)
      .order("date", { ascending: false })
      .limit(30),
    supabase.from("food_records")
      .select("*")
      .gte("date", weekAgoStr).lte("date", today)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("workout_records")
      .select("date")
      .gte("date", weekAgoStr).lte("date", today)
      .order("date", { ascending: false }),
  ]);

  const uniqueDays = new Set((weekWorkouts || []).map((r: Record<string, unknown>) => r.date));
  const checkDate = new Date(today);
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const ds = checkDate.toISOString().split("T")[0];
    if (uniqueDays.has(ds)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
    else break;
  }

  return {
    bodyProfile: (bodyProfile?.id ? bodyProfile : null) as BodyProfile | null,
    recentWorkouts: (recentWorkouts || []) as WorkoutRecord[],
    recentFoods: (recentFoods || []) as FoodRecord[],
    workoutStreak: streak,
    workoutsThisWeek: uniqueDays.size,
  };
}

export function useHealthContext() {
  return useQuery({
    queryKey: ["health_context"],
    queryFn: fetchHealthContext,
    staleTime: 30 * 1000,
  });
}

// ── AI Health Coach Insight ──

async function fetchLatestCoachInsight(): Promise<HealthCoachInsight | null> {
  const { data, error } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("agent_type", "health_coach")
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return (data || null) as HealthCoachInsight | null;
}

export function useCoachInsight() {
  return useQuery({
    queryKey: ["health_coach_insight"],
    queryFn: fetchLatestCoachInsight,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGenerateCoachInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("health-coach-agent", {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health_coach_insight"] });
    },
  });
}

// ── Content Parser (AI-powered: URL → structured data) ──

export function useParseContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { url: string; type: "workout" | "recipe" }) => {
      const { data, error } = await supabase.functions.invoke("content-parser-agent", {
        body: { url: input.url, type: input.type },
      });
      if (error) throw error;
      return data as {
        title: string;
        category?: string;
        difficulty?: string;
        estimated_duration?: number;
        target_muscles?: string[];
        ingredients?: string;
        calories_per_serving?: number;
        protein_grams?: number;
        goal?: string;
        meal_time?: string[];
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_videos"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

// ── Water Intake ──

export type WaterRecord = {
  id: string;
  user_id: string;
  amount_ml: number;
  recorded_at: string;
  created_at: string;
};

export type WaterToday = {
  records: WaterRecord[];
  total_ml: number;
  goal_ml: number;
};

const DAILY_WATER_GOAL = 2000;

async function fetchWaterToday(date: string): Promise<WaterToday> {
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;
  const { data, error } = await supabase
    .from("water_records")
    .select("*")
    .gte("recorded_at", startOfDay)
    .lte("recorded_at", endOfDay)
    .order("recorded_at", { ascending: false });
  if (error) throw error;
  const records = (data || []) as WaterRecord[];
  const total_ml = records.reduce((sum, r) => sum + r.amount_ml, 0);
  return { records, total_ml, goal_ml: DAILY_WATER_GOAL };
}

export function useWaterToday(date?: string) {
  const d = date || new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["water_today", d],
    queryFn: () => fetchWaterToday(d),
    staleTime: 30 * 1000,
  });
}

export function useAddWater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; amount_ml: number }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("water_records")
        .insert({ user_id: userId, amount_ml: input.amount_ml, recorded_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      return data as WaterRecord;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["water_today", vars.date] });
    },
  });
}

export function useDeleteWater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; date: string }) => {
      const { error } = await supabase.from("water_records").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["water_today", vars.date] });
    },
  });
}

// ── Daily Health Checklist ──

export type DailyHealthItem = {
  id: string;
  checklist_id: string;
  user_id: string;
  title: string;
  category: string;
  item_type: "baseline" | "ai";
  sort_order: number;
  is_completed: boolean;
  completed_at: string | null;
  linked_goal_id: string | null;
  created_at: string;
};

export type DailyHealthChecklist = {
  id: string;
  user_id: string;
  date: string;
  generated_by: "ai" | "manual" | "mixed";
  ai_context: Record<string, unknown> | null;
  items: DailyHealthItem[];
  created_at: string;
  updated_at: string;
};

export type HealthChecklistTips = {
  tips: Array<{
    title: string;
    detail: string;
    category: string;
  }>;
  motivation: string;
};

const BASELINE_ITEMS = [
  { title: "今日饮水达标", category: "water", sort_order: 0 },
  { title: "完成今日饮食记录", category: "diet", sort_order: 1 },
  { title: "今日训练/恢复", category: "workout", sort_order: 2 },
  { title: "今晚早点休息", category: "sleep", sort_order: 3 },
] as const;

async function fetchDailyChecklist(date: string): Promise<DailyHealthChecklist | null> {
  const { data: checklist, error } = await supabase
    .from("daily_health_checklists")
    .select("*")
    .eq("date", date)
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  const { data: items } = await supabase
    .from("daily_health_items")
    .select("*")
    .eq("checklist_id", (checklist as Record<string, unknown>).id as string)
    .order("sort_order");

  return {
    ...(checklist as Record<string, unknown>),
    items: (items || []) as DailyHealthItem[],
  } as DailyHealthChecklist;
}

export function useDailyChecklist(date?: string) {
  const d = date || new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["daily_checklist", d],
    queryFn: () => fetchDailyChecklist(d),
    staleTime: 30 * 1000,
  });
}

export function useInitChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const userId = await getUserId();

      // Create checklist
      const { data: checklist, error } = await supabase
        .from("daily_health_checklists")
        .insert({ user_id: userId, date, generated_by: "mixed" })
        .select()
        .single();
      if (error) throw error;

      // Insert baseline items
      const baselineRows = BASELINE_ITEMS.map((item) => ({
        checklist_id: (checklist as Record<string, unknown>).id as string,
        user_id: userId,
        title: item.title,
        category: item.category,
        item_type: "baseline",
        sort_order: item.sort_order,
      }));

      const { error: itemsErr } = await supabase
        .from("daily_health_items")
        .insert(baselineRows);
      if (itemsErr) throw itemsErr;

      return checklist as Record<string, unknown>;
    },
    onSuccess: (_data, date) => {
      qc.invalidateQueries({ queryKey: ["daily_checklist", date] });
    },
  });
}

export function useGenerateChecklistTips() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; checklistId: string }) => {
      // Delete old AI items
      await supabase
        .from("daily_health_items")
        .delete()
        .eq("checklist_id", input.checklistId)
        .eq("item_type", "ai");

      // Call AI
      const { data, error } = await supabase.functions.invoke("health-checklist-agent", {
        body: {},
      });
      if (error) throw error;
      return data as HealthChecklistTips;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["daily_checklist", vars.date] });
    },
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; isCompleted: boolean; date: string }) => {
      const { error } = await supabase
        .from("daily_health_items")
        .update({
          is_completed: input.isCompleted,
          completed_at: input.isCompleted ? new Date().toISOString() : null,
        })
        .eq("id", input.itemId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["daily_checklist", vars.date] });
    },
  });
}

export function useInsertChecklistAiItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      date: string;
      checklistId: string;
      tips: HealthChecklistTips["tips"];
    }) => {
      const userId = await getUserId();
      const rows = input.tips.map((tip, i) => ({
        checklist_id: input.checklistId,
        user_id: userId,
        title: `${tip.title}：${tip.detail}`,
        category: tip.category,
        item_type: "ai",
        sort_order: 10 + i,
        is_completed: false,
      }));

      const { error } = await supabase
        .from("daily_health_items")
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["daily_checklist", vars.date] });
    },
  });
}

// ── Workout Journal Types ──

export type ExerciseLibraryItem = {
  id: string;
  name: string;
  category: string;
  target_muscles: string[];
  equipment: string | null;
  movement_pattern: string | null;
  instruction: string | null;
  created_at: string;
};

export type RepSet = {
  set: number;
  reps: number;
  weight: number;
  completed: boolean;
};

export type WorkoutExercise = {
  id: string;
  session_id: string;
  user_id: string;
  exercise_id: string | null;
  exercise_name: string;
  category: string | null;
  equipment: string | null;
  sets_completed: number | null;
  reps: RepSet[];
  weight_kg: number | null;
  duration_seconds: number | null;
  rest_seconds: number | null;
  sort_order: number;
  notes: string | null;
  is_bodyweight: boolean;
  created_at: string;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  date: string;
  title: string | null;
  mode: "video_follow" | "free_training";
  training_type: string | null;
  location: "居家" | "健身房" | "户外" | null;
  duration_minutes: number | null;
  feeling: string | null;
  perceived_effort: number | null;
  notes: string | null;
  source_video_id: string | null;
  ai_summary: string | null;
  ai_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
  exercises?: WorkoutExercise[];
  source_video?: WorkoutVideo | null;
};

export type WorkoutSessionInput = {
  date: string;
  title?: string;
  mode: "video_follow" | "free_training";
  training_type?: string;
  location?: "居家" | "健身房" | "户外";
  duration_minutes?: number;
  feeling?: string;
  perceived_effort?: number;
  notes?: string;
  source_video_id?: string;
  exercises?: WorkoutExerciseInput[];
};

export type WorkoutExerciseInput = {
  exercise_id?: string;
  exercise_name: string;
  category?: string;
  equipment?: string;
  sets_completed?: number;
  reps?: RepSet[];
  weight_kg?: number | null;
  duration_seconds?: number;
  rest_seconds?: number;
  sort_order?: number;
  notes?: string;
  is_bodyweight?: boolean;
};

// ── Exercise Library ──

async function fetchExerciseLibrary(): Promise<ExerciseLibraryItem[]> {
  const { data, error } = await supabase
    .from("exercise_library")
    .select("*")
    .order("category")
    .order("name");
  if (error) throw error;
  return (data || []) as ExerciseLibraryItem[];
}

export function useExerciseLibrary() {
  return useQuery({
    queryKey: ["exercise_library"],
    queryFn: fetchExerciseLibrary,
    staleTime: 10 * 60 * 1000,
  });
}

// ── Workout Sessions ──

async function fetchWorkoutSessions(startDate?: string, endDate?: string): Promise<WorkoutSession[]> {
  let query = supabase
    .from("workout_sessions")
    .select("*")
    .order("date", { ascending: false })
    .limit(100);
  if (startDate) query = query.gte("date", startDate);
  if (endDate) query = query.lte("date", endDate);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as WorkoutSession[];
}

export function useWorkoutSessions(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["workout_sessions", startDate, endDate],
    queryFn: () => fetchWorkoutSessions(startDate, endDate),
    staleTime: 30 * 1000,
  });
}

async function fetchWorkoutSession(id: string): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*, exercises:workout_exercises(*), source_video:source_video_id(*)")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as WorkoutSession;
}

export function useWorkoutSession(id: string) {
  return useQuery({
    queryKey: ["workout_session", id],
    queryFn: () => fetchWorkoutSession(id),
    staleTime: 30 * 1000,
    enabled: !!id,
  });
}

export function useCreateWorkoutSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkoutSessionInput) => {
      const userId = await getUserId();
      const { exercises, ...sessionFields } = input;

      const { data: session, error } = await supabase
        .from("workout_sessions")
        .insert({ ...sessionFields, user_id: userId })
        .select()
        .single();
      if (error) throw error;

      if (exercises && exercises.length > 0) {
        const rows = exercises.map((ex, i) => ({
          session_id: (session as Record<string, unknown>).id as string,
          user_id: userId,
          exercise_id: ex.exercise_id || null,
          exercise_name: ex.exercise_name,
          category: ex.category || null,
          equipment: ex.equipment || null,
          sets_completed: ex.sets_completed || null,
          reps: ex.reps || [],
          weight_kg: ex.weight_kg || null,
          duration_seconds: ex.duration_seconds || null,
          rest_seconds: ex.rest_seconds || null,
          sort_order: ex.sort_order ?? i,
          notes: ex.notes || null,
          is_bodyweight: ex.is_bodyweight || false,
        }));
        const { error: exErr } = await supabase.from("workout_exercises").insert(rows);
        if (exErr) throw exErr;
      }

      return session;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_sessions"] });
    },
  });
}

export function useUpdateWorkoutSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<WorkoutSessionInput>) => {
      const { id, exercises, ...fields } = input;
      const updateFields: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
      delete (updateFields as Record<string, unknown>).exercises;

      const { data, error } = await supabase
        .from("workout_sessions")
        .update(updateFields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_sessions"] });
    },
  });
}

export function useDeleteWorkoutSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workout_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_sessions"] });
    },
  });
}

// ── Workout Exercises ──

export function useAddWorkoutExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkoutExerciseInput & { session_id: string }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("workout_exercises")
        .insert({
          session_id: input.session_id,
          user_id: userId,
          exercise_id: input.exercise_id || null,
          exercise_name: input.exercise_name,
          category: input.category || null,
          equipment: input.equipment || null,
          sets_completed: input.sets_completed || null,
          reps: input.reps || [],
          weight_kg: input.weight_kg || null,
          duration_seconds: input.duration_seconds || null,
          rest_seconds: input.rest_seconds || null,
          sort_order: input.sort_order ?? 0,
          notes: input.notes || null,
          is_bodyweight: input.is_bodyweight || false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["workout_session", vars.session_id] });
      qc.invalidateQueries({ queryKey: ["workout_sessions"] });
    },
  });
}

export function useUpdateWorkoutExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; session_id: string } & Partial<WorkoutExerciseInput>) => {
      const { id, session_id: _sid, ...fields } = input;
      const { data, error } = await supabase
        .from("workout_exercises")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["workout_session", vars.session_id] });
      qc.invalidateQueries({ queryKey: ["workout_sessions"] });
    },
  });
}

// ── Health Goals (from Plan OS goals table) ──

export type HealthGoalSummary = {
  id: string;
  title: string;
  target_metric: string | null;
  current_metric: string | null;
  status: string;
  progress: number;
  target_date: string | null;
};

async function fetchHealthGoals(): Promise<HealthGoalSummary[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("id,title,target_metric,current_metric,status,progress,target_date")
    .eq("goal_category", "health")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []) as HealthGoalSummary[];
}

export function useHealthGoals() {
  return useQuery({
    queryKey: ["health_goals"],
    queryFn: fetchHealthGoals,
    staleTime: 2 * 60 * 1000,
  });
}



