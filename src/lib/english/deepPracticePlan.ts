export const DEEP_PRACTICE_BATCH_SIZE = 15;
export const CLOZE_TARGET_PER_BATCH = 5;
export const SENTENCE_TARGET_PER_BATCH = 2;

export interface DeepPracticeCandidate {
  id: string;
  expressionId: string;
  recallScore: number | null;
  attemptCount: number;
  reinforcementRound: number;
  modeData?: Record<string, unknown> | null;
}

export interface DeepPracticePlan {
  clozeItemIds: string[];
  sentenceItemIds: string[];
}

interface RecallSignals {
  hadLapse: boolean;
  hadFuzzy: boolean;
}

function getRecallSignals(item: DeepPracticeCandidate): RecallSignals {
  const recall = item.modeData?.recall;
  if (!recall || typeof recall !== "object") {
    return {
      hadLapse: item.recallScore === 1,
      hadFuzzy: item.recallScore === 2,
    };
  }

  const data = recall as Record<string, unknown>;
  return {
    hadLapse: data.had_lapse === true || item.recallScore === 1,
    hadFuzzy: data.had_fuzzy === true || item.recallScore === 2,
  };
}

function difficultyRank(item: DeepPracticeCandidate): number {
  const { hadLapse, hadFuzzy } = getRecallSignals(item);
  if (hadLapse) return 0;
  if (hadFuzzy) return 1;
  if (item.recallScore === 3) return 2;
  if (item.recallScore === null) return 3;
  if (item.recallScore === 4) return 4;
  return 5;
}

function compareCandidates(a: DeepPracticeCandidate, b: DeepPracticeCandidate): number {
  const rankDifference = difficultyRank(a) - difficultyRank(b);
  if (rankDifference !== 0) return rankDifference;

  const reinforcementDifference = b.reinforcementRound - a.reinforcementRound;
  if (reinforcementDifference !== 0) return reinforcementDifference;

  const attemptDifference = b.attemptCount - a.attemptCount;
  if (attemptDifference !== 0) return attemptDifference;

  return a.id.localeCompare(b.id);
}

/**
 * Build one deterministic deep-practice sample for every loaded Recall batch.
 * Recall remains mandatory for every item; Cloze and Sentence are sampled from
 * the most difficult items, with stable item-id ordering as the rotation fallback.
 */
export function buildDeepPracticePlan<T extends DeepPracticeCandidate>(
  items: T[],
  batchSize = DEEP_PRACTICE_BATCH_SIZE,
): DeepPracticePlan {
  const safeBatchSize = Math.max(1, Math.floor(batchSize));
  const clozeItemIds: string[] = [];
  const sentenceItemIds: string[] = [];

  for (let start = 0; start < items.length; start += safeBatchSize) {
    const batch = items.slice(start, start + safeBatchSize).sort(compareCandidates);
    const clozeItems = batch.slice(0, Math.min(CLOZE_TARGET_PER_BATCH, batch.length));
    const sentenceItems = clozeItems.slice(0, Math.min(SENTENCE_TARGET_PER_BATCH, clozeItems.length));

    clozeItemIds.push(...clozeItems.map((item) => item.id));
    sentenceItemIds.push(...sentenceItems.map((item) => item.id));
  }

  return { clozeItemIds, sentenceItemIds };
}
