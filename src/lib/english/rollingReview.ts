import type { SessionItem } from "@/lib/hooks/useReviewSession";

/** A difficult card may stop rolling today, but it never counts as passed. */
export const MAX_SAME_DAY_ATTEMPTS = 4;

export function isRecallPassScore(score: number): boolean {
  return score >= 3;
}

export function isRecallPassed(item: Pick<SessionItem, "recallScore" | "status">): boolean {
  return item.recallScore !== null && isRecallPassScore(item.recallScore) && item.status !== "reinforcement" && item.status !== "failed";
}

export function reachedRecallAttemptLimit(item: Pick<SessionItem, "attemptCount" | "recallScore">): boolean {
  return item.attemptCount >= MAX_SAME_DAY_ATTEMPTS
    && item.recallScore !== null
    && !isRecallPassScore(item.recallScore);
}

/** Resolved means passed OR safely stopped after the daily cap. */
export function isRecallResolved(item: Pick<SessionItem, "attemptCount" | "recallScore" | "status">): boolean {
  return isRecallPassed(item) || reachedRecallAttemptLimit(item);
}

export function countRecallResolved(items: SessionItem[]): number {
  return items.filter(isRecallResolved).length;
}

/**
 * Rebuild the recall queue from persisted item state.
 * Never-attempted cards stay first; failed cards resume near the tail.
 */
export function buildRecallQueue(items: SessionItem[]): string[] {
  const fresh = items.filter((item) => item.attemptCount === 0 && !isRecallResolved(item));
  const reinforcement = items.filter((item) => item.attemptCount > 0 && !isRecallResolved(item));
  return [...fresh, ...reinforcement].map((item) => item.id);
}

export interface RecallAttemptTransition {
  passed: boolean;
  resolved: boolean;
  shouldRequeue: boolean;
  nextAttemptCount: number;
  nextReinforcementRound: number;
  status: SessionItem["status"];
}

export function transitionRecallAttempt(
  item: Pick<SessionItem, "attemptCount" | "reinforcementRound">,
  score: number,
): RecallAttemptTransition {
  const passed = isRecallPassScore(score);
  const nextAttemptCount = item.attemptCount + 1;
  const atLimit = !passed && nextAttemptCount >= MAX_SAME_DAY_ATTEMPTS;
  return {
    passed,
    resolved: passed || atLimit,
    shouldRequeue: !passed && !atLimit,
    nextAttemptCount,
    nextReinforcementRound: passed ? item.reinforcementRound : item.reinforcementRound + 1,
    status: passed ? "passed" : atLimit ? "completed" : "reinforcement",
  };
}

/** Append to the tail, with no duplicate pending occurrence. */
export function requeueNearTail(queue: string[], itemId: string): string[] {
  return [...queue, itemId];
}
