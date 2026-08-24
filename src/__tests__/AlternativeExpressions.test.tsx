import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import AlternativeExpressionsField from "@/components/english/AlternativeExpressionsField";
import AlternativeExpressionsList from "@/components/english/AlternativeExpressionsList";
import { normalizeAlternativeExpressions } from "@/lib/english/alternativeExpressions";

afterEach(cleanup);

describe("Alternative Expressions", () => {
  it("keeps two valid alternatives", () => {
    expect(normalizeAlternativeExpressions([
      { expression: "work with", difference: "更中性。" },
      { expression: "work closely with", difference: "更强调紧密合作。" },
    ])).toHaveLength(2);
  });

  it("allows zero alternatives", () => {
    expect(normalizeAlternativeExpressions([])).toEqual([]);
  });

  it("falls back to an empty array when the field is missing", () => {
    expect(normalizeAlternativeExpressions(undefined)).toEqual([]);
  });

  it("drops a malformed item without dropping the expression enrichment", () => {
    expect(normalizeAlternativeExpressions([
      { expression: "", difference: "invalid" },
      { expression: "work with", difference: "更中性。" },
    ])).toEqual([{ expression: "work with", difference: "更中性。" }]);
  });

  it("caps AI output at two alternatives", () => {
    expect(normalizeAlternativeExpressions([
      { expression: "one", difference: "1" },
      { expression: "two", difference: "2" },
      { expression: "three", difference: "3" },
    ])).toHaveLength(2);
  });

  it("lets the audit UI edit an alternative", () => {
    const onChange = vi.fn();
    render(<AlternativeExpressionsField value={[{ expression: "work with", difference: "更中性。" }]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("替换表达 1"), { target: { value: "collaborate with" } });
    expect(onChange).toHaveBeenCalledWith([{ expression: "collaborate with", difference: "更中性。" }]);
  });

  it("lets the audit UI delete an alternative", () => {
    const onChange = vi.fn();
    render(<AlternativeExpressionsField value={[{ expression: "work with", difference: "更中性。" }]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("删除替换 1"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("lets the audit UI add an alternative", () => {
    const onChange = vi.fn();
    render(<AlternativeExpressionsField value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "添加替换" }));
    expect(onChange).toHaveBeenCalledWith([{ expression: "", difference: "" }]);
  });

  it("displays saved alternatives in Detail/Learn presentation", () => {
    render(<AlternativeExpressionsList alternatives={[{ expression: "work with", difference: "更中性。" }]} />);
    expect(screen.getByText("work with")).toBeTruthy();
    expect(screen.getByText("更中性。")).toBeTruthy();
  });

  it("shows legacy synonyms only when structured alternatives are empty", () => {
    render(<AlternativeExpressionsList alternatives={[]} legacySynonyms="work with, collaborate with" />);
    expect(screen.getByText(/近义词：work with, collaborate with/)).toBeTruthy();
  });

  it("import prompt requests optional alternatives", () => {
    const source = readFileSync("supabase/functions/expression-import-agent/index.ts", "utf8");
    expect(source).toContain('"alternative_expressions"');
    expect(source).toContain("Use [] when none adds learning value");
  });

  it("import persistence saves the structured field", () => {
    const source = readFileSync("src/lib/hooks/useEnglish.ts", "utf8");
    expect(source).toContain("alternative_expressions: normalizeAlternativeExpressions(expr.alternative_expressions)");
  });

  it("Detail reads saved alternatives without Connections AI", () => {
    const source = readFileSync("src/pages/EnglishExpressionDetail.tsx", "utf8");
    expect(source).toContain("existing.alternative_expressions");
    expect(source).not.toContain("useExpressionConnections");
    expect(source).not.toContain("generate_expression_connections");
  });

  it("Learn Stage 2 reads saved alternatives without Connections AI", () => {
    const source = readFileSync("src/pages/EnglishLearn.tsx", "utf8");
    expect(source).toContain("material.alternativeExpressions");
    expect(source).not.toContain("useExpressionConnections");
    expect(source).not.toContain("generate_expression_connections");
  });

  it("SRS no longer requests dynamic Connections", () => {
    const source = readFileSync("src/pages/EnglishReviewV3.tsx", "utf8");
    expect(source).not.toContain("useExpressionConnections");
    expect(source).not.toContain("ExpressionConnectionsPanel");
  });

  it("104 preserves migration history and retires the deployed cache", () => {
    const migration = readFileSync("supabase/migrations/104_alternative_expressions.sql", "utf8");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS alternative_expressions JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(migration).toContain("DROP TABLE IF EXISTS public.expression_connection_cache");
  });
});
