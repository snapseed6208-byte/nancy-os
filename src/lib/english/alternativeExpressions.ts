export interface AlternativeExpression {
  expression: string;
  difference: string;
}

export const MAX_ALTERNATIVE_EXPRESSIONS = 2;

export function normalizeAlternativeExpressions(value: unknown): AlternativeExpression[] {
  if (!Array.isArray(value)) return [];

  const normalized: AlternativeExpression[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const expression = typeof record.expression === "string" ? record.expression.trim() : "";
    const difference = typeof record.difference === "string" ? record.difference.trim() : "";
    if (!expression || !difference) continue;
    normalized.push({ expression, difference });
    if (normalized.length === MAX_ALTERNATIVE_EXPRESSIONS) break;
  }
  return normalized;
}
