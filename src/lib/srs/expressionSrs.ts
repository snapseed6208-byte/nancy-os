// Expression Activation SRS V2 — Standalone scheduling module

// ── Types ──

export type ReviewRating = "again" | "fuzzy" | "hard" | "good" | "easy";

export type ReviewMode = "active_recall" | "recognition" | "cloze" | "production";

export type ExpressionStage = "learning" | "activation" | "production" | "maintenance";

export type ExpressionSrsFields = {
  ease_factor: number;
  repetitions: number;
  interval_days: number;
  lapse_count: number;
  production_count: number;
  status: string;
  next_review_date: string | null;
};

export type SrsScheduleResult = {
  ease_factor: number;
  repetitions: number;
  interval_days: number;
  lapse_count: number;
  next_review_date: string;
  status: string;
  stage: ExpressionStage;
};

// ── Constants ──

export const MIN_EF = 1.3;
export const INITIAL_EF = 2.5;
export const MAX_INTERVAL = 365;

// Stage thresholds
export const ACTIVATION_REPS = 3; // need 3+ reps to enter activation stage
export const PRODUCTION_REPS = 6; // need 6+ reps + interval>=60 + 2+ productions for production
export const MASTERY_REPS = 8; // 8+ reps + interval>=90 for maintenance/mastery
export const MAINTENANCE_INTERVAL = 90;

/** Canonical 1–5 UI score mapping. */
export function ratingForRecallScore(score: number): ReviewRating {
  if (score <= 1) return "again";
  if (score === 2) return "fuzzy";
  if (score === 3) return "hard";
  if (score === 4) return "good";
  return "easy";
}

// ── SM-2 V2 Algorithm ──

/**
 * Pure function: compute next review schedule from a rating.
 *
 * V2 fixes from the original:
 * - Hard/Good no longer reset repetitions to 0
 * - Lapse tracking via lapse_count (only Again increments it)
 * - interval_days explicitly stored (not derived from date diff)
 */
export function scheduleExpressionReview(
  rating: ReviewRating,
  current: ExpressionSrsFields,
  now: Date = new Date(),
): SrsScheduleResult {
  const ef = current.ease_factor || INITIAL_EF;
  const reps = current.repetitions || 0;
  const interval = current.interval_days || 0;
  const lapses = current.lapse_count || 0;
  const productions = current.production_count || 0;

  let newEF = ef;
  let newInterval: number;
  let newReps: number;
  let newLapses = lapses;

  // EF adjustment per SM-2
  const q = ratingToQuality(rating);
  newEF = ef + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02));
  if (newEF < MIN_EF) newEF = MIN_EF;

  switch (rating) {
    case "again":
      // Complete failure: reset reps, short re-learning interval
      newLapses = lapses + 1;
      newReps = 0;
      newInterval = 1;
      break;

    case "fuzzy":
      // Partial memory: a smaller lapse. Mature intervals collapse, but less
      // aggressively than Again; the card also rolls again today in the UI.
      newReps = Math.max(0, reps - 1);
      newInterval = interval === 0
        ? 2
        : Math.min(3, Math.max(2, Math.round(interval * 0.25)));
      break;

    case "hard":
      // Recalled with significant effort: keep reps, advance slowly
      newReps = reps;
      if (interval === 0) {
        newInterval = 3;
      } else {
        newInterval = Math.min(MAX_INTERVAL, Math.max(3, Math.round(interval * 1.2)));
      }
      break;

    case "good":
      // Successful recall: advance normally
      newReps = reps + 1;
      if (interval === 0) {
        newInterval = 4;
      } else if (reps === 0) {
        newInterval = 4;
      } else {
        newInterval = Math.min(MAX_INTERVAL, Math.round(interval * newEF));
      }
      break;

    case "easy":
      // Effortless recall: accelerate
      newReps = reps + 1;
      if (interval === 0) {
        newInterval = 7;
      } else {
        newInterval = Math.min(MAX_INTERVAL, Math.max(7, Math.round(interval * newEF * 1.3)));
      }
      break;
  }

  // Determine stage and status
  const stage = determineStage(newReps, newInterval, productions);
  const status = stageToStatus(stage);

  // Compute next review date
  const nextDate = addDaysToShanghaiDate(now, newInterval);

  return {
    ease_factor: Math.round(newEF * 100) / 100,
    repetitions: newReps,
    interval_days: newInterval,
    lapse_count: newLapses,
    next_review_date: nextDate,
    status,
    stage,
  };
}

// ── Stage Determination ──

export function determineStage(
  repetitions: number,
  intervalDays: number,
  productionCount: number,
): ExpressionStage {
  if (repetitions >= MASTERY_REPS && intervalDays >= MAINTENANCE_INTERVAL) {
    return "maintenance";
  }
  if (repetitions >= PRODUCTION_REPS && intervalDays >= 60 && productionCount >= 2) {
    return "production";
  }
  if (repetitions >= ACTIVATION_REPS) {
    return "activation";
  }
  return "learning";
}

export function stageToStatus(stage: ExpressionStage): string {
  switch (stage) {
    case "maintenance":
      return "mastered";
    case "production":
    case "activation":
      return "review";
    case "learning":
    default:
      return "learning";
  }
}

// ── Helpers ──

function ratingToQuality(rating: ReviewRating): number {
  switch (rating) {
    case "again": return 0;
    case "fuzzy": return 1;
    case "hard": return 2;
    case "good": return 3;
    case "easy": return 4;
  }
}

export function addDaysToShanghaiDate(date: Date, days: number): string {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

/** Compute the number of days until next_review_date (0 if null or overdue) */
export function daysUntilDue(nextReviewDate: string | null, now: Date = new Date()): number {
  if (!nextReviewDate) return 0;
  const next = new Date(nextReviewDate + "T00:00:00");
  const diff = Math.ceil((next.getTime() - now.getTime()) / 86400000);
  return Math.max(0, diff);
}

/** True if the expression is due for review */
export function isDue(nextReviewDate: string | null, now: Date = new Date()): boolean {
  if (!nextReviewDate) return true;
  return new Date(nextReviewDate + "T00:00:00") <= now;
}

/** Get the cue type for a given review stage */
export function getStageCueType(stage: ExpressionStage): ReviewMode {
  switch (stage) {
    case "learning":
      return "active_recall"; // CN → EN
    case "activation":
      return "recognition"; // Scene → EN
    case "production":
      return "production"; // Own sentence
    case "maintenance":
      return "active_recall"; // Long-term check
  }
}

/** Check if expression is mastered (excluded from daily review) */
export function isMastered(result: SrsScheduleResult | ExpressionSrsFields): boolean {
  return "stage" in result
    ? result.stage === "maintenance"
    : determineStage(
        (result as ExpressionSrsFields).repetitions || 0,
        (result as ExpressionSrsFields).interval_days || 0,
        (result as ExpressionSrsFields).production_count || 0,
      ) === "maintenance";
}
