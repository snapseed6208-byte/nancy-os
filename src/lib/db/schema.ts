import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  date,
  time,
  timestamp,
  jsonb,
  smallint,
  unique,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── helper: user_id FK ──
const userId = (name = "user_id") =>
  uuid(name)
    .notNull()
    .references((): AnyPgColumn => authUsers.id, { onDelete: "cascade" });

// Drizzle doesn't manage auth.users — we reference it as a virtual table
const authUsers = pgTable("auth_users", {
  id: uuid("id").primaryKey(),
});

// ============================================
// 1. Profiles
// ============================================
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  timezone: text("timezone").default("Asia/Shanghai"),
  languagePreference: text("language_preference").default("zh"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 2. Goals & Plans
// ============================================
export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  module: text("module"),
  goalLevel: text("goal_level").default("monthly"),
  goalCategory: text("goal_category").default("life"),
  targetMetric: text("target_metric"),
  currentMetric: text("current_metric"),
  startDate: date("start_date"),
  targetDate: date("target_date"),
  status: text("status").notNull().default("active"),
  progress: real("progress").default(0),
  why: text("why"),
  parentGoalId: uuid("parent_goal_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const goalMilestones = pgTable("goal_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
  userId: userId(),
  title: text("title").notNull(),
  targetDate: date("target_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  sortOrder: smallint("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const monthlyPlans = pgTable("monthly_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  year: smallint("year").notNull(),
  month: smallint("month").notNull(),
  focusArea: text("focus_area"),
  theme: text("theme"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.year, t.month)]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
  monthlyPlanId: uuid("monthly_plan_id").references(() => monthlyPlans.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  module: text("module"),
  priority: text("priority").notNull().default("medium"),
  energyCost: text("energy_cost").notNull().default("medium"),
  energyLevel: text("energy_level").default("medium"),
  timeSlot: text("time_slot"),
  status: text("status").notNull().default("pending"),
  dueDate: date("due_date"),
  estimatedMinutes: integer("estimated_minutes"),
  actualMinutes: integer("actual_minutes"),
  isTodayFocus: boolean("is_today_focus").default(false),
  recurringRule: text("recurring_rule"),
  sourceType: text("source_type").default("manual"),
  sourceId: uuid("source_id"),
  aiReviewStatus: text("ai_review_status"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const habits = pgTable("habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  title: text("title").notNull(),
  icon: text("icon"),
  color: text("color"),
  category: text("category"),
  module: text("module"),
  frequencyType: text("frequency_type").notNull().default("daily"),
  frequencyValue: smallint("frequency_value").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  streakBest: integer("streak_best").default(0),
  reminderTime: time("reminder_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const habitRecords = pgTable("habit_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  habitId: uuid("habit_id")
    .notNull()
    .references(() => habits.id, { onDelete: "cascade" }),
  userId: userId(),
  date: date("date").notNull(),
  status: text("status").notNull().default("completed"),
  note: text("note"),
  value: real("value"),
  energyLevel: smallint("energy_level"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.habitId, t.date)]);

// ============================================
// 3. English OS
// ============================================
export const expressions = pgTable("expressions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  english: text("english").notNull(),
  chinese: text("chinese").notNull(),
  type: text("type").notNull(),
  pronunciation: text("pronunciation"),
  exampleSentence: text("example_sentence"),
  scene: text("scene").notNull().default("daily life"),
  usefulnessLevel: smallint("usefulness_level").notNull().default(3),
  status: text("status").notNull().default("new"),
  masteryLevel: smallint("mastery_level").default(0),
  nextReviewDate: timestamp("next_review_date", { withTimezone: true }),
  reviewCount: integer("review_count").notNull().default(0),
  lastReviewResult: text("last_review_result"),
  streak: integer("streak").notNull().default(0),
  sourceText: text("source_text"),
  notes: text("notes"),
  synonyms: text("synonyms"),
  englishExplanation: text("english_explanation"),
  nativeUsage: text("native_usage"),
  situation: text("situation"),
  formality: text("formality"),
  topic: text("topic"),
  importedFrom: text("imported_from"),
  source: text("source"),
  archived: boolean("archived").notNull().default(false),
  fluencyScore: real("fluency_score"),
  grammarScore: real("grammar_score"),
  vocabularyScore: real("vocabulary_score"),
  naturalnessScore: real("naturalness_score"),
  lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true }),
  aiModel: text("ai_model"),
  aiPromptVersion: text("ai_prompt_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const speakingSessions = pgTable("speaking_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  prompt: text("prompt").notNull(),
  context: text("context"),
  expressionIds: text("expression_ids").notNull().default("[]"),
  expressionsSnapshot: text("expressions_snapshot").notNull().default("[]"),
  status: text("status").notNull().default("saved"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const speakingAttempts = pgTable("speaking_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => speakingSessions.id, { onDelete: "cascade" }),
  userId: userId(),
  transcribedText: text("transcribed_text"),
  answer: text("answer").notNull(),
  naturalVersion: text("natural_version").notNull(),
  mainProblems: text("main_problems"),
  usefulCorrections: text("useful_corrections"),
  betterChunks: text("better_chunks"),
  oneBetterExample: text("one_better_example"),
  combinedFeedback: text("combined_feedback").notNull(),
  fluencyScore: real("fluency_score"),
  grammarScore: real("grammar_score"),
  vocabularyScore: real("vocabulary_score"),
  naturalnessScore: real("naturalness_score"),
  audioUrl: text("audio_url"),
  audioDuration: real("audio_duration"),
  aiModel: text("ai_model"),
  aiPromptVersion: text("ai_prompt_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expressionReviews = pgTable("expression_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  expressionId: uuid("expression_id")
    .notNull()
    .references(() => expressions.id, { onDelete: "cascade" }),
  result: text("result").notNull(),
  previousInterval: integer("previous_interval"),
  newInterval: integer("new_interval"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 4. Learning Resources
// ============================================
export const learningResources = pgTable("learning_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  platform: text("platform"),
  author: text("author"),
  category: text("category"),
  aiSummary: text("ai_summary"),
  aiCategory: text("ai_category"),
  tags: text("tags").array(),
  isFavorite: boolean("is_favorite").notNull().default(false),
  notes: text("notes"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 5. Health — Fitness
// ============================================
export const bodyProfiles = pgTable("body_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId().unique(),
  height: real("height"),
  weight: real("weight"),
  targetWeight: real("target_weight"),
  bodyFatPercentage: real("body_fat_percentage"),
  targetBodyFat: real("target_body_fat"),
  fitnessGoal: text("fitness_goal"),
  focusAreas: text("focus_areas").array(),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workoutVideos = pgTable("workout_videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  url: text("url").notNull(),
  platform: text("platform").notNull(),
  title: text("title"),
  author: text("author"),
  trainingType: text("training_type"),
  targetMuscles: text("target_muscles").array(),
  difficulty: text("difficulty"),
  estimatedDuration: integer("estimated_duration"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workoutPlans = pgTable("workout_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  date: date("date").notNull(),
  title: text("title"),
  planData: jsonb("plan_data").notNull().default("{}"),
  status: text("status").notNull().default("planned"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.date)]);

export const workoutRecords = pgTable("workout_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  planId: uuid("plan_id").references(() => workoutPlans.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  exerciseName: text("exercise_name").notNull(),
  setsCompleted: integer("sets_completed"),
  repsPerSet: text("reps_per_set"),
  weightUsed: real("weight_used"),
  durationMinutes: integer("duration_minutes"),
  perceivedEffort: smallint("perceived_effort"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 6. Health — Food
// ============================================
export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  name: text("name").notNull(),
  sourceUrl: text("source_url"),
  sourcePlatform: text("source_platform"),
  ingredients: text("ingredients"),
  steps: text("steps"),
  caloriesPerServing: integer("calories_per_serving"),
  proteinGrams: real("protein_grams"),
  carbsGrams: real("carbs_grams"),
  fatGrams: real("fat_grams"),
  category: text("category"),
  mealTime: text("meal_time").array(),
  healthLevel: text("health_level"),
  budgetLevel: text("budget_level"),
  isCustom: boolean("is_custom").notNull().default(false),
  isFavorite: boolean("is_favorite").notNull().default(false),
  notes: text("notes"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const foodRecords = pgTable("food_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  mealType: text("meal_type").notNull(),
  foodName: text("food_name").notNull(),
  carb: text("carb"),
  protein: text("protein"),
  vegetables: text("vegetables"),
  drink: text("drink"),
  fullness: text("fullness"),
  healthFeeling: text("health_feeling"),
  checklist: jsonb("checklist").default("{}"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 7. Journal & Mood
// ============================================
export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  date: date("date").notNull(),
  title: text("title"),
  content: text("content"),
  rawTranscript: text("raw_transcript"),
  mood: text("mood"),
  entryType: text("entry_type"),
  energyLevel: text("energy_level"),
  topThree: jsonb("top_three").default("[]"),
  todos: jsonb("todos").default("[]"),
  aiSummary: text("ai_summary"),
  aiEmotionAnalysis: text("ai_emotion_analysis"),
  aiKeywords: text("ai_keywords").array(),
  aiEvents: text("ai_events").array(),
  images: text("images").array(),
  audioUrls: text("audio_urls").array(),
  weather: text("weather"),
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.date)]);

export const moodRecords = pgTable("mood_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  date: date("date").notNull(),
  timeOfDay: text("time_of_day"),
  mood: text("mood").notNull(),
  intensity: smallint("intensity"),
  triggerEvent: text("trigger_event"),
  energyLevel: smallint("energy_level"),
  aiAnalysis: text("ai_analysis"),
  relatedFactors: text("related_factors").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 8. Money
// ============================================
export const moneyRecords = pgTable("money_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  date: date("date").notNull(),
  amount: real("amount").notNull(),
  type: text("type").notNull(), // expense | income
  category: text("category").notNull(),
  necessity: text("necessity"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 9. Weekly Themes
// ============================================
export const weeklyThemes = pgTable("weekly_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  templateId: text("template_id"),
  title: text("title").notNull(),
  category: text("category").notNull(),
  icon: text("icon"),
  color: text("color"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  weeklyGoal: text("weekly_goal"),
  dailyAction: text("daily_action"),
  minimumStandard: text("minimum_standard"),
  checkInType: text("check_in_type"),
  status: text("status").notNull().default("active"),
  checkIns: jsonb("check_ins").default("[]"),
  review: jsonb("review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 10. Daily Reviews
// ============================================
export const dailyReviews = pgTable("daily_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  date: date("date").notNull(),
  q1WhatDone: text("q1_what_done"),
  q2BestThing: text("q2_best_thing"),
  q3WhatChaos: text("q3_what_chaos"),
  q4TomorrowFirst: text("q4_tomorrow_first"),
  q5Spending: text("q5_spending"),
  dailyLog: text("daily_log"),
  tasksCompletedCount: integer("tasks_completed_count").default(0),
  tasksTotalCount: integer("tasks_total_count").default(0),
  habitsCompletedCount: integer("habits_completed_count").default(0),
  habitsTotalCount: integer("habits_total_count").default(0),
  focusMinutes: integer("focus_minutes").default(0),
  moodAvg: real("mood_avg"),
  goalProgress: jsonb("goal_progress").default("[]"),
  tomorrowPlan: jsonb("tomorrow_plan").default("[]"),
  aiGrowthInsight: text("ai_growth_insight"),
  aiTomorrowSuggestion: text("ai_tomorrow_suggestion"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.date)]);

// ============================================
// 11. Ideas
// ============================================
export const ideas = pgTable("ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  content: text("content").notNull(),
  contentType: text("content_type").default("text"),
  mediaUrls: jsonb("media_urls").default([]),
  category: text("category"),
  aiCategory: text("ai_category"),
  status: text("status").notNull().default("pending"),
  relatedGoalId: uuid("related_goal_id").references(() => goals.id, { onDelete: "set null" }),
  relatedTaskId: uuid("related_task_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 12. Career
// ============================================
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  companyName: text("company_name").notNull(),
  position: text("position").notNull(),
  jdText: text("jd_text"),
  jdUrl: text("jd_url"),
  salaryRange: text("salary_range"),
  location: text("location"),
  industry: text("industry"),
  status: text("status").notNull().default("saved"),
  appliedDate: date("applied_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const interviews = pgTable("interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  roundNumber: smallint("round_number").notNull().default(1),
  interviewDate: timestamp("interview_date", { withTimezone: true }),
  interviewer: text("interviewer"),
  format: text("format"),
  questionsAsked: text("questions_asked").array(),
  selfAssessment: text("self_assessment"),
  aiFeedback: text("ai_feedback"),
  result: text("result"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 13. AI Agent
// ============================================
export const aiInsights = pgTable("ai_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  agentType: text("agent_type").notNull(),
  insightType: text("insight_type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  data: jsonb("data").default("{}"),
  isRead: boolean("is_read").notNull().default(false),
  isActedOn: boolean("is_acted_on").notNull().default(false),
  generatedAt: date("generated_at").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const newsDigests = pgTable("news_digests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  date: date("date").notNull(),
  sourceType: text("source_type").notNull(),
  sourceName: text("source_name"),
  title: text("title").notNull(),
  url: text("url"),
  summary: text("summary").notNull(),
  category: text("category"),
  relevanceScore: real("relevance_score"),
  isRead: boolean("is_read").notNull().default(false),
  isSaved: boolean("is_saved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 14. Unified Resources (002 new)
// ============================================
export const resources = pgTable("resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url"),
  platform: text("platform"),
  resourceType: text("resource_type").notNull().default("article"),
  module: text("module"),
  tags: text("tags").array(),
  author: text("author"),
  thumbnailUrl: text("thumbnail_url"),
  aiSummary: text("ai_summary"),
  aiCategory: text("ai_category"),
  aiTags: text("ai_tags").array(),
  isFavorite: boolean("is_favorite").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  readProgress: real("read_progress").default(0),
  metadata: jsonb("metadata").default("{}"),
  relatedGoalId: uuid("related_goal_id").references(() => goals.id, { onDelete: "set null" }),
  relatedTaskId: uuid("related_task_id").references(() => tasks.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 15. Module Stats (002 new)
// ============================================
export const moduleStats = pgTable("module_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  module: text("module").notNull(),
  date: date("date").notNull(),
  tasksCompleted: integer("tasks_completed").default(0),
  tasksTotal: integer("tasks_total").default(0),
  focusMinutes: integer("focus_minutes").default(0),
  streakDays: integer("streak_days").default(0),
  statsData: jsonb("stats_data").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.module, t.date)]);

// ============================================
// 16. Weekly Summaries (002 new)
// ============================================
export const weeklySummaries = pgTable("weekly_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  title: text("title"),
  overview: text("overview"),
  highlights: jsonb("highlights").default("[]"),
  lowlights: jsonb("lowlights").default("[]"),
  topInsight: text("top_insight"),
  tasksCompleted: integer("tasks_completed").default(0),
  habitsStreakDays: integer("habits_streak_days").default(0),
  englishExpressionsLearned: integer("english_expressions_learned").default(0),
  englishSpeakingSessions: integer("english_speaking_sessions").default(0),
  workoutDays: integer("workout_days").default(0),
  moodAvg: real("mood_avg"),
  focusHours: real("focus_hours"),
  nextWeekFocus: text("next_week_focus"),
  nextWeekPlan: jsonb("next_week_plan").default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.weekStart)]);

// ============================================
// 17. Life Events (003 new)
// ============================================
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  title: text("title").notNull(),
  date: date("date").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  emotion: text("emotion"),
  reflection: text("reflection"),
  relatedGoalId: uuid("related_goal_id").references(() => goals.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 18. AI Memories (003 new)
// ============================================
export const aiMemories = pgTable("ai_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  memoryType: text("memory_type").notNull(),
  content: text("content").notNull(),
  confidence: real("confidence").default(0.5),
  source: text("source"),
  sourceIds: jsonb("source_ids").default("[]"),
  relatedEventId: uuid("related_event_id").references(() => events.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("candidate"),
  reinforcementCount: integer("reinforcement_count").default(1),
  evidence: jsonb("evidence").default("[]"),
  lastReinforcedAt: timestamp("last_reinforced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 18b. Memory Feedback (006 new)
// ============================================
export const memoryFeedback = pgTable("memory_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  memoryId: uuid("memory_id").notNull().references(() => aiMemories.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  reason: text("reason"),
  modifiedContent: text("modified_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 18c. AI Daily Briefs (007 new)
// ============================================
export const aiDailyBriefs = pgTable("ai_daily_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  date: date("date").notNull(),
  summary: text("summary"),
  focus: text("focus"),
  suggestions: jsonb("suggestions").default("[]"),
  warnings: jsonb("warnings").default("[]"),
  motivation: text("motivation"),
  memoryRefs: uuid("memory_refs").array().default([]),
  tokensUsed: integer("tokens_used"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueUserDate: unique().on(table.userId, table.date),
}));

// ============================================
// 18d. Agent Feedback (008 new)
// ============================================
export const agentFeedback = pgTable("agent_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  agentType: text("agent_type").notNull(),
  referenceId: uuid("reference_id"),
  rating: text("rating").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 19. Information Feed (003 new)
// ============================================
export const informationFeed = pgTable("information_feed", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  url: text("url"),
  category: text("category").notNull().default("general"),
  aiSummary: text("ai_summary"),
  tags: text("tags").array(),
  isRead: boolean("is_read").notNull().default(false),
  isSaved: boolean("is_saved").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  relevanceScore: real("relevance_score"),
  publishedAt: date("published_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 20. Skills (004 new)
// ============================================
export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  name: text("name").notNull(),
  category: text("category").notNull().default("general"),
  parentSkillId: uuid("parent_skill_id"),
  currentLevel: text("current_level").notNull().default("beginner"),
  targetLevel: text("target_level").notNull().default("proficient"),
  description: text("description"),
  evidence: jsonb("evidence").default("[]"),
  relatedGoalId: uuid("related_goal_id").references(() => goals.id, { onDelete: "set null" }),
  lastUpdated: date("last_updated"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 21. Decision Journal (004 new)
// ============================================
export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  question: text("question").notNull(),
  context: text("context"),
  options: jsonb("options").notNull().default("[]"),
  chosenOption: text("chosen_option"),
  reason: text("reason"),
  expectedOutcome: text("expected_outcome"),
  actualOutcome: text("actual_outcome"),
  lesson: text("lesson"),
  status: text("status").notNull().default("pending"),
  date: date("date").notNull(),
  relatedGoalId: uuid("related_goal_id").references(() => goals.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// 22. Agent Logs (004 new)
// ============================================
export const agentLogs = pgTable("agent_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userId(),
  agentType: text("agent_type").notNull(),
  action: text("action").notNull(),
  inputData: jsonb("input_data").notNull().default("{}"),
  outputData: jsonb("output_data").notNull().default("{}"),
  model: text("model"),
  modelVersion: text("model_version"),
  tokensUsed: integer("tokens_used"),
  relatedGoalId: uuid("related_goal_id").references(() => goals.id, { onDelete: "set null" }),
  relatedTaskId: uuid("related_task_id").references(() => tasks.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
