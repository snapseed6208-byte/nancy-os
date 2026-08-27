# English SRS Memory Semantics & Atomic Recall Report

Date: 2026-08-27

Timezone: Asia/Shanghai

Deployment status: stopped before deployment. No migration, DB push, Function deploy, or git push was executed.

## 1. Current multi-attempt behavior

The first-round implementation scheduled only the first Recall attempt, guarded by persisted `review_session_items.attempt_count`. Later rolling attempts changed `today_passed`/queue state but normally did not call SRS again.

For an original mature card (`interval=30`, `EF=2.5`, `repetitions=8`, `lapse=0`):

- First score 2: interval 8, EF 2.36, repetitions 7, status review, due in 8 Shanghai calendar days.
- Later score 3: item became passed, but SRS remained interval 8, EF 2.36, repetitions 7.
- First score 1: interval 1, EF 2.18, repetitions 0, lapse 1, status learning, due tomorrow.
- Later score 4: item became passed, but SRS remained on the 1-day lapse schedule.

Therefore the final pass did **not** overwrite the first fuzzy/lapse penalty. The semantic result was directionally correct, but it depended on a fragile sequence of non-atomic client writes.

## 2. Whether final pass overwrote lapse

No in the first-round code, and no after this fix.

After this fix the guarantee is stronger: the server stores the pre-day `original_srs`, preserves cumulative `had_lapse` and `had_fuzzy`, selects the day's worst score as `memory_quality_for_scheduling`, and recomputes from the original snapshot. A later score 3/4/5 changes `today_passed`; it cannot replace the day's scheduling quality.

## 3. New daily memory-state semantics

Two independent facts are authoritative:

- `today_passed`: whether the latest attempt is 3/4/5 and the card may stop rolling today.
- `memory_quality_for_scheduling`: the worst Recall event observed today.

Flags are monotonic for the day:

- any score 1 sets `had_lapse=true` permanently for that session/day;
- any score 2 sets `had_fuzzy=true` permanently for that session/day;
- a later pass never clears either flag.

`needs_relearning=true` when the day had a lapse or an unresolved card reached the four-attempt cap.

## 4. 30-day truth table

Original state: interval 30, EF 2.5, repetitions 8, lapse 0; date 2026-08-27 Shanghai.

| Attempts | Today passed | Scheduling quality | EF | Reps | Lapses | Interval | Next review | Status |
|---|---:|---|---:|---:|---:|---:|---|---|
| 3 | Yes | hard | 2.50 | 8 | 0 | 36 | 2026-10-02 | review |
| 4 | Yes | good | 2.60 | 9 | 0 | 78 | 2026-11-13 | review |
| 5 | Yes | easy | 2.66 | 9 | 0 | 104 | 2026-12-09 | mastered |
| 2 → 3 | Yes | fuzzy | 2.36 | 7 | 0 | 3 | 2026-08-30 | review |
| 2 → 4 | Yes | fuzzy | 2.36 | 7 | 0 | 3 | 2026-08-30 | review |
| 1 → 3 | Yes | again | 2.18 | 0 | 1 | 1 | 2026-08-28 | learning |
| 1 → 4 | Yes | again | 2.18 | 0 | 1 | 1 | 2026-08-28 | learning |
| 1 → 2 → 4 | Yes | again | 2.18 | 0 | 1 | 1 | 2026-08-28 | learning |

The required ordering holds: lapse path 1 day < fuzzy path 3 days < first score 3 at 36 days < score 4 at 78 days < score 5 at 104 days.

## 5. Score 2 interval decision

The first-round 25% formula produced 8 days for a 30-day card. That is mathematically plausible but too late for the product meaning “fuzzy enough to require reinforcement again today.”

The SM-2-shaped penalty remains, but the fuzzy branch now has a 3-day cap:

```text
interval = min(3, max(2, round(original_interval × 0.25)))
```

This is not a cosmetic fixed interval: young cards can receive 2 days, mature cards are capped at 3, and all calculations still start from the original interval.

## 6. Score 1 relearning behavior

Any score 1 sets the daily worst quality to Again:

- repetitions reset to 0;
- interval becomes 1 day;
- lapse count increments once from the pre-day snapshot;
- status may return to learning;
- due date becomes tomorrow in Shanghai.

A later same-day pass proves today's reinforcement worked, but does not restore a long interval.

## 7. Same-day scheduling behavior

Attempts 1/2 requeue at the tail until a score 3/4/5 or attempt 4. Attempt 4 while still failing stops the loop but does not become a pass. The persisted state is:

- `today_passed=false`
- `max_attempts_reached=true`
- `needs_relearning=true`
- `reinforcement_status=max_rounds`
- near-term schedule based on the daily worst event

## 8. Cross-day scheduling behavior

Every attempt recomputes the one daily cross-day event from `original_srs + daily worst score`. It never uses the schedule written by the previous same-day attempt as its input. Consequently repeated attempts cannot compound interval growth or erase penalties.

The canonical `expression_reviews` record is one row per `(session_id, expression_id)` and is updated only if the daily worst quality changes.

## 9. Attempt history

Every successful RPC transaction inserts one immutable practice log containing:

- stable `attempt_id`
- expression/session IDs
- score and rating
- attempt number
- database timestamp
- `is_requeue`
- daily lapse/fuzzy/pass flags
- the authoritative RPC result

`review_session_items.mode_data.recall.attempts` also retains the complete ordered attempt trail for resume and future analytics.

## 10. Atomic Recall design

`submit_recall_attempt(session_id, item_id, score, attempt_id)` performs in one PostgreSQL transaction:

1. authenticate;
2. validate review-session ownership;
3. lock and validate the session item;
4. lock and validate the expression;
5. return the saved result for a duplicate attempt ID;
6. read/capture original SRS state;
7. derive cumulative daily memory flags and pass/requeue state;
8. recompute the schedule from the original state and worst event;
9. update expression SRS;
10. update session item/rolling state/mode data;
11. insert immutable practice history;
12. insert or update the single canonical session review event;
13. return the authoritative result.

## 11. Partial write risk before

The previous client order was:

1. `review_session_items UPDATE` including score, attempts, mode data;
2. `expression_practice_logs INSERT`;
3. `expressions UPDATE` inside `useSubmitReview`;
4. `expression_reviews INSERT` inside `useSubmitReview`;
5. local queue/current-index update.

Invalidations were split across mutations: session/status/hub/stats after item update; practice/status/hub after log insert; expressions/stats after SRS submission.

Failure consequences:

- item succeeds, log fails: queue knows the failure but attempt history and SRS are absent; refresh sees attempt 1 and can suppress the missing first schedule.
- log succeeds, item fails (not the current order, but possible after reordering): orphan history exists while the queue treats the card as unattempted.
- expression update succeeds, expression-review insert fails: schedule changes, item/log also exist, but canonical review history is absent and the UI receives failure.
- any of these windows could leave `next_review_date`, rolling state, and analytics disagreeing.

## 12. Transaction behavior after

PostgreSQL functions execute atomically. The RPC has no exception handler that swallows internal errors. If any update/insert/constraint fails, all expression, item, log, and review-event writes roll back together.

The frontend performs one RPC call and advances the card only after it returns successfully.

## 13. Idempotency

`expression_practice_logs.attempt_id` is protected by a unique `(user_id, attempt_id)` partial index. A retry with the same ID returns the exact previously stored `rpc_result`; it does not add another log, attempt, review count, or schedule update.

The UI creates one UUID per rating action, has a synchronous submit guard against rapid double-clicks, and reuses that UUID for network retry. The server also rejects a new distinct attempt after the item has already passed or reached the cap.

## 14. Network failure behavior

Automatic mutation retry is disabled. On failure:

- current index does not advance;
- the current card and selected score stay visible;
- an explicit “提交失败，请重试” action appears;
- Retry resubmits the same attempt ID.

If the first request committed but its response was lost, Retry is an idempotent read of the committed result.

## 15. Migration

New local migration: `105_atomic_recall_submission.sql`.

Minimal schema additions:

- nullable `expression_practice_logs.attempt_id UUID` plus unique partial index;
- nullable `expression_reviews.session_id` plus unique per-session/expression index;
- expanded review-result constraint to include `again` and `fuzzy`;
- transactional `submit_recall_attempt` RPC.

No new SRS table was created. The migration has not been applied.

## 16. Tests

Added coverage includes:

- all eight required 30-day trajectories;
- daily pass vs worst memory quality;
- monotonic lapse/fuzzy flags;
- no same-day interval compounding;
- persistent requeue and max attempts;
- RPC ownership/locking/idempotency contract;
- duplicate network retry;
- modeled internal-failure rollback;
- explicit retry UI with stable attempt ID;
- Cloze/Sentence scheduling isolation;
- mastered future due, legacy status-independent due, Learn-pool exclusion, and Shanghai boundary regressions.

Full Vitest result: 28 files, 683 tests passed.

## 17. TypeScript

TypeScript passed as part of the production build. Database type declarations were updated for the new columns and RPC.

## 18. Build

`npm run build` passed, including `tsc -b`, Vite production build, PWA generation, and placeholder-Supabase verification.

The existing large-chunk warning remains and is unrelated to Recall.

## 19. Remaining risks

1. The migration was contract-tested but not executed against a real PostgreSQL/Supabase instance in this run. Actual rollback and constraint behavior must be integration-tested in staging after applying migration 105.
2. SQL and TypeScript retain parallel scheduling implementations: SQL is authoritative for Recall; TypeScript remains used by Learn and as an executable specification. Formula parity requires a contract test whenever either changes.
3. Sessions already in progress when migration 105 is introduced may contain first-round attempts without `original_srs`. The RPC preserves their recorded worst flags, but cannot perfectly reconstruct a pre-attempt EF/repetition snapshot. Deploy at a Shanghai day boundary or after active review sessions finish.
4. Two devices intentionally sending different attempt IDs before either UI observes the other are serialized, but can represent two attempts. Same-operation retries are fully idempotent; cross-device intent deduplication would require an expected-attempt-version contract.

## 20. Production recommendation

Do not deploy the frontend before migration 105 exists: the new client depends on the RPC.

Recommended release order:

1. apply migration 105 in staging;
2. run a real transaction test with an injected constraint failure and verify zero partial writes;
3. verify duplicate attempt ID returns byte-equivalent business results;
4. verify the eight 30-day trajectories directly in PostgreSQL;
5. release migration and frontend together near Shanghai day rollover, with no active review sessions;
6. monitor RPC errors, duplicate attempt returns, max-attempt counts, and due-pool totals before production promotion.

Canonical due remains status-independent (`user + not archived + next_review_date <= Shanghai today`), and scheduled legacy rows remain excluded from Learn via `next_review_date IS NULL`.
