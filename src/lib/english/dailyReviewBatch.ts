export const REVIEW_BATCH_SIZE = 15;

export interface DailyReviewPoolProgressInput {
  snapshotTotal: number;
  loadedCount: number;
  recallCompleted: number;
  eligibleOutsideSession: number;
}

export interface DailyReviewPoolProgress {
  total: number;
  completed: number;
  remaining: number;
  loadedCount: number;
  unloadedRemaining: number;
  nextBatchSize: number;
}

export interface ReconciledDailyReviewProgress {
  progress: DailyReviewPoolProgress;
  reconciled: boolean;
}

/**
 * Keep today's denominator monotonic after SM-2 moves completed expressions
 * out of the live due query. Newly due, not-yet-loaded expressions may grow it.
 */
export function deriveDailyReviewProgress(input: DailyReviewPoolProgressInput): DailyReviewPoolProgress {
  const loadedCount = Math.max(0, Math.floor(input.loadedCount));
  const completed = Math.min(loadedCount, Math.max(0, Math.floor(input.recallCompleted)));
  const liveTaskUniverse = loadedCount + Math.max(0, Math.floor(input.eligibleOutsideSession));
  const total = Math.max(completed, loadedCount, Math.floor(input.snapshotTotal), liveTaskUniverse);
  const remaining = Math.max(total - completed, 0);
  const unloadedRemaining = Math.max(total - loadedCount, 0);

  return {
    total,
    completed,
    remaining,
    loadedCount,
    unloadedRemaining,
    nextBatchSize: Math.min(REVIEW_BATCH_SIZE, unloadedRemaining),
  };
}

/** Shrink a stale snapshot only after the eligible outside pool was successfully rechecked. */
export function reconcileDailyReviewProgress(
  input: DailyReviewPoolProgressInput,
): ReconciledDailyReviewProgress {
  const stableProgress = deriveDailyReviewProgress(input);
  const observedProgress = deriveDailyReviewProgress({ ...input, snapshotTotal: 0 });
  if (observedProgress.total >= stableProgress.total) {
    return { progress: stableProgress, reconciled: false };
  }
  return { progress: observedProgress, reconciled: true };
}

export function isLoadedBatchComplete(
  loadedCount: number,
  recallCompleted: number,
  clozeCompleted: number,
  sentenceCompleted: number,
): boolean {
  return loadedCount > 0
    && recallCompleted >= loadedCount
    && clozeCompleted >= loadedCount
    && sentenceCompleted >= loadedCount;
}

export function isDailyReviewComplete(
  total: number,
  remaining: number,
  loadedTrainingComplete: boolean,
): boolean {
  return total > 0 && remaining === 0 && loadedTrainingComplete;
}
