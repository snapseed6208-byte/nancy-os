// ============================================
// Plan OS — Recurring Task Lifecycle Regression Tests
// ============================================

import { describe, it, expect } from "vitest";
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
    // Record from yesterday — should NOT count toward today
    const records = [makeRecord("task-1", "2026-08-08")];
    const state = getTaskPeriodState(task, records);
    expect(state.completedCount).toBe(0);
    expect(state.displayStatus).toBe("pending");
  });

  it("periodStart is today, periodEnd is tomorrow", () => {
    const task = makeTask({ task_type: "recurring", frequency_type: "daily", target_count: 1, completed_count: 0 });
    const state = getTaskPeriodState(task, []);
    expect(state.periodStart).toBeTruthy();
    expect(state.periodEnd).toBeTruthy();
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
      makeRecord("task-1", "2026-08-04"), // Tuesday
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
    // Records from 2 weeks ago — should NOT count
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
    // Even with records present, one_time tasks use status
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
    // August 2026 records should count
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
