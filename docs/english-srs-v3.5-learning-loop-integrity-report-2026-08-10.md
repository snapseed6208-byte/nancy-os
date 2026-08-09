# English SRS V3.5 — Learning Loop Integrity Report

**Date:** 2026-08-10
**Scope:** Cloze Integrity, Daily Summary Integrity, Learning History
**Status:** IMPLEMENTED, TESTED, DEPLOYED
**Commit:** `6a35a2f` (pushed to master, Cloudflare Pages auto-deploying)

---

## 1. Problem Summary

Three data-integrity gaps identified in the English SRS V3 learning loop:

| Gap | Root Cause |
|---|---|
| Cloze answer leakage | `safeContext` had redundant `contextFromExample` fallback that showed the sentence-with-blank |
| Hub/Review progress inconsistency | Hub used `expression_reviews` table; Review used session items + practice logs — different data sources |
| AI summary shallow | Only asked for strongest/weakest — no per-mode activation state, error patterns, or category analysis |

---

## 2. Fixes Applied

### 2.1 Cloze Leakage (V3.5 — Stage 0-5)

**`src/lib/clozeUtils.ts`** — Removed redundant `contextFromExample` fallback:

```typescript
// BEFORE (leaked context):
safeContext: safeContext || contextFromExample,

// AFTER (V3.5):
safeContext, // context/situation only — never the sentence-with-blank
```

Key invariants verified:
- `sourceSentence` stored ONLY for post-submit reveal, never used in prompt
- `promptIntegrityCheck()` validates no answer leakage before render
- `isSafeContext()` guards against expression appearing in context

### 2.2 Hub Session Progress (Stage 6)

**`src/lib/hooks/useReviewSession.ts`** — New `useHubSessionProgress()` hook:
- Queries today's `review_sessions` + `session_items` + `practice_logs`
- Returns recall/cloze/sentence completion counts
- Same data source as Review page's `getDailyReviewProgress()`

**`src/pages/English.tsx`** — Replaced `stats.todayReviewed`/`todayGood` (expression_reviews table) with session-based progress:
- Three progress bars (recall/cloze/sentence) now share the same data source as the Review page
- SRS stat cards (total/due/mastered) retained from `useEnglishStats()` — complementary data

### 2.3 AI Summary Enrichment (Stage 7-9)

**`supabase/functions/english-coach/index.ts`** — Enriched prompt:
- Pre-computed categories: `activated_expressions`, `recall_only`, `context_weak`, `production_weak`
- Richer per-expression data: recall_score, cloze_correct, cloze_user_answer, sentence_text, sentence_feedback
- New output fields: `error_patterns[]` with pattern/expressions/suggestion

**`src/pages/EnglishReviewV3.tsx`** — Updated fallback summary:
- `buildFallbackSummary()` now computes V3.5 categories from dailySet
- `AISummaryCard` renders activated/recall_only/context_weak/production_weak/error_patterns
- `DailySummaryData` interface extended with optional V3.5 fields

### 2.4 History Page: Historical AI Summaries (Stage 10-13)

**`src/lib/hooks/useReviewSession.ts`** — New `useHistoricalSummaries()` hook:
- Fetches from `agent_logs` where `agent_type = "english_coach"` and `action = "daily_summary"`
- Returns parsed summary JSON per entry

**`src/pages/EnglishLearningHistory.tsx`** — New `HistoricalSummaryCard` component:
- Renders past AI summaries with: overview, completion, activated expressions, weak areas, tomorrow_focus
- Shows up to 14 days of history

### 2.5 Latest-Attempt Ordering Hardened (Stage 14-15)

All cloze practice_logs queries now use `order("created_at", { ascending: true })` + `Map.set()` dedup:
- `useTodayPracticeLogs()` — already correct (Map overwrite)
- `useHubSessionProgress()` — NEW: added order + Map dedup
- `useSessionDetail()` — FIXED: added order + Map dedup, replaced fragile `array[last]` pattern

### 2.6 Tests (Stage 16)

20 new tests in `EnglishReviewV3.test.tsx` (102 → 147 total):

| Block | Tests | Coverage |
|---|---|---|
| W1-W6 | getDailyReviewProgress | empty progress, recall scoring, cloze completion, partial correct, Map overwrite, mixed mode |
| X1-X6 | Fallback Summary Categories | activated, recall_only, context_weak, production_weak, mixed, empty |
| Y1-Y3 | AI Summary Data Structure | full fields, minimal valid, error_patterns structure |
| Z1-Z3 | Progress Cap | zero items, recall cap, cloze cap |
| H1-H3 | Historical Summary Entry | required fields, V3.5 categories, descending sort |

All 147 tests passing (102 English + 45 RecurringTaskLifecycle). TypeScript compilation clean.

---

## 3. Data Source Architecture (Post-Fix)

```
HUB (English.tsx)                     REVIEW (EnglishReviewV3.tsx)
       │                                        │
       ├── useEnglishStats()                    ├── useTodaySession()
       │   └── expression_reviews               │   └── review_sessions + session_items
       │       (SRS schedule & stats)            │       (daily set & recall scores)
       │                                        │
       └── useHubSessionProgress()  ←── SAME ──→ ├── useTodayPracticeLogs()
           └── review_sessions                    │   └── expression_practice_logs
               + session_items                    │       (cloze & sentence records)
               + practice_logs                    │
                                                  └── getDailyReviewProgress()
                                                      └── unified per-expression state
```

Both Hub and Review now share practice_logs as the cloze/sentence progress source.

---

## 4. Files Changed

| File | Lines | Summary |
|---|---|---|
| `src/lib/clozeUtils.ts` | +1/-6 | Remove redundant contextFromExample fallback |
| `src/lib/hooks/useReviewSession.ts` | +165 | useHubSessionProgress, useHistoricalSummaries, latest-attempt hardening |
| `src/pages/English.tsx` | +82 | Session-based progress bars replacing expression_reviews-based progress |
| `src/pages/EnglishLearningHistory.tsx` | +104 | HistoricalSummaryCard, useHistoricalSummaries integration |
| `src/pages/EnglishReviewV3.tsx` | +100 | V3.5 fallback summary categories, AISummaryCard enrichment |
| `supabase/functions/english-coach/index.ts` | +34 | Enriched prompt with pre-computed categories, error_patterns |
| `src/__tests__/EnglishReviewV3.test.tsx` | +476 | 20 new V3.5 tests |

---

## 5. What Was NOT Changed

- SRS interval algorithm (unchanged)
- No new learning modes (unchanged)
- No new agents (unchanged)
- No complex dashboards (unchanged)
- Old `EnglishReview.tsx` (dead code, no route — left for reference)

---

## 6. Verification Checklist

- [x] TypeScript compilation: clean (`tsc --noEmit`)
- [x] 147 tests passing (102 EnglishReviewV3 + 45 RecurringTaskLifecycle)
- [x] Code pushed to GitHub + Cloudflare Pages auto-deploying
- [ ] Browser E2E: English Hub + Review + History (requires login)
- [ ] Edge function deployment: `supabase functions deploy english-coach`
- [ ] Migration 088: UNIQUE constraint on task_completion_records (from Phase A)
