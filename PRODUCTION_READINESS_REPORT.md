# Nancy OS Production Readiness Report

**Date:** 2026-08-09
**Phase:** 3.5 Final Closure
**Status:** Trial-ready with known issues

---

## System Capability Map

| Module | Agent(s) | Status | Key Gap |
|--------|----------|--------|---------|
| 中文表达训练 | chinese-expression-agent | Production-ready | None |
| 英语学习 | english-coach | Production-ready | No conversation persistence |
| 周反思 | reflection-agent | Production-ready | Token risk on heavy weeks |
| 任务规划 | task-breakdown-agent | Production-ready | Duplicated memory builder |
| 健康管理 | health-coach, diet-analyst, health-checklist, habit-analyst | Production | Orphan tables |
| 日常简报 | daily-brief-agent | Production-ready | None |
| 日志反思 | daily-reflection-agent | **BROKEN** | ai_memories schema mismatch |
| 知识导入 | content-parser, resource-extract, resource-analyze, bilibili-* | Overlapping | 3 competing implementations |
| 资产管理 | asset-mining-agent (Phase 3.5) | New | Migration applied |
| 意图路由 | detectUserIntent() (Phase 3.5) | New | Client integration pending |
| 反馈系统 | ai_feedback table (Phase 3.5) | New | Migration applied |

---

## Data Flow Diagram (Post Phase 3.5)

```
User Content → detectUserIntent() → Route to Agent → AI Analysis
                         │                              │
                         ▼                              ▼
                  asset-mining-agent          ai_feedback (user rates)
                         │
                         ▼
                  expression_asset_candidates
                         │
                    (user confirms)
                         │
                         ▼
                  expression_assets ← nancy-context.ts
                         │              (unified context layer)
                         ▼
                  getNancyPersonalProfileWithGrowth()
                         │
                         ▼
                  All 3 primary agents receive personalized context
```

---

## Critical Issues (Must Fix Before Trial)

### 1. ai_memories Schema Mismatch (BLOCKER)
- **File:** `supabase/functions/daily-reflection-agent/index.ts:165-174`
- **Problem:** Inserts `title`, `category`, `importance`, `source_date` columns that do NOT exist in the migration schema (which uses `memory_type`, `confidence`, `evidence`)
- **Impact:** daily-reflection-agent throws 500 on every invocation
- **Fix:** Align the insert with migration 003/006 schema OR add missing columns via migration

### 2. Missing user_id Indexes (Performance)
Tables without user_id indexes: `speaking_attempts`, `expression_reviews`, `weekly_themes`, `jobs`, `interviews`, `workout_records`
- **Impact:** Sequential scans on every user query — degrades as data grows
- **Fix:** Add `CREATE INDEX ON <table>(user_id)` in migration

### 3. Frontend Bug: useDashboard Habits Query (User-Visible)
- **File:** `src/lib/hooks/useDashboard.ts:229`
- **Problem:** `supabase.from("habits").select("id,name,icon")` — `name` column doesn't exist (should be `title`)
- **Impact:** Dashboard shows placeholder habit names on every load

---

## High Priority (Should Fix Before Trial)

### 4. Shared Module Migration Incomplete
- 16 of 23 Edge Functions still create their own Supabase client + manual auth
- 18 duplicate CORS/auth blocks (nancy-context.ts was built to eliminate these)
- `task-breakdown-agent` has a private `buildUserProfile()` that re-implements `buildMemoryProfile`
- `english-coach` has a duplicate `buildLearningContext`

### 5. Token Risk: reflection-agent
- No `.limit()` on 7-day queries (journal_entries, mood_records, ideas, events, tasks, habit_records)
- All data serialized into userData string with maxTokens: 4096
- Heavy week with many entries could overflow token budget

### 6. Missing Timeouts on Aliyun Calls
- `speech-to-text` and `aliyun-token` have no AbortController timeout
- Risk of hanging requests

### 7. English Instruction Prompts (Language Consistency)
- 5 agents use English system prompts but output Chinese: habit-analyst, diet-analyst, expression-import, expression-categorizer, question-import
- Risk: DeepSeek may drift to English prose for user-facing output

### 8. Wildcard CORS on bilibili-*
- `bilibili-thumbnail` and `bilibili-resolve` use `Access-Control-Allow-Origin: *`
- All other agents scope to specific allowed origins

---

## Medium Priority (Fix Iteratively)

### 9. Inconsistent Soft-Delete
- `deleted_at` (speaking_attempts, expressions) vs `is_archived` (resources) vs `archived` (expressions) vs status enum (expression_assets)
- No uniform purge policy possible

### 10. Orphan Tables (10 tables)
- `monthly_plans`, `learning_resources`, `workout_plans`, `news_digests`, `goal_milestones`, `module_stats`, `information_feed`, `skills`, `decisions`, `recurring_task_templates`
- Only referenced in dead Drizzle schema.ts (never imported)

### 11. Frontend Console Logging in Production
- `EnglishSpeaking.tsx`: ~80 debug statements including audio/blob URLs
- `Plan.tsx`: Dumps full task list on every render
- `useDashboard.ts`: Error fires on every load (habit bug)
- `Resources.tsx`, `useResources.ts`, `usePlan.ts`, `Ideas.tsx`

### 12. Icon-Only Buttons Missing aria-labels
- Project-wide pattern — back arrows, delete buttons, pagination chevrons
- Screen readers announce "button" with no context

### 13. Overlapping Edge Functions
- `bilibili-thumbnail` / `bilibili-resolve` overlap with `source-extractor-agent`
- `expression-categorizer` appears to be a one-off maintenance utility
- `resource-extract` / `resource-analyze` vs `content-parser-agent` competing implementations

---

## Low Priority

### 14. Missing error states
- Settings.tsx: no error state for profile query
- English.tsx: no error state for stats query

### 15. Dead code
- `Review.tsx` line 86: unreachable `tab === "weekly"` branch
- `src/features/` and `src/hooks/` are empty dead scaffolding
- `ChineseMaterialNew.tsx` uses `(window as any)._materialResourceId` (fragile)

---

## Security Assessment

| Area | Status | Notes |
|------|--------|-------|
| RLS enabled | 99% | `exercise_library` is the only table without RLS (global reference) |
| user_id filtering | All queries filter by user_id | Verified across all Edge Functions |
| CORS scoping | 91% | 2 bilibili functions use wildcard |
| Auth enforcement | All user-data endpoints require JWT | Verified |
| Service-role key exposure | Contained | Only in Edge Function secrets |
| SQL injection | Safe | All queries use parameterized Supabase SDK |

---

## Features NOT Recommended for Further Development

1. **Drizzle ORM integration** — `src/lib/db/schema.ts` references 10 orphan tables and is never imported. Remove entirely.
2. **bilibili-thumbnail** — superseded by `bilibili-resolve`; consolidate or remove.
3. **expression-categorizer** — one-off maintenance utility; remove from deployed functions or document as admin-only.

---

## Formal Trial Recommendations

1. **Fix the 3 critical issues** before the first trial session (ai_memories schema, user_id indexes, habit query bug)
2. **Deploy with monitoring** — watch agent_logs for error rates, token overflow, and timeout patterns
3. **Start with Chinese Expression Training** — it's the most complete and well-tested module (V4 agent, skills.ts, asset mining, personalization, growth tracking)
4. **Phase in other modules** — English coach, Reflection, Planning in subsequent trial weeks
5. **Collect ai_feedback** from day 1 — the feedback table is in place; use it to guide improvements

---

## Phase 3.5 Deliverables Checklist

| Stage | Deliverable | Status |
|-------|-------------|--------|
| Stage 0 | Data flow audit | Done |
| Stage 1 | Asset Auto Mining (mineAssetCandidates + asset-mining-agent) | Done |
| Stage 2 | Intent Router (detectUserIntent) | Done |
| Stage 3 | AI Feedback Loop (ai_feedback table + recordFeedback) | Done |
| Stage 4 | Production Readiness Audit (this report) | Done |
| Final | Nancy OS Production Readiness Report | Done |

**New migration files:** 083 (asset source tracking), 084 (ai_feedback)
**New Edge Functions:** asset-mining-agent
**New shared functions:** mineAssetCandidates(), detectUserIntent(), recordFeedback(), getFeedbackStats()
**New tests:** 66 tests (36 mining + 30 intent router)
**Total regression:** 173 tests passing
