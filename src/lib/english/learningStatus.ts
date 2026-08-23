export interface ExpressionLearningState {
  status?: string | null;
}

/** Canonical expression-level meaning of "learned" used by Learn and Connections. */
export function isExpressionLearned(expression: ExpressionLearningState | null | undefined): boolean {
  return expression?.status === "review" || expression?.status === "mastered";
}

