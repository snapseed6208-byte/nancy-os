// ============================================
// Nancy OS — Health OS v2 Hooks
// AI-first action system: videos, recipes, meal plans, coach
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

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
  created_at: string;
};

export type Recipe = {
  id: string;
  user_id: string;
  name: string;
  source_url: string | null;
  source_platform: string | null;
  ingredients: string | null;
  steps: string | null;
  calories_per_serving: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fat_grams: number | null;
  category: string | null;
  meal_time: string[] | null;
  goal: string | null;
  health_level: string | null;
  budget_level: string | null;
  is_favorite: boolean;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
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
      const platform = detectPlatform(input.url);

      const { data, error } = await supabase
        .from("workout_videos")
        .insert({
          user_id: userId,
          url: input.url,
          platform,
          title: null,
          category: null,
          difficulty: null,
          estimated_duration: null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WorkoutVideo;
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
    mutationFn: async (input: { source_url: string }) => {
      const userId = await getUserId();
      const platform = detectPlatform(input.source_url);

      const { data, error } = await supabase
        .from("recipes")
        .insert({
          user_id: userId,
          name: "",
          source_url: input.source_url,
          source_platform: platform,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Recipe;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useUpdateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      category?: string;
      meal_time?: string[];
      goal?: string;
      ingredients?: string;
      calories_per_serving?: number;
      protein_grams?: number;
      carbs_grams?: number;
      fat_grams?: number;
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
      carb?: string;
      protein?: string;
      vegetables?: string;
      drink?: string;
      fullness?: string;
      notes?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("food_records")
        .insert({ ...input, user_id: userId })
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

export function useDeleteFoodRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("food_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food_records"] });
      qc.invalidateQueries({ queryKey: ["health_context"] });
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

// ── Helpers ──

function detectPlatform(url: string): string {
  if (url.includes("bilibili.com") || url.includes("b23.tv")) return "bilibili";
  if (url.includes("douyin.com") || url.includes("v.douyin.com")) return "douyin";
  if (url.includes("xiaohongshu.com") || url.includes("xhslink.com")) return "xiaohongshu";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  return "web";
}
