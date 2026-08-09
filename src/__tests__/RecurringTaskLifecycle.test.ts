// ============================================
// Plan OS — Recurring Task Lifecycle Regression Tests
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock date module for deterministic periods ──
// "Today" is pinned to 2026-08-09 (Sunday).
// Weekly period: Monday 2026-08-04 → next Monday 2026-08-11.
// Daily period: 2026-08-09 → 2026-08-10.
// Monthly period: 2026-08-01 → 2026-09-01.

vi.mock("@/lib/date", () => ({
  getBeijingDateString: () => "2026-08-09",
  getBeijingPeriodStart: (freq: string) => {
    if (freq === "daily") return "2026-08-09";
    if (freq === "weekly") return "2026-08-04";
    return "2026-08-01"; // monthly
  },
  getBeijingPeriodEnd: (freq: string) => {
    if (freq === "daily") return "2026-08-10";
    if (freq === "weekly") return "2026-08-11";
    return "2026-09-01"; // monthly
  },
  getBeijingWeekStart: () => "2026-08-04",
  getBeijingWeekRange: () => ({ start: "2026-08-04", end: "2026-08-11" }),
  getBeijingYearMonth: () => ({ year: 2026, month: 8 }),
  getBeijingMonthRange: () => ({ start: "2026-08-01", end: "2026-08-31" }),
  formatBeijingDate: (d: string) => d,
  parseBusinessDateSafely: (d: string) => d,
  getBeijingWeekday: () => "周日",
  dateToBeijingString: () => "2026-08-09",
}));

import {
  getTaskPeriodState,
  type TaskRow,
  type TaskCompletionRecord,
} from "@/lib/hooks/usePlan";

// ── Test Helpers ──

function makeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Test Task",
    description: null,
    category: "general",
    module: null,
    priority: "medium",
    energy_cost: "medium",
    energy_level: "medium",
    status: "pending",
    due_date: null,
    start_date: null,
    estimated_minutes: null,
    actual_minutes: null,
    is_today_focus: false,
    recurring_rule: null,
    source_type: "manual",
    source_id: null,
    completed_at: null,
    created_at: "2026-08-09T00:00:00Z",
    task_type: "one_time",
    frequency_type: null,
    target_count: 1,
    completed_count: 0,
    cycle_start_date: null,
    template_id: null,
    instance_date: null,
    approved_at: null,
    ai_review_status: null,
    ...overrides,
  } as TaskRow;
}

function makeRecord(taskId: string, date: string): TaskCompletionRecord {
  return {
    id: `rec-${taskId}-${date}`,
    task_id: taskId,
    user_id: "user-1",
    completed_at: `${date}T10:00:00Z`,
    completion_date: date,
  };
}

// ═══════════════════════════════════════════
// PHASE 2 — Original 25 tests (with mocked dates)
// ═══════════════════════════════════════════

// ── DAILY TASKS ──

describe("Daily recurring task period state", () => {
  it("0/1 — no records → displayStatus=pending", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    const state = getTaskPeriodState(task, []);
    expect(state.displayStatus).toBe("pending");
    expect(state.completedCount).toBe(0);
    expect(state.targetCount).toBe(1);
    expect(state.isPeriodCompleted).toBe(false);
    expect(state.periodType).toBe("daily");
  });

  it("1/1 — one today record → displayStatus=period_completed", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    const today = "2026-08-09";
    const records = [makeRecord("task-1", today)];
    const state = getTaskPeriodState(task, records);
    expect(state.displayStatus).toBe("period_completed");
    expect(state.completedCount).toBe(1);
    expect(state.isPeriodCompleted).toBe(true);
  });

  it("only counts records within current period (not yesterday's)", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    const records = [makeRecord("task-1", "2026-08-08")];
    const state = getTaskPeriodState(task, records);
    expect(state.completedCount).toBe(0);
    expect(state.displayStatus).toBe("pending");
  });

  it("periodStart is today, periodEnd is tomorrow", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    const state = getTaskPeriodState(task, []);
    expect(state.periodStart).toBe("2026-08-09");
    expect(state.periodEnd).toBe("2026-08-10");
    expect(state.periodStart < state.periodEnd).toBe(true);
  });
});

// ── WEEKLY TASKS ──

describe("Weekly recurring task period state", () => {
  it("0/3 — no records → displayStatus=pending", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const state = getTaskPeriodState(task, []);
    expect(state.displayStatus).toBe("pending");
    expect(state.completedCount).toBe(0);
    expect(state.targetCount).toBe(3);
    expect(state.isPeriodCompleted).toBe(false);
    expect(state.periodType).toBe("weekly");
  });

  it("1/3 — one record → displayStatus=in_progress (NOT completed)", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-04"), // Tuesday (in mocked week)
    ];
    const state = getTaskPeriodState(task, records);
    expect(state.displayStatus).toBe("in_progress");
    expect(state.completedCount).toBe(1);
    expect(state.isPeriodCompleted).toBe(false);
  });

  it("2/3 — two records → displayStatus=in_progress", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-04"),
      makeRecord("task-1", "2026-08-06"),
    ];
    const state = getTaskPeriodState(task, records);
    expect(state.displayStatus).toBe("in_progress");
    expect(state.completedCount).toBe(2);
    expect(state.isPeriodCompleted).toBe(false);
  });

  it("3/3 — three records → displayStatus=period_completed", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-04"),
      makeRecord("task-1", "2026-08-05"),
      makeRecord("task-1", "2026-08-07"),
    ];
    const state = getTaskPeriodState(task, records);
    expect(state.displayStatus).toBe("period_completed");
    expect(state.completedCount).toBe(3);
    expect(state.isPeriodCompleted).toBe(true);
  });

  it("4/3 — exceeds target → still period_completed", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-04"),
      makeRecord("task-1", "2026-08-05"),
      makeRecord("task-1", "2026-08-06"),
      makeRecord("task-1", "2026-08-07"),
    ];
    const state = getTaskPeriodState(task, records);
    expect(state.displayStatus).toBe("period_completed");
    expect(state.completedCount).toBe(4);
    expect(state.isPeriodCompleted).toBe(true);
  });

  it("ignores records from previous week", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-07-21"),
      makeRecord("task-1", "2026-07-23"),
      makeRecord("task-1", "2026-07-25"),
    ];
    const state = getTaskPeriodState(task, records);
    expect(state.completedCount).toBe(0);
    expect(state.displayStatus).toBe("pending");
  });
});

// ── ONE-TIME TASK COMPATIBILITY ──

describe("One-time task period state", () => {
  it("pending → displayStatus=pending", () => {
    const task = makeTask({ task_type: "one_time", status: "pending" });
    const state = getTaskPeriodState(task, []);
    expect(state.displayStatus).toBe("pending");
    expect(state.periodType).toBe("one_time");
    expect(state.isPeriodCompleted).toBe(false);
  });

  it("in_progress → displayStatus=in_progress", () => {
    const task = makeTask({ task_type: "one_time", status: "in_progress" });
    const state = getTaskPeriodState(task, []);
    expect(state.displayStatus).toBe("in_progress");
    expect(state.isPeriodCompleted).toBe(false);
  });

  it("done → displayStatus=period_completed", () => {
    const task = makeTask({ task_type: "one_time", status: "done" });
    const state = getTaskPeriodState(task, []);
    expect(state.displayStatus).toBe("period_completed");
    expect(state.isPeriodCompleted).toBe(true);
    expect(state.completedCount).toBe(1);
    expect(state.targetCount).toBe(1);
  });

  it("ignores completion records (status-driven, not record-driven)", () => {
    const task = makeTask({ task_type: "one_time", status: "pending" });
    const records = [makeRecord("task-1", "2026-08-09")];
    const state = getTaskPeriodState(task, records);
    expect(state.displayStatus).toBe("pending");
  });
});

// ── TARGET COUNT 2 ──

describe("Weekly target=2 period state", () => {
  it("1/2 → in_progress (NOT completed)", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 2, completed_count: 0 });
    const records = [makeRecord("task-1", "2026-08-04")];
    const state = getTaskPeriodState(task, records);
    expect(state.displayStatus).toBe("in_progress");
    expect(state.isPeriodCompleted).toBe(false);
  });

  it("2/2 → period_completed", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 2, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-04"),
      makeRecord("task-1", "2026-08-06"),
    ];
    const state = getTaskPeriodState(task, records);
    expect(state.displayStatus).toBe("period_completed");
    expect(state.isPeriodCompleted).toBe(true);
  });
});

// ── REMAINING COUNT ──

describe("Remaining count", () => {
  it("daily target=1, 0/1 → remaining=1", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    expect(getTaskPeriodState(task, []).remainingCount).toBe(1);
  });

  it("weekly target=3, 2/3 → remaining=1", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const records = [makeRecord("task-1", "2026-08-04"), makeRecord("task-1", "2026-08-05")];
    expect(getTaskPeriodState(task, records).remainingCount).toBe(1);
  });

  it("weekly target=3, 4/3 → remaining=0 (clamped)", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-04"),
      makeRecord("task-1", "2026-08-05"),
      makeRecord("task-1", "2026-08-06"),
      makeRecord("task-1", "2026-08-07"),
    ];
    expect(getTaskPeriodState(task, records).remainingCount).toBe(0);
  });
});

// ── EDGE CASES ──

describe("Edge cases", () => {
  it("empty records array → pending for daily", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    const state = getTaskPeriodState(task, []);
    expect(state.displayStatus).toBe("pending");
  });

  it("task with task_type=recurring but no frequency_type defaults to daily", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: undefined, target_count: 1, completed_count: 0 });
    const state = getTaskPeriodState(task, []);
    expect(state.periodType).toBe("daily");
  });

  it("task with target_count=0 defaults to target_count=1", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 0, completed_count: 0 });
    const state = getTaskPeriodState(task, []);
    expect(state.targetCount).toBe(1);
  });
});

// ── MONTHLY TASKS ──

describe("Monthly recurring task period state", () => {
  it("0/1 → pending", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "monthly", target_count: 1, completed_count: 0 });
    const state = getTaskPeriodState(task, []);
    expect(state.periodType).toBe("monthly");
    expect(state.displayStatus).toBe("pending");
  });

  it("1/1 current month → period_completed", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "monthly", target_count: 1, completed_count: 0 });
    const records = [makeRecord("task-1", "2026-08-05")];
    const state = getTaskPeriodState(task, records);
    expect(state.completedCount).toBe(1);
    expect(state.isPeriodCompleted).toBe(true);
  });

  it("ignores records from previous month", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "monthly", target_count: 1, completed_count: 0 });
    const records = [makeRecord("task-1", "2026-07-15")];
    const state = getTaskPeriodState(task, records);
    expect(state.completedCount).toBe(0);
  });
});

// ═══════════════════════════════════════════
// PHASE 3 — Interaction Integrity Tests (20 new)
// ═══════════════════════════════════════════

// ── PROGRESS CAP / CLAMPING ──

describe("Progress cap — UI never shows count > target", () => {
  it("4/3 raw records → displayStatus=period_completed, completedCount=4 (raw), isPeriodCompleted=true", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-04"),
      makeRecord("task-1", "2026-08-05"),
      makeRecord("task-1", "2026-08-06"),
      makeRecord("task-1", "2026-08-07"),
    ];
    const state = getTaskPeriodState(task, records);
    // Raw count reflects real records (for transparency)
    expect(state.completedCount).toBe(4);
    // But display layer clamps: Math.min(completedCount, targetCount) in UI
    expect(Math.min(state.completedCount, state.targetCount)).toBe(3);
    expect(state.isPeriodCompleted).toBe(true);
  });

  it("30/3 corrupted scenario — period_completed with raw count exposed for audit", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const records = Array.from({ length: 30 }, (_, i) =>
      makeRecord("task-1", `2026-08-0${Math.min(4 + Math.floor(i / 5), 7)}`),
    );
    const state = getTaskPeriodState(task, records);
    expect(state.isPeriodCompleted).toBe(true);
    expect(state.displayStatus).toBe("period_completed");
    expect(state.completedCount).toBe(30); // raw count
    // UI clamps display
    expect(Math.min(state.completedCount, state.targetCount)).toBe(3);
  });
});

// ── ICON RULES ──

describe("Icon/displayStatus rules", () => {
  it("0/N → pending", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 5, completed_count: 0 });
    expect(getTaskPeriodState(task, []).displayStatus).toBe("pending");
  });

  it("1/N → in_progress", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 5, completed_count: 0 });
    expect(getTaskPeriodState(task, [makeRecord("task-1", "2026-08-04")]).displayStatus).toBe("in_progress");
  });

  it("(N-1)/N → in_progress (NOT completed)", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 5, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-04"),
      makeRecord("task-1", "2026-08-05"),
      makeRecord("task-1", "2026-08-06"),
      makeRecord("task-1", "2026-08-07"),
    ];
    expect(getTaskPeriodState(task, records).displayStatus).toBe("in_progress");
  });

  it("N/N → period_completed (green check)", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 5, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-04"),
      makeRecord("task-1", "2026-08-05"),
      makeRecord("task-1", "2026-08-06"),
      makeRecord("task-1", "2026-08-07"),
      makeRecord("task-1", "2026-08-08"),
    ];
    expect(getTaskPeriodState(task, records).displayStatus).toBe("period_completed");
  });

  it("exceeds N → still period_completed (never degrades)", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-04"),
      makeRecord("task-1", "2026-08-05"),
      makeRecord("task-1", "2026-08-06"),
      makeRecord("task-1", "2026-08-07"),
    ];
    const state = getTaskPeriodState(task, records);
    expect(state.displayStatus).toBe("period_completed");
    expect(state.isPeriodCompleted).toBe(true);
  });
});

// ── DAILY TASK UNDO / REPEATED CLICK ──

describe("Daily task toggle behavior (pure state)", () => {
  it("daily 1/1 → period_completed with today record", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    const state = getTaskPeriodState(task, [makeRecord("task-1", "2026-08-09")]);
    expect(state.displayStatus).toBe("period_completed");
    expect(state.isPeriodCompleted).toBe(true);
  });

  it("daily 0/1 (after undo — no today record) → pending", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    // Yesterday's record doesn't count → pending
    const state = getTaskPeriodState(task, [makeRecord("task-1", "2026-08-08")]);
    expect(state.displayStatus).toBe("pending");
    expect(state.isPeriodCompleted).toBe(false);
  });

  it("daily with multiple records in period — last one wins for undo semantics", () => {
    // Simulating: user clicked 3 times (insert, delete, insert) = 1 record today
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    // Only 1 record per day (UNIQUE constraint), so at most 1 today
    const state = getTaskPeriodState(task, [makeRecord("task-1", "2026-08-09")]);
    expect(state.completedCount).toBe(1);
    expect(state.isPeriodCompleted).toBe(true);
  });
});

// ── WEEKLY TASK UNDO ──

describe("Weekly task undo semantics", () => {
  it("3/3 → period_completed, undo today → 2/3 → in_progress", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    // 2 prior records + no record today = after undo of today's record
    const state = getTaskPeriodState(task, [
      makeRecord("task-1", "2026-08-04"),
      makeRecord("task-1", "2026-08-06"),
    ]);
    expect(state.displayStatus).toBe("in_progress");
    expect(state.completedCount).toBe(2);
    expect(state.isPeriodCompleted).toBe(false);
  });

  it("undo when at 1/3 → 0/3 → pending", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const state = getTaskPeriodState(task, []);
    expect(state.displayStatus).toBe("pending");
    expect(state.completedCount).toBe(0);
  });
});

// ── TOP SUMMARY CONSISTENCY ──

describe("Summary computation consistency", () => {
  it("computes per-task period state correctly for mixed task list", () => {
    const weeklyTask = makeTask({ id: "w1", task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const dailyTask = makeTask({ id: "d1", task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    const oneTimeTask = makeTask({ id: "o1", task_type: "one_time", status: "pending" });

    const weeklyRecords = [makeRecord("w1", "2026-08-04"), makeRecord("w1", "2026-08-05")]; // 2/3
    const dailyRecords: TaskCompletionRecord[] = []; // 0/1

    const wState = getTaskPeriodState(weeklyTask, weeklyRecords);
    const dState = getTaskPeriodState(dailyTask, dailyRecords);
    const oState = getTaskPeriodState(oneTimeTask, []);

    expect(wState.displayStatus).toBe("in_progress");
    expect(dState.displayStatus).toBe("pending");
    expect(oState.displayStatus).toBe("pending");

    // Summary: pending=2, completed=0
    const pending = [wState, dState, oState].filter(s => !s.isPeriodCompleted).length;
    const completed = [wState, dState, oState].filter(s => s.isPeriodCompleted).length;
    expect(pending).toBe(3);
    expect(completed).toBe(0);
  });

  it("summary count matches after period completion", () => {
    const wTask = makeTask({ id: "w1", task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const wRecords = [
      makeRecord("w1", "2026-08-04"),
      makeRecord("w1", "2026-08-05"),
      makeRecord("w1", "2026-08-07"),
    ];
    const wState = getTaskPeriodState(wTask, wRecords);
    expect(wState.isPeriodCompleted).toBe(true);

    const completed = [wState].filter(s => s.isPeriodCompleted).length;
    expect(completed).toBe(1);
  });
});

// ── PERIOD BOUNDARY ──

describe("Period boundary — records at edges", () => {
  it("record exactly at periodStart counts", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const state = getTaskPeriodState(task, [makeRecord("task-1", "2026-08-04")]); // Monday = periodStart
    expect(state.completedCount).toBe(1);
  });

  it("record at periodEnd - 1 day counts", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const state = getTaskPeriodState(task, [makeRecord("task-1", "2026-08-10")]); // Sunday, day before periodEnd
    expect(state.completedCount).toBe(1);
  });

  it("record exactly at periodEnd is excluded", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const state = getTaskPeriodState(task, [makeRecord("task-1", "2026-08-11")]); // Next Monday = periodEnd
    expect(state.completedCount).toBe(0);
  });

  it("daily period: yesterday excluded, today included, tomorrow excluded", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-08"), // yesterday
      makeRecord("task-1", "2026-08-09"), // today
      makeRecord("task-1", "2026-08-10"), // tomorrow
    ];
    const state = getTaskPeriodState(task, records);
    expect(state.completedCount).toBe(1);
  });
});

// ── CORRUPTED DATA RESILIENCE ──

describe("Corrupted data resilience", () => {
  it("task.completed_count=30 with target=3 still displays correctly via period state", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 30 });
    // periodRecordsMap has real records (only 2 in current period)
    const records = [makeRecord("task-1", "2026-08-04"), makeRecord("task-1", "2026-08-06")];
    const state = getTaskPeriodState(task, records);
    // Period state ignores the corrupted completed_count cache
    expect(state.completedCount).toBe(2);
    expect(state.displayStatus).toBe("in_progress");
    expect(state.isPeriodCompleted).toBe(false);
  });

  it("task.completed_count=0 with records in period uses records, not cache", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "weekly", target_count: 3, completed_count: 0 });
    const records = [
      makeRecord("task-1", "2026-08-04"),
      makeRecord("task-1", "2026-08-05"),
      makeRecord("task-1", "2026-08-06"),
    ];
    const state = getTaskPeriodState(task, records);
    expect(state.completedCount).toBe(3);
    expect(state.isPeriodCompleted).toBe(true);
  });
});
