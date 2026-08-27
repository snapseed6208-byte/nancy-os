export interface DuePoolCandidate {
  userId: string;
  archived: boolean;
  status: string;
  nextReviewDate: string | null;
}

/** Pure mirror of the canonical database selector, used for policy tests. */
export function isDuePoolCandidate(
  expression: DuePoolCandidate,
  userId: string,
  shanghaiDateKey: string,
): boolean {
  return expression.userId === userId
    && !expression.archived
    && expression.nextReviewDate !== null
    && expression.nextReviewDate <= shanghaiDateKey;
}
