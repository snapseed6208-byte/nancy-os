// ============================================
// Habit Lab — Types
// Rows mirror the SQL schema (snake_case).
// Derived types describe computed UI state.
// ============================================

// ── DB row shapes ──

export type HabitSprintRow = {
  id: string;
  user_id: string;
  title: string;
  icon: string;
  cue_sentence: string;
  trigger: string | null;
  location: string | null;
  minimum_action: string;
  identity_statement: string | null;
  duration_days: number;
  start_date: string; // YYYY-MM-DD (Beijing)
  status: "active" | "paused" | "completed" | "archived";
  completed_at: string | null;
  created_at: string;
};

export type HabitSprintLogRow = {
  id: string;
  sprint_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD (Beijing)
  status: "completed" | "skipped";
  note: string | null;
  created_at: string;
};

export type HabitRewardRow = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  points_required: number;
  status: "active" | "redeemed";
  redeemed_at: string | null;
  sort_order: number;
  created_at: string;
};

export type HabitReviewRow = {
  id: string;
  sprint_id: string;
  user_id: string;
  completed_days: number;
  total_days: number;
  completion_rate: number;
  longest_streak: number;
  points_earned: number;
  easiest_context: string | null;
  primary_friction: string | null;
  next_action: string | null;
  created_at: string;
};

// ── Derived UI state ──

export type DayCellStatus = "completed" | "skipped" | "missed" | "due" | "future";

export type SprintPhase =
  | "scheduled"   // today is before start_date
  | "active"      // today within [start, end], day actionable
  | "paused"
  | "reviewable"  // all days elapsed, 21-day review available
  | "completed"   // review finalized
  | "archived";

export type SprintDayCell = {
  date: string;
  dayNumber: number;
  status: DayCellStatus;
  isToday: boolean;
};

export type SprintTimeline = {
  phase: SprintPhase;
  totalDays: number;
  endDate: string;
  currentDay: number | null; // Day number for today (null if not started)
  completedCount: number;
  skippedCount: number;
  missedCount: number;
  longestStreak: number;
  days: SprintDayCell[]; // full duration, one per day
};

export type SprintPoints = {
  completionPoints: number; // 10 × completed days
  streakBonus: number;      // +10 @3, +30 @7 (longest run so far)
  completionBonus: number;  // +100 when sprint finalized
  total: number;
};

export type LogByDate = Map<string, "completed" | "skipped">;

export type CueInput = {
  trigger?: string | null;
  location?: string | null;
  minimumAction: string;
};

export type RewardMatch = {
  reward: HabitRewardRow | null;
  /** points still short of the next unlockable shelf */
  pointsShort: number;
  /** balance overall */
  balance: number;
};

// ── Home daily-action surface ──

/** One sprint folded into the Home "today" summary (phase + today's explicit log). */
export type TodaySprintItem = {
  sprint: HabitSprintRow;
  phase: SprintPhase;
  currentDay: number | null;
  totalDays: number;
  endDate: string;
  todayStatus: "completed" | "skipped" | null;
};

/** Single source of truth for Home's 今日实验 card + daily-action section. */
export type HabitLabTodaySummary = {
  /** true when at least one active/paused sprint exists at all */
  hasExperiments: boolean;
  /** sprints whose window contains today (check-in available) */
  due: TodaySprintItem[];
  /** active sprints that ran past their window, awaiting the 复盘 review */
  reviewable: TodaySprintItem[];
  paused: TodaySprintItem[];
  scheduled: TodaySprintItem[];
  doneCount: number;      // due sprints completed today
  handledCount: number;   // due sprints with any explicit log today (completed or skipped)
  remainingCount: number; // due sprints with no log today
  allHandled: boolean;    // due.length > 0 && remainingCount === 0
  allCompleted: boolean;  // due.length > 0 && doneCount === due.length
};
