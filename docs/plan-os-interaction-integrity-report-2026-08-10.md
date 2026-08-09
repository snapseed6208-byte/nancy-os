# Plan OS Interaction Integrity Report

**Date:** 2026-08-10
**Scope:** Click feedback latency, duplicate prevention, progress cap, undo, corrupted data recovery
**Status:** IMPLEMENTED, CLEANED, DEPLOYED
**Commit:** `0987d6b` (pushed to master, Cloudflare Pages auto-deploying)

---

## 1. Problem Summary

Users reported 4 symptoms after rapid-clicking recurring tasks:

| Symptom | Root Cause |
|---|---|
| No immediate UI feedback on click | `onMutate` only patched `["tasks"]` cache, but UI reads from `["task-completion-records"]` Map via `getTaskPeriodState()` |
| 30/3, 14/3, 7/3 illegal progress | No INSERT guard in `mutationFn` — clicks above target still created records |
| Top summary showed "已完成 0" | Summary query used `doneToday` based on `tasks.status` cache, not period records |
| Multiple records per click | UNIQUE constraint on `task_completion_records(task_id, completion_date)` never applied (migration 057 used `CREATE TABLE IF NOT EXISTS` on existing table) |

## 2. Fixes Applied

### 2.1 Optimistic Update (onMutate)

`src/lib/hooks/usePlan.ts` — `onMutate` now patches **both** caches:

- `["tasks"]` — task list cache (was already patched, now includes `Math.min` clamp)
- `["task-completion-records"]` — period records Map (NEW): inserts optimistic record on complete, removes on undo

This gives immediate UI feedback because `getTaskPeriodState()` reads from the records Map.

### 2.2 INSERT Guard (mutationFn)

Hard guard BEFORE any INSERT:

```typescript
const { count: preCount } = await supabase
  .from("task_completion_records")
  .select("id", { count: "exact", head: true })
  .eq("task_id", id)
  .gte("completion_date", periodStart)
  .lt("completion_date", periodEnd);

if (!todayRecord && preCount >= targetCount) {
  return { blocked: true }; // Reject new INSERT
}
```

- UNDO (delete today's record) is always allowed, regardless of count
- INSERT is blocked when count >= target

### 2.3 Button Disabled During Mutation

| Component | Change |
|---|---|
| `TaskSection` (TodayPlan) | `disabled={isToggling}` + `opacity-50 cursor-not-allowed` |
| `TaskList` (Plan Tasks tab) | `disabled={isToggling}` + `opacity-50 cursor-not-allowed` |
| `TodaySchedule` (Home) | Already had `disabled={isToggling}` |

### 2.4 Display Clamping

All views now clamp with `Math.min(completedCount, targetCount)`:

| Component | Display |
|---|---|
| `TaskSection` (Plan.tsx) | `{Math.min(completedCount, targetCount)}/{targetCount}` |
| `TaskList` (Plan.tsx) | `{Math.min(completedCount, targetCount)}/{targetCount}` |
| `TodaySchedule` (TodaySchedule.tsx) | `const compCount = Math.min(rawCount, tgtCount)` |

`getTaskPeriodState()` returns raw `completedCount` for audit transparency. Clamping is at the display layer.

### 2.5 Summary Counter Fix

`Plan.tsx` — `TodayPlan` summary now uses `getTaskPeriodState()`:

```typescript
const summary = useMemo(() => {
  let pending = 0, completed = 0;
  for (const t of taskList) {
    if (t.task_type === "recurring") {
      const records = periodRecordsMap?.get(t.id) || [];
      const ps = getTaskPeriodState(t, records);
      if (ps.isPeriodCompleted) completed++; else pending++;
    } else {
      if (t.status === "done") completed++; else pending++;
    }
  }
  return { pending, completed, total: pending + completed };
}, [taskList, periodRecordsMap]);
```

No longer uses `doneToday` DB query for recurring tasks.

### 2.6 UNIQUE Constraint (Migration 088)

New migration `088_task_completion_unique.sql`:

```sql
-- Deduplicate before adding constraint
DELETE FROM task_completion_records WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY task_id, completion_date ORDER BY completed_at ASC
    ) AS rn FROM task_completion_records
  ) sub WHERE sub.rn > 1
);

-- Idempotent UNIQUE constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_completion_records_task_id_completion_date_key'
  ) THEN
    ALTER TABLE task_completion_records
      ADD CONSTRAINT task_completion_records_task_id_completion_date_key
      UNIQUE (task_id, completion_date);
  END IF;
END $$;
```

## 3. Production Data Audit

### Before Cleanup

| Task | Freq | Cached Count | Actual Records | Unique Dates | Max Dupes/Day |
|---|---|---|---|---|---|
| 每周3次驾校练车 | weekly 3 | 30 | 34 | 3 | **30** (2026-08-10) |
| 每周3次有氧运动 | weekly 3 | 7 | 11 | 2 | 7 (2026-08-10) |
| 每周3次口语对话 | weekly 3 | 14 | 18 | 4 | 14 (2026-08-10) |
| 每日英语口语15分钟 | daily 1 | 4 | 11 | 5 | 4 (2026-08-10) |

### After Cleanup

- **62 duplicate records deleted** (kept 1 per task per date)
- **4 corrupted `completed_count` caches synced** to actual period counts
- **0 corrupted tasks remaining**
- Total records: 78 → 16 unique

## 4. Test Coverage

**45 tests total** (25 Phase 2 + 20 Phase 3):

### Phase 2 (existing, now mocked)
- Daily: 0/1, 1/1, yesterday excluded, period boundaries
- Weekly: 0/3, 1/3 (in_progress), 2/3, 3/3, 4/3, previous week excluded
- One-time: pending, in_progress, done, ignores records
- Weekly target=2: 1/2, 2/2
- Remaining count: daily, weekly 2/3, weekly 4/3 (clamped)
- Edge cases: empty records, missing frequency_type, target_count=0
- Monthly: 0/1, 1/1, previous month excluded

### Phase 3 (new)
- Progress cap: 4/3 raw, 30/3 corrupted scenario
- Icon rules: 0/N, 1/N, (N-1)/N, N/N, exceeds N
- Daily undo: 1/1→period_completed, 0/1→pending, multiple records
- Weekly undo: 3/3→undo→2/3→in_progress, undo to 0/3→pending
- Summary consistency: mixed task list, period completion
- Period boundaries: at start/end, exact edges
- Corrupted resilience: count > target, count=0 with records

## 5. Architecture: The Rule

```
TASK DEFINITION → CURRENT PERIOD RECORDS → displayStatus + progress
```

That's it. No status columnt dependence, no cron jobs, no background resets. The period acts as a window that slides forward naturally — yesterday's records fall out, today's count in.

## 6. Files Changed

| File | Lines | Summary |
|---|---|---|
| `src/lib/hooks/usePlan.ts` | +73 | INSERT guard, optimistic records patch, onError rollback |
| `src/pages/Plan.tsx` | +68/-? | TaskList button disabled, clamping, summary memo |
| `src/components/home/TodaySchedule.tsx` | +3/-1 | Clamp display count |
| `src/__tests__/RecurringTaskLifecycle.test.ts` | +284/-? | Mocked date module, 20 new Phase 3 tests |
| `supabase/migrations/088_task_completion_unique.sql` | +34 (new) | UNIQUE constraint + dedup |

## 7. Pending Manual Step

**Migration 088 must be applied manually** via Supabase Dashboard SQL Editor:

1. Go to https://supabase.com/dashboard/project/raiyrrehejwxfyzsjvxj
2. Open SQL Editor
3. Run the contents of `supabase/migrations/088_task_completion_unique.sql`

The `supabase db push` command failed because no `supabase_migrations` history table exists (this project predates that feature).

## 8. Known Limitations (unchanged from Phase 2)

1. `tasks.completed_count` may show stale values until next toggle (UI corrects via `getTaskPeriodState()`)
2. Rapid double-click may trigger error toast (second INSERT fails UNIQUE constraint — once migration 088 applied)
3. Weekly undo only toggles today's record, not historical records
4. TodaySchedule still reads from `task.completed_count` (functionally correct after first toggle)

## 9. Verification Checklist

- [x] TypeScript compilation: clean
- [x] 126 tests passing (81 EnglishReview + 45 RecurringTaskLifecycle)
- [x] Production data: 0 corrupted tasks
- [x] Production records: 16 unique (62 duplicates removed)
- [x] Code pushed to GitHub + auto-deploying
- [ ] Browser E2E on production (requires Chrome extension)
- [ ] Migration 088 applied (requires Supabase Dashboard)
