import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  EXPRESSION_CONNECTIONS_PROMPT_VERSION,
  enrichAndRankConnections,
  fingerprintCandidates,
  isConnectionCacheValid,
  retrieveExpressionCandidates,
  scoreExpressionCandidate,
  selectLearnConnections,
  selectReviewConnections,
  validateAndGroundAIConnections,
  type CachedExpressionConnection,
  type ExpressionConnectionRow,
  type RankedCandidate,
} from "@/lib/english/expressionConnections";
import { isExpressionLearned } from "@/lib/english/learningStatus";
import {
  resolveExpressionConnections,
  type ExpressionConnectionsDependencies,
} from "@/lib/english/expressionConnectionsService";

function row(overrides: Partial<ExpressionConnectionRow> = {}): ExpressionConnectionRow {
  return {
    id: "source",
    user_id: "user-1",
    english: "work alongside",
    chinese: "与某人并肩工作",
    english_explanation: "work together on the same task",
    usage_note: "emphasizes active side-by-side participation",
    native_usage: null,
    context: "teamwork collaboration",
    situation: "work project",
    common_patterns: "work alongside someone",
    common_mistakes: null,
    synonyms: "work with, collaborate with",
    scene: "work",
    topic: "collaboration",
    type: "chunk",
    formality: "neutral",
    category_id: "cat-work",
    status: "learning",
    learned_at: null,
    archived: false,
    updated_at: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

function candidate(overrides: Partial<ExpressionConnectionRow> = {}): ExpressionConnectionRow {
  return row({
    id: "candidate-1",
    english: "work with",
    chinese: "与某人一起工作",
    usage_note: "a neutral general expression",
    synonyms: null,
    status: "review",
    learned_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
    ...overrides,
  });
}

function ranked(rowValue = candidate(), candidateKey = "c1", semanticScore = 50): RankedCandidate {
  return { row: rowValue, candidateKey, semanticScore };
}

function aiResponse(candidateKey = "c1") {
  return {
    connections: [{
      candidate_key: candidateKey,
      relation: "very_close",
      difference: "work with 更中性；work alongside 更强调双方参与同一项工作。",
      register: "neutral",
      interchangeability: "usually",
      reason: "都表达共同工作。",
      learned: true,
    }],
    external_suggestions: [],
  };
}

describe("Expression Connections retrieval and grounding", () => {
  it("1. excludes the source expression", () => {
    expect(retrieveExpressionCandidates(row(), [row()])).toEqual([]);
  });

  it("2. excludes a normalized duplicate of the source", () => {
    expect(retrieveExpressionCandidates(row(), [candidate({ english: " Work-alongside " })])).toEqual([]);
  });

  it("3. gives an explicit synonyms match the highest signal", () => {
    expect(scoreExpressionCandidate(row(), candidate())).toBeGreaterThan(90);
  });

  it("4. filters an unrelated candidate even when type matches", () => {
    const unrelated = candidate({
      id: "unrelated",
      english: "boil the kettle",
      chinese: "烧水",
      category_id: "cat-home",
      scene: "daily life",
      topic: "cooking",
      context: "kitchen",
      situation: "breakfast",
      english_explanation: "heat water",
      usage_note: "used for making tea",
      formality: "spoken",
    });
    expect(retrieveExpressionCandidates(row({ synonyms: null }), [unrelated])).toEqual([]);
  });

  it("5. caps candidate retrieval at 30", () => {
    const library = Array.from({ length: 35 }, (_, index) => candidate({ id: `c-${index}`, english: `work with team ${index}` }));
    expect(retrieveExpressionCandidates(row(), library)).toHaveLength(30);
  });

  it("6. drops a fake candidate_key returned by AI", () => {
    expect(validateAndGroundAIConnections(aiResponse("fake-key"), [ranked()], [candidate()])).toEqual([]);
  });

  it("7. ignores AI learned claims and derives learned state from the DB", () => {
    const stored = validateAndGroundAIConnections(aiResponse(), [ranked()], [candidate({ status: "collected" })]);
    expect(enrichAndRankConnections(stored, [candidate({ status: "collected" })])[0].learned).toBe(false);
  });

  it("8. uses review/mastered as the canonical learned states", () => {
    expect(isExpressionLearned({ status: "review" })).toBe(true);
    expect(isExpressionLearned({ status: "mastered" })).toBe(true);
    expect(isExpressionLearned({ status: "learning" })).toBe(false);
  });

  it("9. ranks a learned similar expression before a comparable unlearned one", () => {
    const cached: CachedExpressionConnection[] = [
      { expression: "collaborate with", relation: "similar", difference: "正式。", register: "formal", interchangeability: "sometimes" },
      { expression: "work with", relation: "similar", difference: "中性。", register: "neutral", interchangeability: "sometimes" },
    ];
    const library = [
      candidate({ id: "new", english: "collaborate with", status: "collected", learned_at: null }),
      candidate({ id: "learned", english: "work with", status: "review" }),
    ];
    expect(enrichAndRankConnections(cached, library)[0].expression_id).toBe("learned");
  });

  it("10. re-grounds an external suggestion that already exists in the library", () => {
    const raw = {
      connections: [],
      external_suggestions: [{ expression: "work with", relation: "similar", difference: "更中性。", register: "neutral", interchangeability: "sometimes", reason: "与某人一起工作" }],
    };
    const grounded = validateAndGroundAIConnections(raw, [], [candidate()]);
    expect(enrichAndRankConnections(grounded, [candidate()])[0]).toMatchObject({ expression_id: "candidate-1", learned: true });
  });

  it("11. allows zero high-quality connections", () => {
    expect(validateAndGroundAIConnections({ connections: [], external_suggestions: [] }, [], [])).toEqual([]);
  });

  it("12. rejects malformed AI JSON gracefully", () => {
    expect(() => validateAndGroundAIConnections({ connections: "bad" }, [], [])).toThrow(/missing arrays/);
  });

  it("13. enforces at most five total and two external suggestions", () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ranked(candidate({ id: `id-${index}`, english: `work option ${index}` }), `c${index + 1}`));
    const raw = {
      connections: candidates.map(({ candidateKey }) => ({ ...aiResponse(candidateKey).connections[0], candidate_key: candidateKey })),
      external_suggestions: Array.from({ length: 4 }, (_, index) => ({ expression: `external ${index}`, relation: "similar", difference: "有细微区别。", register: "neutral", interchangeability: "sometimes", reason: "外部表达" })),
    };
    expect(validateAndGroundAIConnections(raw, candidates, candidates.map((item) => item.row))).toHaveLength(5);
  });

  it("13b. carries a grounded Chinese meaning for an external explicit add", () => {
    const raw = {
      connections: [],
      external_suggestions: [{ expression: "collaborate with", relation: "similar", difference: "更正式。", register: "formal", interchangeability: "sometimes", reason: "与某人协作" }],
    };
    const enriched = enrichAndRankConnections(validateAndGroundAIConnections(raw, [], []), []);
    expect(enriched[0]).toMatchObject({ learned: false, expression_id: null, chinese_meaning: "与某人协作" });
  });
});

describe("Expression Connections cache", () => {
  it("14. fingerprints the same candidate set deterministically", async () => {
    const a = [ranked(candidate({ id: "a" }), "c1"), ranked(candidate({ id: "b" }), "c2")];
    expect(await fingerprintCandidates(a)).toBe(await fingerprintCandidates([...a].reverse()));
  });

  it("15. changes fingerprint when a candidate field changes", async () => {
    const before = await fingerprintCandidates([ranked()]);
    const after = await fingerprintCandidates([ranked(candidate({ usage_note: "changed" }))]);
    expect(after).not.toBe(before);
  });

  it("16. invalidates cache when source expression changes", () => {
    const cache = { source_updated_at: "old", candidate_fingerprint: "fp", prompt_version: EXPRESSION_CONNECTIONS_PROMPT_VERSION, expires_at: null, connections: [] };
    expect(isConnectionCacheValid(cache, "new", "fp")).toBe(false);
  });

  it("17. invalidates cache when candidate fingerprint changes", () => {
    const cache = { source_updated_at: "same", candidate_fingerprint: "old", prompt_version: EXPRESSION_CONNECTIONS_PROMPT_VERSION, expires_at: null, connections: [] };
    expect(isConnectionCacheValid(cache, "same", "new")).toBe(false);
  });

  it("18. invalidates cache when prompt version changes", () => {
    const cache = { source_updated_at: "same", candidate_fingerprint: "fp", prompt_version: "old", expires_at: null, connections: [] };
    expect(isConnectionCacheValid(cache, "same", "fp")).toBe(false);
  });

  it("19. invalidates an expired cache", () => {
    const cache = { source_updated_at: "same", candidate_fingerprint: "fp", prompt_version: EXPRESSION_CONNECTIONS_PROMPT_VERSION, expires_at: "2026-01-01T00:00:00.000Z", connections: [] };
    expect(isConnectionCacheValid(cache, "same", "fp", EXPRESSION_CONNECTIONS_PROMPT_VERSION, new Date("2026-08-24"))).toBe(false);
  });

  it("20. cache hit avoids the AI request and cache write", async () => {
    const source = row();
    const library = [source, candidate()];
    const candidates = retrieveExpressionCandidates(source, library);
    const fingerprint = await fingerprintCandidates(candidates);
    const requestAI = vi.fn();
    const writeCache = vi.fn();
    const dependencies = {
      loadSourceAndLibrary: vi.fn().mockResolvedValue({ source, library }),
      readCache: vi.fn().mockResolvedValue({
        source_updated_at: source.updated_at,
        candidate_fingerprint: fingerprint,
        prompt_version: EXPRESSION_CONNECTIONS_PROMPT_VERSION,
        expires_at: null,
        connections: [{ expression: "work with", relation: "very_close", difference: "更中性。", register: "neutral", interchangeability: "usually" }],
      }),
      requestAI,
      writeCache,
    } as unknown as ExpressionConnectionsDependencies;
    const result = await resolveExpressionConnections(source.id, source.user_id, dependencies);
    expect(result.cacheHit).toBe(true);
    expect(requestAI).not.toHaveBeenCalled();
    expect(writeCache).not.toHaveBeenCalled();
  });
});

describe("Expression Connections product integration contracts", () => {
  it("21. Learn displays at most two learned plus one very-close external connection", () => {
    const connections = enrichAndRankConnections([
      { expression: "work with", relation: "similar", difference: "中性。", register: "neutral", interchangeability: "sometimes" },
      { expression: "work closely with", relation: "similar", difference: "更密切。", register: "neutral", interchangeability: "sometimes" },
      { expression: "collaborate with", relation: "very_close", difference: "更正式。", register: "formal", interchangeability: "sometimes" },
      { expression: "team up with", relation: "related", difference: "更口语。", register: "spoken", interchangeability: "rarely" },
    ], [candidate({ id: "a", english: "work with" }), candidate({ id: "b", english: "work closely with" })]);
    expect(selectLearnConnections(connections)).toHaveLength(3);
    expect(selectLearnConnections(connections).filter((item) => item.learned)).toHaveLength(2);
  });

  it("22. SRS feedback caps related expressions at two", () => {
    const items = enrichAndRankConnections(Array.from({ length: 4 }, (_, index) => ({
      expression: `option ${index}`, relation: "similar" as const, difference: "区别。", register: "neutral" as const, interchangeability: "sometimes" as const,
    })), []);
    expect(selectReviewConnections(items)).toHaveLength(2);
  });

  it("23. Cloze requests connections only after an answer is revealed", () => {
    const source = readFileSync("src/pages/EnglishReviewV3.tsx", "utf8");
    expect(source).toContain("useExpressionConnections(item.expressionId, finalResult !== null)");
  });

  it("24. Sentence requests connections only after evaluation reaches feedback", () => {
    const source = readFileSync("src/pages/EnglishReviewV3.tsx", "utf8");
    expect(source).toContain('useExpressionConnections(item.expressionId, step === "feedback")');
  });

  it("25. Recall remains free of a Connections query", () => {
    const source = readFileSync("src/pages/EnglishReviewV3.tsx", "utf8");
    const recallSection = source.slice(source.indexOf("function RecallCard"), source.indexOf("function ClozeCard"));
    expect(recallSection).not.toContain("useExpressionConnections");
  });

  it("26. external suggestions never insert expressions inside the service", () => {
    const source = readFileSync("src/lib/english/expressionConnectionsService.ts", "utf8");
    expect(source).not.toContain('.from("expressions").insert');
  });

  it("27. Detail uses the canonical create-expression mutation for explicit add", () => {
    const source = readFileSync("src/pages/EnglishExpressionDetail.tsx", "utf8");
    expect(source).toContain("await createExpr.mutateAsync");
    expect(source).toContain("findExistingExpressionByText");
  });

  it("28. synonyms remain retrieval-only and are never overwritten", () => {
    const service = readFileSync("src/lib/english/expressionConnectionsService.ts", "utf8");
    const migration = readFileSync("supabase/migrations/103_expression_connection_cache.sql", "utf8");
    expect(service).toContain('"synonyms"');
    expect(service).not.toContain("update({ synonyms");
    expect(migration).not.toContain("ALTER TABLE public.expressions");
  });

  it("29. mobile connection rows wrap long expressions without horizontal scrolling", () => {
    const source = readFileSync("src/components/english/ExpressionConnectionsPanel.tsx", "utf8");
    expect(source).toContain("min-w-0");
    expect(source).toContain("break-words");
    expect(source).not.toContain("overflow-x-auto");
  });

  it("30. connection failures remain an enrichment-only retry state", () => {
    const panel = readFileSync("src/components/english/ExpressionConnectionsPanel.tsx", "utf8");
    expect(panel).toContain("相关表达暂时无法加载");
    expect(panel).toContain("onRetry");
  });
});
