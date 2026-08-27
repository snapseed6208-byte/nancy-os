import {
  ratingForRecallScore,
  scheduleExpressionReview,
  type ExpressionSrsFields,
  type SrsScheduleResult,
} from "@/lib/srs/expressionSrs";
import { MAX_SAME_DAY_ATTEMPTS } from "@/lib/english/rollingReview";

export interface DailyMemoryState {
  attemptCount: number;
  finalScore: number;
  worstScore: number;
  todayPassed: boolean;
  shouldRequeue: boolean;
  hadLapse: boolean;
  hadFuzzy: boolean;
  maxAttemptsReached: boolean;
  needsRelearning: boolean;
}

/**
 * Daily pass is determined by the final attempt; cross-day memory quality is
 * determined by the worst attempt. A later same-day pass cannot erase a lapse.
 */
export function deriveDailyMemoryState(scores: number[]): DailyMemoryState {
  if (scores.length === 0) throw new Error("At least one Recall score is required");
  if (scores.some((score) => !Number.isInteger(score) || score < 1 || score > 5)) {
    throw new Error("Recall scores must be integers from 1 to 5");
  }
  const finalScore = scores[scores.length - 1];
  const worstScore = Math.min(...scores);
  const todayPassed = finalScore >= 3;
  const maxAttemptsReached = !todayPassed && scores.length >= MAX_SAME_DAY_ATTEMPTS;
  const hadLapse = scores.includes(1);
  const hadFuzzy = scores.includes(2);
  return {
    attemptCount: scores.length,
    finalScore,
    worstScore,
    todayPassed,
    shouldRequeue: !todayPassed && !maxAttemptsReached,
    hadLapse,
    hadFuzzy,
    maxAttemptsReached,
    needsRelearning: hadLapse || maxAttemptsReached,
  };
}

/** Recompute from the original pre-day snapshot; never compound attempts. */
export function scheduleDailyMemoryState(
  original: ExpressionSrsFields,
  scores: number[],
  now: Date = new Date(),
): SrsScheduleResult {
  const daily = deriveDailyMemoryState(scores);
  return scheduleExpressionReview(ratingForRecallScore(daily.worstScore), original, now);
}
