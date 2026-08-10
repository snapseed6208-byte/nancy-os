# English Learning State Integrity Report

**Task**: English Learning V4.2 — Learning State Machine + Mobile Navigation Integrity Fix
**Date**: 2026-08-10
**Status**: Complete — 312 tests pass (286 prior + 26 new), `tsc -b` clean, `vite build` + `build:verify` clean.

## 1. Root cause

The mobile `/english/learn` permanent dead-end had two independent defects that compounded:

1. **`stage` was persisted, but everything else was local.** `review_sessions.learn_progress` stored only `{ expression_index, stage }`. The recall completion flags (`recall_completed`) and the recall result view (`recallPhase` / `recallOutcome`) lived purely in React local state.
2. **On refresh the resume effect restored `saved.stage` directly** — a user at Stage 4 (个人造句 / production) came back with `stage = "production"` but `recallPhase = "idle"`. The completion submit guard rejected with `"请先完成主动回忆"` because it re-checked the transient local `recallPhase`, and the production back-arrow was gated on `recallPhase === "result"` — so on mobile there was **no way forward and no way back**. A permanent dead-end.

**Fix**: make the persisted `learn_progress` a full, canonical `LearningItemProgress` (completion flags + recall evidence + sentence draft), drive the guard from that canonical state, normalize-on-resume (repair or redirect, never dead-end), and make back-navigation unconditionally available on every stage.

## 2. Why UI-Stage4-but-recall-incomplete was possible

The invariant `stage = production ⟹ recall_completed` was **never enforced by the state machine** — it was enforced (badly) by a UI check against `recallPhase`, which is not durable. Persisting `stage` without the flag created a state where the UI could truthfully say "production" while the backend had zero proof recall ran. V4.2 makes the invariant **canonical**: a `production` record must carry `recall_completed = true`, and `normalizeLearningProgress` refuses to leave a user on a stage whose prerequisites are not persisted.

## 3. Persist-before-navigate order

All stage changes are **persist-first** (`goToStage`):

```
setSaving(true)
  → await persistProgress(next)     // write full JSONB to review_sessions.learn_progress
  → setProgress(next); setStage(s)  // navigate only after the DB write resolves
setSaving(false)
```

On mutation failure the user **stays on the current stage** with `"进度保存失败，请重试。"` — never an early advance. The footer shows an optimistic `正在保存…` while the write is in flight (PART 14: the UI never advances before the backend confirms).

## 4. Canonical state source

`src/lib/english/learningProgress.ts` is the **single source of truth** for a learning item's stage progress. It owns:

- the stage model (`LearnStage`, `STAGE_ORDER`, `STAGE_LABELS`, `PREV_STAGE`)
- the persisted shape (`LearningItemProgress`, `DEFAULT_LEARN_PROGRESS`)
- every transition (`progressForStage`, `progressForNavigation`)
- normalization (`normalizeLearningProgress`)
- the completion guard (`completionGuard`)
- advance (`advanceAfterComplete`)
- persistence mapping (`toProgressJSON` / `parseProgressJSON`)

`useReviewSession.ts` re-exports the type; `sessionRepository.ts` parses the JSONB through `parseProgressJSON`. The page (`EnglishLearn.tsx`) imports the pure functions directly. There is exactly one definition of "what stage is the user on and what may they do."

## 5. normalizeLearningProgress — repair or redirect, never a dead-end

On every load/resume the persisted progress is reconciled against the stage invariants:

- **Repair** — recall *evidence* (`recall_score` / `recall_result`) present but the `recall_completed` flag lost → restore the flag, keep the stage.
- **Legacy repair** — a pre-V4.2 record `{ expression_index, stage: production }` carries no flags; the persisted stage itself is proof recall ran (the old code only wrote `stage = production` after the recall step), so `parseProgressJSON` infers the flags from the stage and the user is restored to production with completion immediately allowed.
- **Redirect** — a stage ahead of its persisted evidence (e.g. `production` without recall) is pulled back to the highest legal stage with a message, e.g. `"上次学习进度未完整保存，已回到主动回忆。"` — never left stranded.

`completionGuard(progress)` reuses this: it decides purely on canonical `recall_completed` (no transient `recallPhase` dependency) and, when blocked, returns a **redirect target + message** instead of a bare error. The UI renders `[返回{目标阶段}]` — the spec's PART 16 contract: never `"请先完成主动回忆"` without a way back.

## 6. Mobile back navigation (every stage)

The footer `StageNav` renders an always-available back control on **every** stage:

| Stage | Back control |
|---|---|
| understand | 下一步 (forward) — nothing before it |
| contextUsage | `[上一步]` + `[开始主动回忆]` |
| recall (idle/checking) | `[上一步]` → contextUsage |
| recall (result) | `[重新想一次]` + `[继续个人造句]` |
| production | `[←]` → recall — **not gated on recallPhase**, always present |

PART 7: there is no stage without a way back. `PREV_STAGE` defines the single allowed backward hop.

## 7. Completed tabs are clickable; future tabs disabled

The `StageIndicator` pills/segments: completed stages (`i < stageIndex`) are **clickable buttons** that return the user (via `onGoToStage`, persist-first) with an aria-label `（点击返回）`; the current stage is highlighted; future stages are `cursor-not-allowed` disabled. Forward movement is driven only by the sequential CTA buttons (`isStageReachable`: target index ≤ current index), so the user can always retreat but never skip ahead.

## 8. Mobile scroll / fixed footer / safe-area

The page root uses `PAGE_BOTTOM_PADDING_CLASS = "pb-[calc(8.5rem+env(safe-area-inset-bottom))]"` so content clears the fixed footer (≈72px) plus the iOS home indicator. The footer itself uses `FOOTER_SAFE_AREA_CLASS = "pb-[env(safe-area-inset-bottom)]"`. The shell scrolls naturally (no `overflow-hidden`), and the footer never covers the personal-sentence textarea. These constants live in `learningProgress.ts` and are asserted by test T25.

## 9. Resume contract (refresh restore)

The resume effect restores the exact left-off item (`expressionIndex`), then runs `normalizeLearningProgress`. When the canonical state has recall evidence, the recall result view (`recallPhase = "result"`, outcome, input) is restored from persisted `recall_result` / `recall_score` / `recall_feedback` / `recall_input`, so completion and the production back-arrow work immediately after refresh. The personal-sentence draft is restored from `sentence_draft` and is preserved across back-nav → return via `progressForNavigation` (T24, T18).

## 10. Tests

**312 passing** (5 files). New file `src/__tests__/EnglishLearnStateMachine.test.ts` — 26 tests across 6 groups (PART 17):

- **17.1** `normalizeLearningProgress` — fresh ok, production+recall ok, evidence repair, no-evidence redirect, recall stage ok, stage-ahead redirect (T1–T6)
- **17.2** stage invariants through transitions — understand/context/recall flags, `production ⟹ recall_completed`, back keeps completed flags, round-trip evidence preserved (T7–T11)
- **17.3** `completionGuard` — canonical decision, no transient `recallPhase` re-check, redirect target is a reachable prior stage (T12–T15)
- **17.4** serialization + resume — JSONB round-trip, legacy `{expression_index, stage: production}` repaired in place (the reported bug), refresh restores production + result view (T16–T18)
- **17.5** advance — 2/5 → 3/5 exactly once, last item → summary, mutation-failure never advances (T19–T21)
- **17.6** mobile navigation — forward skip disabled, back always allowed, draft survives leave/return, layout safe-area contract, every stage has a Chinese label (T22–T26)

## 11. Android / mobile E2E (manual checklist)

No headless mobile driver is available in this environment, so these must be verified manually on a real device / 390×844 emulation. The state machine paths are fully covered by the unit suite above; this checklist confirms the rendered UI wiring:

- [ ] Fresh learn session → Stage 1, no flags, footer shows 下一步.
- [ ] Stage 1→2→3: each CTA marks the prerequisite complete (understand/context), progress pills turn into clickable completed tabs.
- [ ] Recall: type answer → 检查 → result view → 继续个人造句 → Stage 4.
- [ ] **Refresh at Stage 4** → restores Stage 4, `[←]` back to recall always visible, 完成本条学习 available after sentence feedback. (The reported dead-end.)
- [ ] **Refresh at Stage 4 then submit sentence** → completes, advances 2/5→3/5.
- [ ] Back from production → recall result view restored with persisted evidence → 重新想一次 clears evidence; 继续个人造句 returns.
- [ ] Personal sentence draft typed, back to recall, forward again → draft restored.
- [ ] Footer does not cover the textarea on Android Chrome / iOS Safari (safe-area inset respected); page scrolls to bottom without a dead-end.
- [ ] Simulate a truncated DB write (`stage: production` only, no flags) → app restores production and allows completion (legacy repair, T17).

## 12. Production verification

- [x] `tsc -b` — 0 errors.
- [x] `npx vitest run` — 312 passed (286 prior + 26 new).
- [x] `npm run build` — `vite build` succeeded; `build:verify` confirms no `placeholder.supabase` in output.
- [x] Committed and pushed to GitHub (auto-deploy memory) — Cloudflare Pages deployment verified.
- [ ] Deployed app: open `/english/learn` on mobile, confirm the refresh-at-Stage-4 flow no longer dead-ends.
- [ ] Confirm existing in-flight learn sessions (legacy `{expression_index, stage}` records) resume without losing the user's place.

**Final invariant**: visible Stage = DB-allowed completion stage. The UI can never sit on production while the backend reports recall incomplete — and every blocked path offers a return, never a dead-end.
