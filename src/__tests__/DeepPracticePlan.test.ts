import { describe, expect, it } from "vitest";
import {
  buildDeepPracticePlan,
  CLOZE_TARGET_PER_BATCH,
  SENTENCE_TARGET_PER_BATCH,
} from "@/lib/english/deepPracticePlan";

function candidate(
  id: string,
  recallScore: number | null = 4,
  modeData: Record<string, unknown> | null = null,
) {
  return {
    id,
    expressionId: `expression-${id}`,
    recallScore,
    attemptCount: 1,
    reinforcementRound: 0,
    modeData,
  };
}

describe("deep-practice sampling", () => {
  it("keeps Recall broad while limiting each 15-card batch to 5 Cloze and 2 Sentence targets", () => {
    const items = Array.from({ length: 15 }, (_, index) => candidate(`item-${String(index).padStart(2, "0")}`));
    const plan = buildDeepPracticePlan(items);

    expect(plan.clozeItemIds).toHaveLength(CLOZE_TARGET_PER_BATCH);
    expect(plan.sentenceItemIds).toHaveLength(SENTENCE_TARGET_PER_BATCH);
    expect(plan.sentenceItemIds.every((id) => plan.clozeItemIds.includes(id))).toBe(true);
  });

  it("adds independent sampled targets for every appended batch", () => {
    const items = Array.from({ length: 30 }, (_, index) => candidate(`item-${String(index).padStart(2, "0")}`));
    const plan = buildDeepPracticePlan(items);

    expect(plan.clozeItemIds).toHaveLength(10);
    expect(plan.sentenceItemIds).toHaveLength(4);
    expect(plan.clozeItemIds.filter((id) => Number(id.slice(-2)) < 15)).toHaveLength(5);
    expect(plan.clozeItemIds.filter((id) => Number(id.slice(-2)) >= 15)).toHaveLength(5);
  });

  it("prioritizes cards that lapsed or felt fuzzy during Recall, even after they later pass", () => {
    const items = [
      candidate("easy-a", 5),
      candidate("fuzzy", 4, { recall: { had_fuzzy: true } }),
      candidate("hard", 3),
      candidate("lapse", 4, { recall: { had_lapse: true } }),
      candidate("easy-b", 5),
      candidate("good-a", 4),
      candidate("good-b", 4),
    ];
    const plan = buildDeepPracticePlan(items);

    expect(plan.clozeItemIds.slice(0, 3)).toEqual(["lapse", "fuzzy", "hard"]);
    expect(plan.sentenceItemIds).toEqual(["lapse", "fuzzy"]);
  });

  it("is deterministic across refreshes and handles a short final batch", () => {
    const items = [candidate("c"), candidate("a"), candidate("b")];

    expect(buildDeepPracticePlan(items)).toEqual(buildDeepPracticePlan(items));
    expect(buildDeepPracticePlan(items)).toEqual({
      clozeItemIds: ["a", "b", "c"],
      sentenceItemIds: ["a", "b"],
    });
  });
});
