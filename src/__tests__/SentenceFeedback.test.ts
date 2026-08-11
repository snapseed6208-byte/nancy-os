// ============================================
// V3.6 Sentence Feedback Parser — Unit Tests
// (16 tests per PART 29 spec)
// ============================================

import { describe, it, expect } from "vitest";
import {
  parseSentenceFeedback,
  getFeedbackStatus,
  getBetterSentence,
} from "@/lib/english/sentenceFeedback";

// ── Test data ──

const naturalFeedbackObj = {
  grammar_correct: true,
  naturalness: "natural" as const,
  corrections: [] as Array<{ original: string; corrected: string; explanation: string }>,
  overall_feedback: "语法正确，表达也很自然。",
  expression_used_correctly: true,
  example_usage: "I always ask my friends how they're doing when we meet.",
};

const slightlyUnnaturalObj = {
  grammar_correct: true,
  naturalness: "slightly_unnatural" as const,
  corrections: [
    { original: "I ask them", corrected: "I asked them", explanation: "时态需要调整" },
  ],
  overall_feedback: "基本正确，但时态可以调整。",
  expression_used_correctly: true,
};

const incorrectObj = {
  grammar_correct: false,
  naturalness: "awkward" as const,
  corrections: [
    { original: "wrong", corrected: "right", explanation: "搭配不当" },
  ],
  overall_feedback: "表达有问题。",
  expression_used_correctly: false,
};

// ═══════════════════════════════════════
// Tests 1-4: Parsing different formats
// ═══════════════════════════════════════

describe("parseSentenceFeedback — format handling", () => {
  it("1. JSON object feedback — normal parsing", () => {
    const result = parseSentenceFeedback(naturalFeedbackObj);
    expect(result.status).toBe("natural");
    expect(result.statusLabel).toBe("表达自然");
    expect(result.grammarOk).toBe(true);
    expect(result.expressionUsedCorrectly).toBe(true);
    expect(result.overallFeedback).toBe("语法正确，表达也很自然。");
  });

  it("2. JSON string feedback — normal parsing", () => {
    const result = parseSentenceFeedback(JSON.stringify(naturalFeedbackObj));
    expect(result.status).toBe("natural");
    expect(result.statusLabel).toBe("表达自然");
    expect(result.grammarOk).toBe(true);
  });

  it("3. plain text feedback — fallback", () => {
    const result = parseSentenceFeedback("这是个不错的句子");
    expect(result.status).toBe("unknown");
    expect(result.statusLabel).toBe("历史反馈");
    expect(result.overallFeedback).toBe("这是个不错的句子");
    expect(result.corrections).toEqual([]);
    expect(result.hasDetailedFeedback).toBe(false);
  });

  it("4. malformed JSON — no crash", () => {
    const result = parseSentenceFeedback("{not valid json [[[");
    expect(result.status).toBe("unknown");
    expect(result.statusLabel).toBe("历史反馈");
    expect(result.overallFeedback).toBe("{not valid json [[[");
  });
});

// ═══════════════════════════════════════
// Tests 5-8: Status derivation
// ═══════════════════════════════════════

describe("parseSentenceFeedback — status derivation", () => {
  it("5. missing feedback → 暂无反馈", () => {
    const result = parseSentenceFeedback(null);
    expect(result.status).toBe("unknown");
    expect(result.statusLabel).toBe("暂无反馈");
    expect(result.grammarOk).toBeNull();
  });

  it("6. grammar_correct + natural → 表达自然", () => {
    const result = parseSentenceFeedback(naturalFeedbackObj);
    expect(result.status).toBe("natural");
    expect(result.statusLabel).toBe("表达自然");
    expect(result.statusIcon).toBe("check");
  });

  it("7. grammar_correct === false → 需要修改", () => {
    const result = parseSentenceFeedback(incorrectObj);
    expect(result.status).toBe("needs_work");
    expect(result.statusLabel).toBe("需要修改");
    expect(result.statusIcon).toBe("alert");
  });

  it("8. slightly_unnatural → 可以更自然", () => {
    const result = parseSentenceFeedback(slightlyUnnaturalObj);
    expect(result.status).toBe("acceptable");
    expect(result.statusLabel).toBe("可以更自然");
    expect(result.statusIcon).toBe("delta");
  });

  it("8b. awkward naturalness → 需要修改", () => {
    const result = parseSentenceFeedback({ grammar_correct: true, naturalness: "awkward" });
    expect(result.status).toBe("needs_work");
  });

  it("8c. expression_used_correctly === false → 需要修改", () => {
    const result = parseSentenceFeedback({
      grammar_correct: true,
      naturalness: "natural",
      expression_used_correctly: false,
    });
    expect(result.status).toBe("needs_work");
  });
});

// ═══════════════════════════════════════
// Tests 9-12: Corrections & better sentence
// ═══════════════════════════════════════

describe("parseSentenceFeedback — corrections & better version", () => {
  it("9. corrections has content → hasDetailedFeedback true", () => {
    const result = parseSentenceFeedback(slightlyUnnaturalObj);
    expect(result.hasDetailedFeedback).toBe(true);
    expect(result.corrections.length).toBe(1);
  });

  it("10. corrections empty → hasDetailedFeedback false", () => {
    const result = parseSentenceFeedback(naturalFeedbackObj);
    expect(result.hasDetailedFeedback).toBe(false);
    expect(result.corrections).toEqual([]);
  });

  it("11. example_usage → used as betterSentence when no corrections", () => {
    const result = parseSentenceFeedback(naturalFeedbackObj);
    expect(result.betterSentence).toBe(
      "I always ask my friends how they're doing when we meet.",
    );
  });

  it("12. corrections[0].corrected takes priority over example_usage", () => {
    const objWithBoth = {
      ...slightlyUnnaturalObj,
      example_usage: "Some other example.",
    };
    const result = parseSentenceFeedback(objWithBoth);
    // corrections[0].corrected should be used, not example_usage
    expect(result.betterSentence).toBe("I asked them");
  });
});

// ═══════════════════════════════════════
// Tests 13-16: Edge cases & convenience
// ═══════════════════════════════════════

describe("parseSentenceFeedback — edge cases", () => {
  it("13. empty string → 暂无反馈", () => {
    const result = parseSentenceFeedback("");
    expect(result.status).toBe("unknown");
    expect(result.overallFeedback).toBeNull();
  });

  it("14. undefined → 暂无反馈", () => {
    const result = parseSentenceFeedback(undefined);
    expect(result.statusLabel).toBe("暂无反馈");
    expect(result.betterSentence).toBeNull();
  });

  it("15. legacy object missing fields → handles gracefully", () => {
    const legacy = { old_field: "some value" };
    const result = parseSentenceFeedback(legacy);
    // Should not crash
    expect(result.status).toBe("unknown");
    expect(result.grammarOk).toBeNull();
    expect(result.corrections).toEqual([]);
  });

  it("16. getFeedbackStatus convenience works", () => {
    expect(getFeedbackStatus(naturalFeedbackObj)).toBe("natural");
    expect(getFeedbackStatus(incorrectObj)).toBe("needs_work");
    expect(getFeedbackStatus(null)).toBe("unknown");
  });

  it("17. getBetterSentence convenience works", () => {
    expect(getBetterSentence(naturalFeedbackObj)).toBeTruthy();
    expect(getBetterSentence(null)).toBeNull();
  });

  it("18. corrections with non-standard entries are filtered", () => {
    const mixed = {
      grammar_correct: true,
      naturalness: "natural" as const,
      corrections: [
        { explanation: "valid" },
        { original: "test", corrected: "fixed" },  // no explanation → filtered
        "just a string",  // not an object → filtered
      ],
    };
    const result = parseSentenceFeedback(mixed);
    // Only the one with explanation survives
    expect(result.corrections.length).toBe(1);
    expect(result.hasDetailedFeedback).toBe(true);
  });
});
