export interface ImportedAlternativeExpression {
  expression: string;
  difference: string;
}

export interface AlternativeNormalizationResult {
  alternatives: ImportedAlternativeExpression[];
  fieldMissing: boolean;
  malformedItems: number;
}

export interface AlternativeExtractionStats {
  total_expressions: number;
  with_alternatives: number;
  without_alternatives: number;
  missing_fields: number;
  malformed_items: number;
  raw_contains_field: boolean;
}

export function buildAlternativeExtractionStats(input: {
  totalExpressions: number;
  withAlternatives: number;
  missingFields: number;
  malformedItems: number;
  rawContainsField: boolean;
}): AlternativeExtractionStats {
  return {
    total_expressions: input.totalExpressions,
    with_alternatives: input.withAlternatives,
    without_alternatives: Math.max(0, input.totalExpressions - input.withAlternatives),
    missing_fields: input.missingFields,
    malformed_items: input.malformedItems,
    raw_contains_field: input.rawContainsField,
  };
}

export function normalizeImportedAlternatives(value: unknown): AlternativeNormalizationResult {
  if (value === undefined) {
    return { alternatives: [], fieldMissing: true, malformedItems: 0 };
  }
  if (!Array.isArray(value)) {
    return { alternatives: [], fieldMissing: false, malformedItems: 1 };
  }

  const alternatives: ImportedAlternativeExpression[] = [];
  let malformedItems = 0;
  for (const item of value) {
    if (!item || typeof item !== "object") {
      malformedItems++;
      continue;
    }
    const record = item as Record<string, unknown>;
    const expression = typeof record.expression === "string" ? record.expression.trim() : "";
    const difference = typeof record.difference === "string" ? record.difference.trim() : "";
    if (!expression || !difference) {
      malformedItems++;
      continue;
    }
    alternatives.push({ expression, difference });
    if (alternatives.length === 2) break;
  }

  return { alternatives, fieldMissing: false, malformedItems };
}
