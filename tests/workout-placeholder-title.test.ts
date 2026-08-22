import { describe, expect, it } from "vitest";
import { isPlaceholderWorkoutTitle } from "../src/lib/utils";
import { extractWorkoutFactsFromTitle, hasAnyLockedWorkoutFacts } from "../supabase/functions/_shared/workout-title-parser";

describe("workout placeholder title protection", () => {
  it.each(["B站训练视频", "抖音训练视频", "健身视频", "训练视频", "未命名视频"])(
    "marks %s as a placeholder",
    (title) => {
      expect(isPlaceholderWorkoutTitle(title)).toBe(true);
      expect(hasAnyLockedWorkoutFacts(extractWorkoutFactsFromTitle(""))).toBe(false);
    },
  );

  it("keeps a real Pamela title and extracts locked facts", () => {
    const title = "帕梅拉 - 5min 每日拉伸 - 运动后｜睡前｜清晨快速拉伸 无器械";
    expect(isPlaceholderWorkoutTitle(title)).toBe(false);
    const facts = extractWorkoutFactsFromTitle(title);
    expect(facts.durationMinutes?.value).toBe(5);
    expect(facts.trainingType?.value).toBe("stretching");
    expect(facts.equipmentRequired?.value).toBe(false);
    expect(facts.scenarios?.value).toEqual(["post_workout", "before_sleep", "morning"]);
  });
});
