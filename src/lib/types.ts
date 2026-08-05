// ============================================
// Shared types for Nancy OS
// ============================================

// ── Enums ──

// Goal hierarchy
export const GOAL_LEVELS = ["vision", "yearly", "monthly"] as const;
export type GoalLevel = (typeof GOAL_LEVELS)[number];

export const GOAL_CATEGORIES = ["career", "health", "learning", "life", "finance"] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

// Life events
export const EVENT_CATEGORIES = [
  "education", "career", "health", "relationship", "travel", "personal_growth", "milestone", "other",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

// AI Memory
export const AI_MEMORY_TYPES = ["preference", "personality", "habit", "insight", "skill"] as const;
export type AiMemoryType = (typeof AI_MEMORY_TYPES)[number];

// Information feed
export const INFO_FEED_CATEGORIES = [
  "news", "english_material", "industry", "tech", "career", "lifestyle", "general",
] as const;
export type InfoFeedCategory = (typeof INFO_FEED_CATEGORIES)[number];

// Skill growth
export const SKILL_CATEGORIES = ["english", "career", "health", "tech", "general"] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "proficient", "expert"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

// Decision journal
export const DECISION_STATUSES = ["pending", "decided", "reviewed"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

// AI Agent
export const AGENT_TYPES = ["reflection", "career", "health", "english", "coach"] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const MOODS = [
  "开心", "平静", "焦虑", "疲惫", "难过", "生气", "迷茫", "有动力", "放松", "想哭",
] as const;
export type MoodType = (typeof MOODS)[number];

// ── Journal Entry ──

export interface JournalEntry {
  id: string;
  userId: string;
  date: string;
  title?: string;
  content?: string;
  mood?: string;
  energyLevel?: string;
  weather?: string;
  location?: string;
  topThree: string[];
  todos: { text: string; done: boolean }[];
  // AI analysis fields
  aiSummary?: string;
  aiEmotionAnalysis?: string;
  aiKeywords?: string[];
  aiThemes?: string[];
  aiEvents?: string[];
  aiPatterns: LifeAnalysisPattern[];
  aiActions: LifeAnalysisAction[];
  aiThoughts: LifeAnalysisThought[];
  aiInsights: LifeAnalysisInsight[];
  aiSuggestions: LifeAnalysisSuggestion[];
  aiAnalysisVersion?: string;
  images?: string[];
  audioUrls?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Life Analysis (AI understanding layer) ──

export interface LifeAnalysisAction {
  action: string;
  category: "workout" | "work" | "social" | "learning" | "life" | "health" | "other";
}

export interface LifeAnalysisThought {
  thought: string;
  category: "self-reflection" | "planning" | "worry" | "gratitude" | "learning" | "other";
}

export interface LifeAnalysisPattern {
  pattern: string;
  confidence: number;
  related_dates: string[];
}

export interface LifeAnalysisInsight {
  insight: string;
  category: "pattern" | "growth" | "trend" | "concern";
  confidence: number;
}

export interface LifeAnalysisSuggestion {
  suggestion: string;
  category: "rest" | "action" | "mindset" | "social" | "health";
}

export interface LifeAnalysisResult {
  success: boolean;
  summary?: string;
  emotion_analysis?: string;
  actions_count: number;
  thoughts_count: number;
  themes: string[];
  events: string[];
  patterns_count: number;
  insights_count: number;
  suggestions_count: number;
  version: string;
}

export const ENERGY_LEVELS = ["energetic", "normal", "tired", "anxious", "lazy", "tried_best"] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

export const TASK_CATEGORIES = [
  "english_os", "study_hub", "career", "tutoring", "life_admin", "ai_workflow", "reflection",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  english_os: "English OS",
  study_hub: "课程学习",
  career: "实习求职",
  tutoring: "家教",
  life_admin: "生活杂事",
  ai_workflow: "AI工具",
  reflection: "复盘反思",
};

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const EXPRESSION_TYPES = ["vocabulary", "chunk", "sentence", "sentencePattern", "speakingExpression"] as const;
export type ExpressionType = (typeof EXPRESSION_TYPES)[number];

export const EXPRESSION_STATUSES = ["new", "learning", "review", "mastered"] as const;
export type ExpressionStatus = (typeof EXPRESSION_STATUSES)[number];

export const EXPRESSION_DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ExpressionDifficultyLevel = (typeof EXPRESSION_DIFFICULTY_LEVELS)[number];

export const REVIEW_MODES = ["active_recall", "recognition", "cloze"] as const;
export type ReviewMode = (typeof REVIEW_MODES)[number];

export const REVIEW_RESULTS = ["again", "hard", "good", "easy"] as const;
export type ReviewResult = (typeof REVIEW_RESULTS)[number];

export const EXPRESSION_CATEGORIES = [
  "生活", "工作", "社交", "情绪", "旅行", "学习", "商务", "影视",
] as const;
export type ExpressionCategory = (typeof EXPRESSION_CATEGORIES)[number];

export const MONEY_CATEGORIES = [
  "dining", "transport", "study", "ai_tools", "rent_life", "fashion", "social", "tutoring_income", "other",
] as const;
export type MoneyCategory = (typeof MONEY_CATEGORIES)[number];

export const MONEY_CATEGORY_LABELS: Record<MoneyCategory, string> = {
  dining: "餐饮",
  transport: "交通",
  study: "学习",
  ai_tools: "AI/工具订阅",
  rent_life: "租房生活",
  fashion: "服饰美妆",
  social: "社交娱乐",
  tutoring_income: "家教/实习收入",
  other: "其他",
};

// ── Sidebar Navigation (9 modules) ──
export const NAV_ITEMS = [
  {
    key: "home",
    label: "首页 Dashboard",
    icon: "LayoutDashboard" as const,
    path: "/",
    description: "每日控制中心",
  },
  {
    key: "plan",
    label: "计划管理",
    icon: "CalendarCheck" as const,
    path: "/plan",
    description: "目标、任务、习惯",
  },
  {
    key: "career",
    label: "工作成长",
    icon: "Briefcase" as const,
    path: "/career",
    description: "求职、面试、职业规划",
  },
  {
    key: "english",
    label: "English OS",
    icon: "BookOpen" as const,
    path: "/english",
    description: "口语、表达库、复习",
  },
  {
    key: "health",
    label: "健康管理",
    icon: "Heart" as const,
    path: "/health",
    description: "健身、饮食、身体档案",
  },
  {
    key: "exam",
    label: "考试学习",
    icon: "GraduationCap" as const,
    path: "/exam",
    description: "IELTS、课程、证书",
  },
  {
    key: "life-trace",
    label: "Life Trace",
    icon: "Footprints" as const,
    path: "/life-trace",
    description: "日记、心情、记账",
  },
  {
    key: "ideas",
    label: "灵感库",
    icon: "Lightbulb" as const,
    path: "/ideas",
    description: "想法捕捉与整理",
  },
  {
    key: "resources",
    label: "知识库",
    icon: "FolderOpen" as const,
    path: "/resources",
    description: "资源收藏与管理",
  },
  {
    key: "review",
    label: "数据复盘",
    icon: "BarChart3" as const,
    path: "/review",
    description: "周报、月报、趋势",
  },
  {
    key: "reflection",
    label: "AI 反思",
    icon: "Brain" as const,
    path: "/reflection",
    description: "深度反思与成长洞察",
  },
  {
    key: "chinese",
    label: "中文表达",
    icon: "Mic" as const,
    path: "/chinese",
    description: "中文表达训练",
  },
  {
    key: "memory-center",
    label: "记忆中心",
    icon: "Database" as const,
    path: "/memory-center",
    description: "AI 记忆管理与确认",
  },
] as const;
export type NavKey = (typeof NAV_ITEMS)[number]["key"];

// ── Quick actions ──
export type QuickAction = {
  key: string;
  label: string;
  icon: string;
  color: string;
};

// ============================================
// Core OS Data Model Types
// ============================================

// ── Module identifiers ──
export const MODULES = [
  "english", "health", "exam", "career", "life_admin", "learning", "personal", "finance", "general",
] as const;
export type ModuleId = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleId, string> = {
  english: "English OS",
  health: "健康管理",
  exam: "考试学习",
  career: "工作成长",
  life_admin: "生活杂事",
  learning: "学习成长",
  personal: "个人",
  finance: "财务",
  general: "通用",
};

// ── Resource types ──
export const RESOURCE_TYPES = ["video", "article", "file", "course", "book", "tool", "other"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_PLATFORMS = ["bilibili", "youtube", "douyin", "xiaohongshu", "feishu", "web", "local", "other"] as const;
export type ResourcePlatform = (typeof RESOURCE_PLATFORMS)[number];

export const RESOURCE_STATUSES = ["saved", "understood", "applied"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

// ── Goal ──
export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: string;
  module?: ModuleId;
  goalLevel: GoalLevel;
  goalCategory: GoalCategory;
  targetMetric?: string;
  currentMetric?: string;
  startDate?: string;
  targetDate?: string;
  status: "active" | "completed" | "paused" | "abandoned";
  progress: number;
  why?: string;
  parentGoalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalMilestone {
  id: string;
  goalId: string;
  userId: string;
  title: string;
  targetDate?: string;
  completedAt?: string;
  sortOrder: number;
  createdAt: string;
}

// ── Task (unified across all modules) ──
export interface Task {
  id: string;
  userId: string;
  goalId?: string;
  monthlyPlanId?: string;
  title: string;
  description?: string;
  module?: ModuleId;
  priority: Priority;
  energyLevel: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "done";
  dueDate?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  isTodayFocus: boolean;
  recurringRule?: string;
  sourceType: "manual" | "ai_agent" | "goal_breakdown" | "habit_linked";
  sourceId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Recurring task fields
  taskType?: "one_time" | "recurring";
  frequencyType?: "daily" | "weekly" | "monthly";
  targetCount?: number;
  completedCount?: number;
  cycleStartDate?: string;
}

// ── Habit ──
export interface Habit {
  id: string;
  userId: string;
  title: string;
  icon?: string;
  color?: string;
  category?: string;
  module?: ModuleId;
  frequencyType: "daily" | "weekly" | "monthly";
  frequencyValue: number;
  isActive: boolean;
  streakBest: number;
  reminderTime?: string;
  createdAt: string;
}

export interface HabitRecord {
  id: string;
  habitId: string;
  userId: string;
  date: string;
  status: "completed" | "partial" | "missed";
  note?: string;
  value?: number;
  energyLevel?: number;
  createdAt: string;
}

// ── Mood ──
export interface MoodRecord {
  id: string;
  userId: string;
  date: string;
  timeOfDay?: "morning" | "afternoon" | "evening" | "night";
  mood: MoodType;
  intensity: number;
  triggerEvent?: string;
  energyLevel?: number;
  aiAnalysis?: string;
  relatedFactors?: string[];
  notes?: string;
  createdAt: string;
}

// ── Daily Review ──
export interface DailyReview {
  id: string;
  userId: string;
  date: string;
  q1WhatDone?: string;
  q2BestThing?: string;
  q3WhatChaos?: string;
  q4TomorrowFirst?: string;
  q5Spending?: string;
  dailyLog?: string;
  tasksCompletedCount: number;
  tasksTotalCount: number;
  habitsCompletedCount: number;
  habitsTotalCount: number;
  focusMinutes: number;
  moodAvg?: number;
  goalProgress: { goalId: string; goalTitle: string; progressDelta: number; note?: string }[];
  tomorrowPlan: { title: string; module?: string; priority: string; estimatedMinutes?: number }[];
  aiGrowthInsight?: string;
  aiTomorrowSuggestion?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Resource (unified library) v2 ──
export interface Resource {
  id: string;
  userId: string;
  title: string;
  description?: string;
  url?: string;
  platform?: ResourcePlatform;
  resourceType: ResourceType;
  module?: ModuleId;
  tags?: string[];
  author?: string;
  thumbnailUrl?: string;
  // Layer 1: Original Source
  sourcePlatform?: string;
  sourceAuthor?: string;
  sourceTitle?: string;
  sourceCover?: string;
  rawContent?: string;
  // Layer 2: AI Understanding
  aiSummary?: string;
  aiCategory?: string;
  aiTags?: string[];
  aiKeyPoints?: string[];
  aiImportantQuotes?: string[];
  aiActionItems?: Array<{ action: string; priority: string }>;
  aiSuggestedCategory?: string;
  aiApplicableScenarios?: string[];
  aiRelatedKnowledge?: string[];
  // Layer 3: Personal Knowledge
  status?: ResourceStatus;
  userNotes?: string;
  categoryId?: string;
  // Legacy
  isFavorite: boolean;
  isArchived: boolean;
  readProgress: number;
  metadata: Record<string, unknown>;
  relatedGoalId?: string;
  relatedTaskId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Module Stats ──
export interface ModuleStats {
  id: string;
  userId: string;
  module: ModuleId;
  date: string;
  tasksCompleted: number;
  tasksTotal: number;
  focusMinutes: number;
  streakDays: number;
  statsData: Record<string, unknown>;
  createdAt: string;
}

// ── Weekly Summary ──
export interface WeeklySummary {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  title?: string;
  overview?: string;
  highlights: { title: string; detail: string }[];
  lowlights: { title: string; detail: string }[];
  topInsight?: string;
  tasksCompleted: number;
  habitsStreakDays: number;
  englishExpressionsLearned: number;
  englishSpeakingSessions: number;
  workoutDays: number;
  moodAvg?: number;
  focusHours: number;
  nextWeekFocus?: string;
  nextWeekPlan: { title: string; module?: string }[];
  createdAt: string;
}

// ── Life Event ──
export interface LifeEvent {
  id: string;
  userId: string;
  title: string;
  date: string;
  category: EventCategory;
  description?: string;
  emotion?: string;
  reflection?: string;
  relatedGoalId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── AI Memory ──
export interface AiMemory {
  id: string;
  userId: string;
  memoryType: AiMemoryType;
  content: string;
  confidence: number;
  source?: string;
  sourceIds: string[];
  relatedEventId?: string;
  isActive: boolean;
  status: "candidate" | "probable" | "confirmed" | "rejected" | "outdated" | "pending_review";
  reinforcementCount: number;
  evidence: { table: string; source_id: string; snippet: string; extracted_at: string }[];
  lastReinforcedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryFeedback {
  id: string;
  userId: string;
  memoryId: string;
  action: "confirm" | "reject" | "modify";
  reason?: string;
  modifiedContent?: string;
  createdAt: string;
}

// ── Reflection Automation ──

export interface DailyReflectionInput {
  date: string;
  journal_entries: { id: string; title: string; content: string; mood: string; energy_level: string }[];
  mood_records: { id: string; mood: string; intensity: number; trigger_event: string; time_of_day: string }[];
  tasks: { id: string; title: string; status: string; priority: string; module: string }[];
  habit_records: { id: string; habit_id: string; status: string; note: string }[];
}

export interface DailyReflectionOutput {
  daily_summary: string;
  highlight: string;
  low_point: string;
  next_day_focus: string;
  mood_assessment: string;
  extracted_memories: Array<{
    memory_type: string;
    content: string;
    confidence: number;
    source_ids: string[];
  }>;
}

export interface WeeklyReflectionInput {
  period_start: string;
  period_end: string;
  journal_entries: { id: string; date: string; title: string; content: string; mood: string; energy_level: string }[];
  mood_records: { id: string; date: string; mood: string; intensity: number; trigger_event: string }[];
  ideas: { id: string; content: string; category: string }[];
  events: { id: string; title: string; date: string; category: string; emotion: string; reflection: string }[];
  tasks: { id: string; title: string; status: string; priority: string; module: string; completed_at: string }[];
  habit_records: { id: string; habit_id: string; date: string; status: string; note: string }[];
}

export interface WeeklyReflectionOutput {
  period_summary: string;
  mood_trends: { dominant_mood: string; trend_direction: "improving" | "stable" | "declining"; detail: string };
  behavior_patterns: Array<{ pattern: string; evidence: string; confidence: number }>;
  growth_insights: Array<{ insight: string; category: string; confidence: number }>;
  tomorrow_suggestions: Array<{ suggestion: string; priority: "high" | "medium" | "low" }>;
  extracted_memories: Array<{ memory_type: string; content: string; confidence: number; source_ids: string[] }>;
}

// ── AI Daily Brief ──

export interface DailyBriefSuggestion {
  suggestion: string;
  priority: "high" | "medium" | "low";
  action_label?: string;
  action_path?: string;
}

export interface DailyBriefWarning {
  type: "mood" | "habit" | "task" | "health" | "review" | "general";
  message: string;
}

export interface DailyBrief {
  id: string;
  userId: string;
  date: string;
  summary?: string;
  focus?: string;
  suggestions: DailyBriefSuggestion[];
  warnings: DailyBriefWarning[];
  motivation?: string;
  memoryRefs: string[];
  tokensUsed?: number;
  createdAt: string;
}

// ── Agent Feedback ──

export interface AgentFeedback {
  id: string;
  userId: string;
  agentType: string;
  referenceId?: string;
  rating: "helpful" | "not_helpful";
  reason?: string;
  createdAt: string;
}

// ── Information Feed ──
export interface InformationFeedItem {
  id: string;
  userId: string;
  title: string;
  source: string;
  url?: string;
  category: InfoFeedCategory;
  aiSummary?: string;
  tags: string[];
  isRead: boolean;
  isSaved: boolean;
  isArchived: boolean;
  relevanceScore?: number;
  publishedAt?: string;
  createdAt: string;
}

// ── Skill ──
export interface Skill {
  id: string;
  userId: string;
  name: string;
  category: SkillCategory;
  parentSkillId?: string;
  currentLevel: SkillLevel;
  targetLevel: SkillLevel;
  description?: string;
  evidence: { date: string; description: string; proof?: string; source?: string }[];
  relatedGoalId?: string;
  lastUpdated?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Decision ──
export interface Decision {
  id: string;
  userId: string;
  question: string;
  context?: string;
  options: { label: string; description?: string; pros: string[]; cons: string[]; confidence?: number }[];
  chosenOption?: string;
  reason?: string;
  expectedOutcome?: string;
  actualOutcome?: string;
  lesson?: string;
  status: DecisionStatus;
  date: string;
  relatedGoalId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Agent Log ──
export interface AgentLog {
  id: string;
  userId: string;
  agentType: AgentType;
  action: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  model?: string;
  modelVersion?: string;
  tokensUsed?: number;
  relatedGoalId?: string;
  relatedTaskId?: string;
  createdAt: string;
}
