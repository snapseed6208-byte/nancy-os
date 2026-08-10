// ============================================
// English SRS V4.2 — Learning State Machine
//
// SINGLE source of truth for a learning item's stage progress.
// Persisted as JSONB on review_sessions.learn_progress (snake_case keys),
// surfaced as the camelCase LearningItemProgress below.
//
// Invariants enforced by progressForStage / normalizeLearningProgress:
//   - stage = contextUsage ⟹ understand_completed
//   - stage = recall      ⟹ understand_completed + context_completed
//   - stage = production  ⟹ understand_completed + context_completed + recall_completed
//   - NEVER stage = production with recall_completed = false
//   - normalize repairs (evidence → recall_completed) or redirects back
//     instead of leaving the user on an unreachable stage.
// ============================================

export type LearnStage = "understand" | "contextUsage" | "recall" | "production";

export const STAGE_ORDER: LearnStage[] = ["understand", "contextUsage", "recall", "production"];

export const STAGE_LABELS: Record<LearnStage, string> = {
  understand: "理解表达",
  contextUsage: "场景与用法",
  recall: "主动回忆",
  production: "个人造句",
};

/** The one allowed backward hop from each stage (used for ←上一步 / completed-tab). */
export const PREV_STAGE: Record<LearnStage, LearnStage | null> = {
  understand: null,
  contextUsage: "understand",
  recall: "contextUsage",
  production: "recall",
};

export type RecallResult = "correct" | "partial" | "incorrect";

export interface LearningItemProgress {
  expressionIndex: number;
  stage: LearnStage;
  understand_completed: boolean;
  context_completed: boolean;
  recall_completed: boolean;
  production_completed: boolean;
  /** Persisted recall evidence — the proof that recall actually ran. */
  recall_result?: RecallResult;
  recall_score?: number;
  recall_feedback?: string;
  recall_input?: string;
  /** Persisted personal-sentence draft so back-nav / refresh never loses input. */
  sentence_draft?: string;
}

export const DEFAULT_LEARN_PROGRESS: LearningItemProgress = {
  expressionIndex: 0,
  stage: "understand",
  understand_completed: false,
  context_completed: false,
  recall_completed: false,
  production_completed: false,
};

export const NORMALIZE_REDIRECT_MESSAGE = "上次学习进度未完整保存，已回到主动回忆。";

/**
 * Layout contract (PART 9/10): page bottom padding must clear the fixed footer
 * (≈72px) plus the iOS home indicator; the footer itself must not sit under it.
 */
export const PAGE_BOTTOM_PADDING_CLASS = "pb-[calc(8.5rem+env(safe-area-inset-bottom))]";
export const FOOTER_SAFE_AREA_CLASS = "pb-[env(safe-area-inset-bottom)]";

export function redirectMessage(stage: LearnStage): string {
  if (stage === "recall") return NORMALIZE_REDIRECT_MESSAGE;
  return `上次学习进度未完整保存，已回到「${STAGE_LABELS[stage]}」。`;
}

// ═══════════════════════════════════════
// Stage legality
// ═══════════════════════════════════════

/** Highest stage the persisted completion flags currently authorize. */
export function maxStageForProgress(
  p: Pick<LearningItemProgress, "understand_completed" | "context_completed" | "recall_completed">,
): LearnStage {
  if (p.recall_completed) return "production";
  if (p.context_completed) return "recall";
  if (p.understand_completed) return "contextUsage";
  return "understand";
}

/**
 * Forward jumps are forbidden (no skipping): a target is reachable only when
 * it is the current stage or an earlier (completed) stage. Forward movement is
 * driven exclusively by the sequential CTA buttons.
 */
export function isStageReachable(current: LearnStage, target: LearnStage): boolean {
  return STAGE_ORDER.indexOf(target) <= STAGE_ORDER.indexOf(current);
}

// ═══════════════════════════════════════
// Transitions
// ═══════════════════════════════════════

/**
 * Pure transition: moving to `stage` marks every prerequisite stage complete,
 * and never clears already-completed flags (back only changes the view).
 */
export function progressForStage(
  prev: LearningItemProgress,
  stage: LearnStage,
  extra?: Partial<LearningItemProgress>,
): LearningItemProgress {
  const next: LearningItemProgress = { ...prev, stage, ...extra };
  if (stage === "contextUsage" || stage === "recall" || stage === "production") next.understand_completed = true;
  if (stage === "recall" || stage === "production") next.context_completed = true;
  if (stage === "production") next.recall_completed = true;
  return next;
}

/**
 * Navigation helper: like progressForStage, but preserves the personal-sentence
 * draft when leaving production so the user can pick it back up on return.
 */
export function progressForNavigation(
  prev: LearningItemProgress,
  target: LearnStage,
  sentenceDraft?: string,
): LearningItemProgress {
  const next = progressForStage(prev, target);
  if (prev.stage === "production" && target !== "production" && sentenceDraft && sentenceDraft.trim()) {
    next.sentence_draft = sentenceDraft.trim();
  }
  return next;
}

// ═══════════════════════════════════════
// Normalize on load / resume
// ═══════════════════════════════════════

export type NormalizeResult =
  | { kind: "ok"; progress: LearningItemProgress }
  | { kind: "repair"; progress: LearningItemProgress; message: string }
  | { kind: "redirect"; progress: LearningItemProgress; stage: LearnStage; message: string };

/**
 * Reconcile persisted progress against the stage invariants:
 *  - recall evidence (score/result) repairs a lost recall_completed flag;
 *  - a stage ahead of its persisted evidence is redirected back to the highest
 *    legal stage instead of dead-ending (e.g. production without recall).
 */
export function normalizeLearningProgress(
  saved: Partial<LearningItemProgress> | null | undefined,
): NormalizeResult {
  const base: LearningItemProgress = {
    ...DEFAULT_LEARN_PROGRESS,
    ...saved,
    expressionIndex: saved?.expressionIndex ?? 0,
    stage: (saved?.stage ?? "understand") as LearnStage,
    understand_completed: saved?.understand_completed ?? false,
    context_completed: saved?.context_completed ?? false,
    recall_completed: saved?.recall_completed ?? false,
    production_completed: saved?.production_completed ?? false,
    recall_result: saved?.recall_result,
    recall_score: saved?.recall_score,
    recall_feedback: saved?.recall_feedback,
    recall_input: saved?.recall_input,
    sentence_draft: saved?.sentence_draft,
  };

  const repaired = !base.recall_completed && (base.recall_score != null || base.recall_result !== undefined);
  if (repaired) base.recall_completed = true;

  const savedIdx = STAGE_ORDER.indexOf(base.stage);
  const legal = maxStageForProgress(base);
  const legalIdx = STAGE_ORDER.indexOf(legal);

  if (savedIdx <= legalIdx) {
    return { kind: repaired ? "repair" : "ok", progress: base, message: "" };
  }

  // Stage ahead of evidence with recall proven → keep it (e.g. production restored).
  if (base.recall_completed) {
    return { kind: "repair", progress: base, message: "" };
  }

  // No recall proof: pull the user back to the highest legal stage.
  const redirected: LearningItemProgress = { ...base, stage: legal };
  return { kind: "redirect", progress: redirected, stage: legal, message: redirectMessage(legal) };
}

// ═══════════════════════════════════════
// Completion guard
// ═══════════════════════════════════════

export type CompletionGuard =
  | { allowed: true }
  | { allowed: false; redirectTo: LearnStage; message: string };

/**
 * Completion may proceed iff canonical recall_completed is true. If it is not,
 * never throw a dead-end error — normalize and report where to go back to.
 */
export function completionGuard(progress: LearningItemProgress): CompletionGuard {
  if (progress.recall_completed) return { allowed: true };
  const norm = normalizeLearningProgress({ ...progress, stage: "production" });
  if (norm.kind === "redirect") {
    return { allowed: false, redirectTo: norm.stage, message: norm.message };
  }
  return { allowed: false, redirectTo: "recall", message: "主动回忆步骤尚未完整保存。" };
}

// ═══════════════════════════════════════
// Advance after a completed item
// ═══════════════════════════════════════

export interface AdvanceResult {
  /** null = this was the last item → show summary. */
  nextIndex: number | null;
  nextStage: LearnStage;
  nextProgress: LearningItemProgress;
}

/** 2/5 → 3/5 on success; last item → summary. Never double-advances. */
export function advanceAfterComplete(
  currentIndex: number,
  itemsLength: number,
): AdvanceResult {
  if (currentIndex < itemsLength - 1) {
    const nextIndex = currentIndex + 1;
    return {
      nextIndex,
      nextStage: "understand",
      nextProgress: { ...DEFAULT_LEARN_PROGRESS, expressionIndex: nextIndex, stage: "understand" },
    };
  }
  return {
    nextIndex: null,
    nextStage: "understand",
    nextProgress: { ...DEFAULT_LEARN_PROGRESS, expressionIndex: 0, stage: "understand" },
  };
}

// ═══════════════════════════════════════
// Persistence mapping (snake_case JSONB ↔ camelCase)
// ═══════════════════════════════════════

export interface ProgressJSON {
  expression_index: number;
  stage: LearnStage;
  understand_completed: boolean;
  context_completed: boolean;
  recall_completed: boolean;
  production_completed: boolean;
  recall_result?: RecallResult | null;
  recall_score?: number | null;
  recall_feedback?: string | null;
  recall_input?: string | null;
  sentence_draft?: string | null;
}

export function toProgressJSON(p: LearningItemProgress): ProgressJSON {
  return {
    expression_index: p.expressionIndex,
    stage: p.stage,
    understand_completed: p.understand_completed,
    context_completed: p.context_completed,
    recall_completed: p.recall_completed,
    production_completed: p.production_completed,
    recall_result: p.recall_result ?? null,
    recall_score: p.recall_score ?? null,
    recall_feedback: p.recall_feedback ?? null,
    recall_input: p.recall_input ?? null,
    sentence_draft: p.sentence_draft ?? null,
  };
}

export function parseProgressJSON(raw: Record<string, unknown> | null | undefined): LearningItemProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const stage = STAGE_ORDER.includes(raw.stage as LearnStage) ? (raw.stage as LearnStage) : "understand";
  const score = raw.recall_score;
  // Legacy records (pre-V4.2) persisted only { expression_index, stage } — the
  // completion flags were never written. For that format the stage itself is
  // the evidence: a record at 'production' had already passed recall, at
  // 'recall' had passed understand+context, etc. Explicitly-stored flags
  // (new format) remain authoritative and override the inference.
  const has = (key: string) => Object.prototype.hasOwnProperty.call(raw, key);
  const understand_completed = has("understand_completed")
    ? Boolean(raw.understand_completed)
    : stage !== "understand";
  const context_completed = has("context_completed")
    ? Boolean(raw.context_completed)
    : stage === "recall" || stage === "production";
  const recall_completed = has("recall_completed")
    ? Boolean(raw.recall_completed)
    : stage === "production";
  return {
    expressionIndex: Number(raw.expression_index) || 0,
    stage,
    understand_completed,
    context_completed,
    recall_completed,
    production_completed: Boolean(raw.production_completed),
    recall_result: raw.recall_result as RecallResult | undefined,
    recall_score: score != null && score !== "" ? Number(score) : undefined,
    recall_feedback: typeof raw.recall_feedback === "string" ? raw.recall_feedback : undefined,
    recall_input: typeof raw.recall_input === "string" ? raw.recall_input : undefined,
    sentence_draft: typeof raw.sentence_draft === "string" ? raw.sentence_draft : undefined,
  };
}
