# English SRS Rolling Review Audit & Fix Report

Date: 2026-08-27

Canonical timezone: Asia/Shanghai

Deployment status: not deployed; no DB push, Function deploy, or git push performed.

## 1. Why the current experience looked like “only yesterday’s expressions”

There was no `learned_at = yesterday`, `created_at = yesterday`, or equivalent filter in the active Today Review path. The active query did use `next_review_date <= Shanghai today`, but also required `status IN ('review', 'mastered')`.

The repository’s earlier production audit records that many legacy expressions already had a real `next_review_date` while their status remained `learning`. Those historical scheduled rows were therefore invisible to Today Due. Newly completed Learn rows are changed to `review`, so they did appear the next day; this combination created the observed “mostly yesterday” symptom.

A second independent bug made the symptom worse: any non-null `recall_score`, including 1 or 2, counted as completed. Failed cards disappeared from remaining/resume state after their first display.

## 2. Old Due Query

The previous canonical repository query was equivalent to:

```ts
expressions
  .eq("user_id", userId)
  .eq("archived", false)
  .in("status", ["review", "mastered"])
  .lte("next_review_date", getShanghaiDateKey())
```

There was no learned-yesterday condition. The defect was the status gate, not the date comparison.

## 3. New Canonical Due Query

The due-pool policy is now:

```ts
expressions
  .eq("user_id", userId)
  .eq("archived", false)
  .lte("next_review_date", getShanghaiDateKey())
```

`lte` excludes null dates, so a real `next_review_date` is the SRS-lifecycle signal. Status is intentionally not used because it has drifted in production. Home/English status, review session creation, batch append, legacy English due selectors, and the dashboard now share this status-independent policy.

Learn-pool selectors now additionally require `next_review_date IS NULL`; a legacy scheduled `learning` row can no longer be placed in both Learn and Review.

## 4. Current Due-Pool Truth Table (before the fix)

For A–E below, `status='review'` is assumed; F–H use the stated status.

| Expression | Current system includes today? | Should include? |
|---|---:|---:|
| A — learned yesterday, due today | Yes | Yes |
| B — learned 3 days ago, due today | Yes | Yes |
| C — learned 7 days ago, due today | Yes | Yes |
| D — learned 30 days ago, due today | Yes | Yes |
| E — learned yesterday, due in 3 days | No | No |
| F — mastered, due today | Yes | Yes |
| G — review, due yesterday | Yes | Yes |
| H — review, due tomorrow | No | No |
| Legacy scheduled `learning`, due today | **No** | **Yes** |

Thus a correctly labeled 7-day or 30-day row did enter. A historically scheduled row with the drifted `learning` label did not. That status-dependent failure is the root cause found in the production data model.

## 5. Learn → First Review

Learning completion remains atomic through `complete_expression_learning`. The existing first-review rule is preserved explicitly: Learn completed today sets `next_review_date` to tomorrow in Shanghai and `interval_days=1`. Every later review is selected only through the persisted due date; `learned_at` is not used to calculate later reviews.

## 6. Old 1–5 Mapping

The UI showed five values, but only two scheduling meanings were reachable:

| Score | Old rating | Old same-day result | Old cross-day behavior |
|---|---|---|---|
| 1 | hard | treated as attempted/complete | interval roughly ×1.2; no lapse |
| 2 | hard | treated as attempted/complete | interval roughly ×1.2; no lapse |
| 3 | hard | passed | interval roughly ×1.2 |
| 4 | good | passed | normal growth |
| 5 | good | passed | same as 4; `easy` unreachable |

This meant score 1 did not collapse a mature interval and score 1/2 did not roll again today.

## 7. New 1–5 Behavior and Formula

The score-to-rating mapping is now one-to-one:

| Score | Rating | Today | Cross-day interval |
|---|---|---|---|
| 1 | again | fail, requeue | 1 day; repetitions reset; lapse +1 |
| 2 | fuzzy | fail, requeue | `max(2, round(I × 0.25))`; repetitions -1 (floor 0) |
| 3 | hard | pass | `max(3, round(I × 1.2))`; repetitions retained |
| 4 | good | pass | repetitions +1; normal EF growth |
| 5 | easy | pass | repetitions +1; largest growth (`I × EF × 1.3`) |

For a mature 30-day card at EF 2.5, the tested intervals are strictly ordered: `1, 8, 36, 78, 104` days.

Ease factor remains SM-2-style:

```text
EF' = max(1.3, EF + (0.1 - (3-q) × (0.08 + (3-q) × 0.02)))
q = 0,1,2,3,4 for scores 1,2,3,4,5
```

Intervals remain capped at 365 days.

## 8. Score-Specific Same-Day Behavior

- Score 1: `today_passed=false`, appended near the queue tail, cross-day lapse to tomorrow.
- Score 2: `today_passed=false`, appended near the queue tail, milder interval collapse than score 1.
- Score 3: `today_passed=true`, no same-day requeue, conservative growth.
- Score 4: `today_passed=true`, no same-day requeue, normal growth.
- Score 5: `today_passed=true`, no same-day requeue, maximum growth and always a future due date.

## 9. Lapse and Mastered Behavior

A mature 30-day card scored 1 now becomes interval 1, repetitions 0, lapse count +1, and a near-term learning-stage schedule. Since the due query is status-independent, a lapsed card cannot disappear merely because its stage/status changed.

`mastered` means maintenance, not graduation. A mastered card with a due date is included. Score 5 assigns another finite future date; score 1 collapses it into relearning.

## 10. Rolling Queue and Attempt Cap

The queue begins with all fresh unresolved cards. Score 1/2 appends the card to the tail, so other expressions intervene before it returns. A sequence such as `1 → 2 → 4` preserves all three attempts and stops only after the 4 passes.

`MAX_SAME_DAY_ATTEMPTS=4`. If the fourth attempt still fails, rolling stops for that card without marking it passed. `mode_data.recall` stores `needs_relearning=true` and `max_attempts_reached=true`. A score-2 card that reaches the cap is forced to an Again/tomorrow schedule; a score-1 card was already scheduled for tomorrow.

## 11. Batch and Day Completion

Recall completion is now based on `today_passed`, with the explicit max-attempt fallback, rather than `attempted` or `recall_score != null`.

- 15 loaded, 12 passed, 3 failed: Recall batch is not complete; the 3 continue rolling.
- `unique_due_count` remains the session target/denominator. Repeated attempts never create extra session items and never increase the total.
- `remaining` is the number of unique expressions not yet passed or safely capped.
- Day completion requires zero unique remaining plus completion of the configured training modes.

SRS completion and training completion are now conceptually distinct: Recall decides whether the expression passed today; Cloze/Sentence may still be required by the UI before the whole training day is presented as complete.

## 12. Attempt Persistence and Refresh/Resume

Every Recall attempt writes an immutable `expression_practice_logs` row with:

- `expression_id`
- `session_id`
- `score`
- `metadata.attempt_number`
- `metadata.is_requeue`
- timestamp (`created_at`)

`review_session_items` persists the latest score, attempt count, reinforcement round/status, and `mode_data.recall.attempts`. On refresh, the queue is reconstructed from database state: never-attempted unresolved cards first, then failed reinforcement cards. A score-1/2 card therefore remains pending after page exit or app restart.

## 13. Recall / Cloze / Sentence Responsibilities

- Recall is the only mode calling SRS scheduling. Only the first Recall attempt normally changes the cross-day interval; a max-attempt safety fallback may shorten it to tomorrow.
- Cloze writes practice evidence only and does not update `next_review_date`.
- Sentence writes answer/evaluation evidence only and does not update `next_review_date`.

This prevents one three-mode review from advancing SRS three times.

## 14. Timezone

Due cutoff, session date, day rollover, scheduling date arithmetic, daily review time windows, and English/dashboard due counts now use Asia/Shanghai helpers. Timestamp windows use inclusive Shanghai midnight and exclusive next Shanghai midnight.

## 15. Root-Cause Classification

- A. Due Pool bug: status gate excluded scheduled legacy rows; fixed by status-independent due policy.
- B. Rating mapping bug: five UI scores collapsed to two ratings; fixed with five distinct ratings.
- C. Same-day rolling missing: failed cards were never appended; fixed with persisted tail requeue.
- D. Lapse bug: score 1 mapped to Hard; fixed with Again/reset/lapse.
- E. Mastered bug: active main query included mastered, but other status drift could still exclude scheduled cards; all status gates removed.
- F. Completion semantics bug: non-null score meant complete; fixed with pass-or-safe-cap semantics.
- G. Persistence bug: rolling state and first-submit protection were local-memory-based; queue restoration now derives from persisted attempts/status and scheduling is guarded by persisted `attempt_count`.

## 16. Migration Requirement

No new migration is required. The implementation reuses existing columns and tables from migrations 086, 087, and 096: `attempt_count`, `reinforcement_round`, `status`, `mode_data`, and `expression_practice_logs.metadata`.

No migration, DB push, Function deploy, or data backfill was executed.

## 17. Modified Files

- `src/lib/english/duePoolPolicy.ts`
- `src/lib/english/reviewRepository.ts`
- `src/lib/english/rollingReview.ts`
- `src/lib/english/sessionRepository.ts`
- `src/lib/hooks/useReviewSession.ts`
- `src/lib/hooks/useEnglish.ts`
- `src/lib/hooks/useDashboard.ts`
- `src/lib/srs/expressionSrs.ts`
- `src/pages/EnglishLearn.tsx`
- `src/pages/EnglishReviewV3.tsx`
- `tests/english-srs-rolling-review.test.ts`
- this report

Pre-existing unrelated dirty-worktree files were not modified as part of this fix.

## 18. Tests, TypeScript, and Build

- New rolling-SRS suite covers the requested due cases, scores 1–5, `1→3`, `1→2→4`, incomplete 15-card batch, 31 unique vs repeated attempts, mature lapse, mastered future scheduling, refresh restoration, mode isolation, max attempts, and Shanghai midnight.
- Full Vitest: 26 files, 661 tests passed.
- Legacy standalone SRS regression: 119 passed.
- TypeScript: `npx tsc -b --pretty false` passed.
- Production build: `npm run build` passed; placeholder-Supabase verification passed.

## 19. Remaining Risks

1. Review submission still spans three client-side writes (session item, practice log, expression schedule) rather than one database transaction. Normal refresh/retry semantics are fixed, but a network failure between those writes can leave partial evidence. A future atomic Recall RPC would close this integrity gap.
2. No live production Supabase integration or data audit was executed in this run because DB push/deployment was explicitly prohibited. Static policy tests and repository tests passed.
3. The build retains the existing Vite warning for JavaScript chunks larger than 500 kB; unrelated to SRS behavior.
4. The UI still requires Cloze and Sentence for full training-day completion. This is intentional and separate from Recall/SRS pass state.
