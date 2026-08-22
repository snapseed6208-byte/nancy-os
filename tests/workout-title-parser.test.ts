import { describe, expect, it } from "vitest";
import {
  canonicalEquipmentToDatabase,
  detectWorkoutFactConflicts,
  extractWorkoutFactsFromTitle,
  groundWorkoutMetadata,
  hasAnyLockedWorkoutFacts,
} from "../supabase/functions/_shared/workout-title-parser";

describe("workout title grounding parser", () => {
  it("locks the Pamela stretching regression facts", () => {
    const facts = extractWorkoutFactsFromTitle(
      "帕梅拉 - 5min 每日拉伸 - 运动后｜睡前｜清晨快速拉伸 无器械",
    );

    expect(facts.durationMinutes?.value).toBe(5);
    expect(facts.trainingType?.value).toBe("stretching");
    expect(facts.equipmentRequired?.value).toBe(false);
    expect(facts.equipment?.value).toEqual([]);
    expect(facts.scenarios?.value).toEqual(["post_workout", "before_sleep", "morning"]);
  });

  it.each([
    ["5min 每日拉伸", 5, "5min"],
    ["5 min stretch", 5, "5 min"],
    ["5mins stretch", 5, "5mins"],
    ["5 minutes stretch", 5, "5 minutes"],
    ["5分钟睡前拉伸", 5, "5分钟"],
    ["10MIN HIIT", 10, "10MIN"],
    ["15 分钟有氧", 15, "15 分钟"],
  ])("parses duration from %s", (title, expected, evidence) => {
    const fact = extractWorkoutFactsFromTitle(title).durationMinutes;
    expect(fact?.value).toBe(expected);
    expect(fact?.evidence).toBe(evidence);
    expect(fact?.source).toBe("title");
  });

  it.each([
    ["每日拉伸", "stretching"],
    ["10分钟热身", "warmup"],
    ["Recovery Flow", "recovery"],
    ["Mobility Routine", "mobility"],
    ["15min HIIT", "hiit"],
    ["低冲击有氧", "cardio"],
    ["上肢力量训练", "strength"],
    ["睡前瑜伽", "yoga"],
    ["Pilates Core", "pilates"],
    ["全身塑形", "sculpt"],
  ])("maps training type for %s", (title, expected) => {
    expect(extractWorkoutFactsFromTitle(title).trainingType?.value).toBe(expected);
  });

  it("extracts resistance-band glute and leg facts", () => {
    const facts = extractWorkoutFactsFromTitle("10分钟臀腿弹力带训练");
    expect(facts.durationMinutes?.value).toBe(10);
    expect(facts.bodyParts?.value).toEqual(["glutes", "legs"]);
    expect(facts.equipmentRequired?.value).toBe(true);
    expect(facts.equipment?.value).toEqual(["resistance_band"]);
  });

  it("extracts full-body no-equipment HIIT facts", () => {
    const facts = extractWorkoutFactsFromTitle("15min HIIT Full Body No Equipment");
    expect(facts.durationMinutes?.value).toBe(15);
    expect(facts.trainingType?.value).toBe("hiit");
    expect(facts.bodyParts?.value).toEqual(["full_body"]);
    expect(facts.equipmentRequired?.value).toBe(false);
  });

  it("extracts a bedtime stretching scenario", () => {
    const facts = extractWorkoutFactsFromTitle("5分钟睡前拉伸");
    expect(facts.trainingType?.value).toBe("stretching");
    expect(facts.scenarios?.value).toEqual(["before_sleep"]);
  });

  it("extracts dumbbell upper-body strength facts", () => {
    const facts = extractWorkoutFactsFromTitle("20分钟哑铃上肢力量");
    expect(facts.durationMinutes?.value).toBe(20);
    expect(facts.trainingType?.value).toBe("strength");
    expect(facts.bodyParts?.value).toEqual(["upper_body"]);
    expect(facts.equipment?.value).toEqual(["dumbbell"]);
  });

  it("extracts calves without inventing all leg muscles", () => {
    const facts = extractWorkoutFactsFromTitle("韩小四瘦小腿");
    expect(facts.bodyParts?.value).toEqual(["calves"]);
    expect(facts.durationMinutes).toBeUndefined();
    expect(facts.equipment).toBeUndefined();
    expect(facts.difficulty).toBeUndefined();
  });

  it("extracts warmup, band, glute and leg facts", () => {
    const facts = extractWorkoutFactsFromTitle("弹力带热身臀腿");
    expect(facts.trainingType?.value).toBe("warmup");
    expect(facts.equipment?.value).toEqual(["resistance_band"]);
    expect(facts.bodyParts?.value).toEqual(["glutes", "legs"]);
  });

  it("does not infer workout facts from a creator name", () => {
    const facts = extractWorkoutFactsFromTitle("帕梅拉日常分享");
    expect(hasAnyLockedWorkoutFacts(facts)).toBe(false);
    expect(facts.trainingType).toBeUndefined();
    expect(facts.bodyParts).toBeUndefined();
  });

  it("uses description only when the title has no duration", () => {
    const facts = extractWorkoutFactsFromTitle("晨间训练", "完整课程时长 12 minutes");
    expect(facts.durationMinutes).toMatchObject({ value: 12, source: "description" });
  });

  it("does not let description override a title duration", () => {
    const facts = extractWorkoutFactsFromTitle("5min 拉伸", "完整版 30分钟");
    expect(facts.durationMinutes).toMatchObject({ value: 5, source: "title" });
  });

  it("gives title no-equipment evidence priority over description equipment", () => {
    const facts = extractWorkoutFactsFromTitle("10min 无器械训练", "建议准备一对哑铃");
    expect(facts.equipmentRequired?.value).toBe(false);
    expect(facts.equipment?.value).toEqual([]);
  });

  it("parses explicit beginner difficulty but does not infer it from short duration", () => {
    expect(extractWorkoutFactsFromTitle("新手5分钟拉伸").difficulty?.value).toBe("beginner");
    expect(extractWorkoutFactsFromTitle("5分钟拉伸").difficulty).toBeUndefined();
  });

  it("overrides conflicting AI duration, type, equipment and muscles", () => {
    const facts = extractWorkoutFactsFromTitle("帕梅拉 - 5min 每日拉伸 无器械");
    const ai = {
      estimated_duration: 30,
      training_type: "塑形训练",
      workout_type: "sculpt",
      equipment: ["dumbbell"],
      equipment_required: true,
      target_muscles: ["臀大肌", "腹直肌"],
    };

    const conflicts = detectWorkoutFactConflicts(ai, facts);
    const final = groundWorkoutMetadata(ai, facts, false);

    expect(conflicts.map((item) => item.field)).toEqual([
      "duration_minutes",
      "workout_type",
      "equipment",
      "equipment_required",
    ]);
    expect(final.estimated_duration).toBe(5);
    expect(final.workout_type).toBe("stretching");
    expect(final.training_type).toBe("拉伸");
    expect(final.equipment).toEqual([]);
    expect(final.equipment_required).toBe(false);
    expect(final.target_muscles).toEqual([]);
    expect(final.difficulty).toBeNull();
  });

  it("keeps additional AI facts only when transcript or page content supports inference", () => {
    const facts = extractWorkoutFactsFromTitle("5min 拉伸");
    const ai = { difficulty: "中级", target_muscles: ["股四头肌"] };

    expect(groundWorkoutMetadata(ai, facts, false)).toMatchObject({
      estimated_duration: 5,
      training_type: "拉伸",
      difficulty: null,
      target_muscles: [],
    });
    expect(groundWorkoutMetadata(ai, facts, true)).toMatchObject({
      difficulty: "中级",
      target_muscles: ["股四头肌"],
    });
  });

  it("maps locked equipment to the legacy database display field", () => {
    expect(canonicalEquipmentToDatabase(["resistance_band"], true)).toBe("弹力带");
    expect(canonicalEquipmentToDatabase([], false)).toBe("无器械");
  });
});
