// ============================================
// Habit Lab — Domain Logic Tests
// Day math, sprint timeline states, points, cue sentences.
// ============================================

import { describe, it, expect } from "vitest";
import {
  addDays, diffDays, getDayNumber, dateRange,
  buildSprintTimeline, computePoints, buildCueSentence, completionRatePercent,
} from "@/lib/habits/logic";

const spr = (startDate: string, opts: Partial<{ duration: number; status: "active" | "paused" | "completed" | "archived" }> = {}) => ({
  start_date: startDate,
  duration_days: opts.duration ?? 21,
  status: opts.status ?? "active",
});

describe("calendar math", () => {
  it("adds days across a year boundary", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("diffDays is calendar-based and sign-correct", () => {
    expect(diffDays("2026-09-01", "2026-09-05")).toBe(4);
    expect(diffDays("2026-09-05", "2026-09-01")).toBe(-4);
    expect(diffDays("2026-02-28", "2026-03-01")).toBe(1); // leap year
  });
  it("getDayNumber is 1-based and null before start", () => {
    expect(getDayNumber("2026-09-01", "2026-09-01")).toBe(1);
    expect(getDayNumber("2026-09-01", "2026-09-05")).toBe(5);
    expect(getDayNumber("2026-09-01", "2026-08-31")).toBeNull();
  });
  it("dateRange yields exactly durationDays consecutive dates", () => {
    const r = dateRange("2026-09-01", 21);
    expect(r).toHaveLength(21);
    expect(r[0]).toBe("2026-09-01");
    expect(r[20]).toBe("2026-09-21");
  });
});

describe("buildSprintTimeline", () => {
  it("active sprint: completed/skipped tallied, today is 'due', future pending", () => {
    const tl = buildSprintTimeline(
      spr("2026-09-01"),
      [
        { date: "2026-09-01", status: "completed" },
        { date: "2026-09-02", status: "completed" },
        { date: "2026-09-03", status: "completed" },
        { date: "2026-09-04", status: "skipped" },
      ],
      "2026-09-05", // day 5
    );
    expect(tl.phase).toBe("active");
    expect(tl.currentDay).toBe(5);
    expect(tl.completedCount).toBe(3);
    expect(tl.skippedCount).toBe(1);
    expect(tl.missedCount).toBe(0);
    expect(tl.longestStreak).toBe(3);
    expect(tl.days[3].status).toBe("skipped");
    expect(tl.days[4].status).toBe("due"); // today
    expect(tl.days[4].isToday).toBe(true);
    expect(tl.days[5].status).toBe("future");
    expect(tl.days[0].isToday).toBe(false);
  });

  it("missed days are inferred from absence, not stored", () => {
    const tl = buildSprintTimeline(spr("2026-09-01"), [], "2026-09-05");
    expect(tl.missedCount).toBe(4); // days 1-4
    expect(tl.days[0].status).toBe("missed");
    expect(tl.days[4].status).toBe("due");
    expect(tl.days[6].status).toBe("future");
  });

  it("day number derives from start_date regardless of gaps in logging", () => {
    // Log only day 1 and day 6 — day 5 is still "5", never "today".
    const logs: { date: string; status: "completed" | "skipped" }[] = [
      { date: "2026-09-01", status: "completed" },
      { date: "2026-09-06", status: "completed" },
    ];
    const tl = buildSprintTimeline(spr("2026-09-01"), logs, "2026-09-06");
    expect(tl.currentDay).toBe(6);
    expect(tl.days[5].status).toBe("completed");
    expect(tl.days[4].status).toBe("missed"); // day 5 unlogged
  });

  it("reviewable once today is past the 21st day, currentDay clamps to 21", () => {
    const tl = buildSprintTimeline(spr("2026-08-01"), [], "2026-08-23");
    expect(tl.phase).toBe("reviewable");
    expect(tl.currentDay).toBe(21);
    expect(tl.endDate).toBe("2026-08-21");
    expect(tl.days.every((d) => d.status === "missed")).toBe(true);
  });

  it("scheduled when today precedes start_date", () => {
    const tl = buildSprintTimeline(spr("2026-09-10"), [], "2026-09-01");
    expect(tl.phase).toBe("scheduled");
    expect(tl.currentDay).toBeNull();
  });

  it("paused freezes today instead of marking it due", () => {
    const tl = buildSprintTimeline(spr("2026-09-01", { status: "paused" }), [], "2026-09-05");
    expect(tl.phase).toBe("paused");
    expect(tl.days[4].status).toBe("future"); // not "due"
    expect(tl.days[3].status).toBe("missed");
  });

  it("completed + archived are terminal phases", () => {
    expect(buildSprintTimeline(spr("2026-08-01", { status: "completed" }), [], "2026-08-30").phase).toBe("completed");
    expect(buildSprintTimeline(spr("2026-08-01", { status: "archived" }), [], "2026-08-30").phase).toBe("archived");
  });

  it("the 21st day itself is still 'active' with day 21 due", () => {
    const tl = buildSprintTimeline(spr("2026-09-01"), [], "2026-09-21");
    expect(tl.phase).toBe("active");
    expect(tl.currentDay).toBe(21);
    expect(tl.days[20].status).toBe("due");
    // review becomes available the day after the window
    expect(buildSprintTimeline(spr("2026-09-01"), [], "2026-09-22").phase).toBe("reviewable");
  });

  it("a completed sprint keeps full tallies even when viewed far past its end", () => {
    // Reading-style history: 18 done + 2 skipped across the window, viewed 8 days after.
    const days = dateRange("2026-08-06", 21);
    const skipIdx = new Set([9, 19]); // day 10 and day 20 (0-based)
    const logs = days
      .map((date, i) => ({ date, status: (skipIdx.has(i) ? "skipped" : "completed") as "completed" | "skipped" }));
    const tl = buildSprintTimeline(spr("2026-08-06", { status: "completed" }), logs, "2026-09-03");
    expect(tl.phase).toBe("completed");
    expect(tl.completedCount).toBe(19); // 21 - 2 skipped
    expect(tl.skippedCount).toBe(2);
    expect(tl.missedCount).toBe(0);
    expect(tl.longestStreak).toBe(9); // segments 9 / 9 / 1
    expect(tl.currentDay).toBe(21);
  });

  it("points milestones ladder: exactly 3 → +10, exactly 7 → +40, 19 → +40", () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ date: addDays("2026-09-01", i), status: "completed" as const }));
    expect(computePoints(mk(2), false).streakBonus).toBe(0);
    expect(computePoints(mk(3), false).streakBonus).toBe(10);
    expect(computePoints(mk(7), false).streakBonus).toBe(40);
    expect(computePoints(mk(19), false).streakBonus).toBe(40);
  });
});

describe("computePoints", () => {
  const L = (date: string, status: "completed" | "skipped" = "completed") => ({ date, status });

  it("10 per completed day, nothing for skips", () => {
    const p = computePoints([L("2026-09-01"), L("2026-09-02"), L("2026-09-03", "skipped")], false);
    expect(p.completionPoints).toBe(20);
    expect(p.total).toBe(20);
  });

  it("3-in-a-row nets the +10 milestone bonus", () => {
    const p = computePoints([L("2026-09-01"), L("2026-09-02"), L("2026-09-03")], false);
    expect(p.streakBonus).toBe(10);
    expect(p.total).toBe(40);
  });

  it("7-in-a-row accumulates +10 then +30 (40 bonus)", () => {
    const dates = Array.from({ length: 7 }, (_, i) => L(addDays("2026-09-01", i)));
    const p = computePoints(dates, false);
    expect(p.streakBonus).toBe(40);
    expect(p.total).toBe(110);
  });

  it("a broken streak keeps the highest bonus earned so far", () => {
    // Run of 3 earned, then a miss, then single completes.
    const logs = [
      L("2026-09-01"), L("2026-09-02"), L("2026-09-03"),
      L("2026-09-05"), L("2026-09-06"),
    ];
    const p = computePoints(logs, false);
    expect(p.streakBonus).toBe(10); // longest run 3 is retained
    expect(p.completionPoints).toBe(50);
  });

  it("+100 only when the sprint is finalized", () => {
    const base = [L("2026-09-01"), L("2026-09-02")];
    expect(computePoints(base, false).completionBonus).toBe(0);
    expect(computePoints(base, true).completionBonus).toBe(100);
  });
});

describe("completionRatePercent", () => {
  it("returns 0-100 and clamps at 100", () => {
    expect(completionRatePercent(0, 21)).toBe(0);
    expect(completionRatePercent(21, 21)).toBe(100);
    expect(completionRatePercent(25, 21)).toBe(100);
    expect(completionRatePercent(1, 3)).toBe(33);
  });
});

describe("buildCueSentence", () => {
  it("combines trigger and minimum action with natural Chinese", () => {
    expect(buildCueSentence({ trigger: "喝完晨间咖啡", minimumAction: "打开书读一页" }))
      .toBe("每当我喝完晨间咖啡后，我会打开书读一页。");
  });
  it("adds location when present", () => {
    expect(buildCueSentence({ trigger: "走进书房", location: "书房", minimumAction: "打开书读一页" }))
      .toBe("每当我走进书房时（在书房），我会打开书读一页。");
  });
  it("falls back to the plain daily statement", () => {
    expect(buildCueSentence({ minimumAction: "做 20 个俯卧撑" })).toBe("每天做 20 个俯卧撑。");
  });
  it("strips trailing punctuation from user input", () => {
    expect(buildCueSentence({ trigger: "吃完晚饭。", minimumAction: "散步 10 分钟！" }))
      .toBe("每当我吃完晚饭后，我会散步 10 分钟。");
  });
  it("never doubles a temporal particle a user already typed", () => {
    expect(buildCueSentence({ trigger: "吃完晚饭后", minimumAction: "做 5 分钟拉伸" }))
      .toBe("每当我吃完晚饭后，我会做 5 分钟拉伸。");
    expect(buildCueSentence({ trigger: "吃完饭之后", minimumAction: "做 5 分钟拉伸" }))
      .toBe("每当我吃完饭后，我会做 5 分钟拉伸。");
    expect(buildCueSentence({ trigger: "下班回家以后", minimumAction: "做 5 分钟拉伸" }))
      .toBe("每当我下班回家后，我会做 5 分钟拉伸。");
  });
  it("strips a trailing 时 when a location will carry the 时", () => {
    expect(buildCueSentence({ trigger: "走进书房时", location: "书房", minimumAction: "打开书读一页" }))
      .toBe("每当我走进书房时（在书房），我会打开书读一页。");
  });
  it("returns empty when no minimum action", () => {
    expect(buildCueSentence({ minimumAction: "" })).toBe("");
  });
});
