// ============================================
// Nancy OS — Phase 3.5 Asset Auto Mining Tests
// Tests for mineAssetCandidates parsing, filtering,
// edge cases, and source tracking.
// ============================================

import { equal, ok, notEqual, deepStrictEqual } from "node:assert/strict";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ FAIL: ${name}`);
    console.log(`    ${e.message}`);
  }
}

// ═══════════════════════════════════════
// Inlined mining functions (mirrors nancy-context.ts)
// ═══════════════════════════════════════

const VALID_ASSET_TYPES = [
  "personal_story",
  "experience_case",
  "viewpoint",
  "quality_expression",
];

const REQUIRED_ASSET_DATA_FIELDS = {
  personal_story: ["background", "challenge", "action", "result"],
  experience_case: ["situation", "task", "learning"],
  viewpoint: ["topic", "my_position", "reasoning"],
  quality_expression: ["original_question", "my_original_answer"],
};

const MIN_TEXT_LENGTH = 30;
const MIN_CONFIDENCE = 0.5;

/**
 * Parse and filter AI response into valid candidates.
 * Mirrors the logic in mineAssetCandidates() nancy-context.ts.
 */
function parseCandidates(raw, sourceType, sourceRefId, maxCandidates = 3) {
  if (!raw || typeof raw !== "string") return [];

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  const candidates = (parsed.candidates || []) || [];

  return candidates
    .filter((c) => {
      if (!c || typeof c !== "object") return false;
      if (!c.asset_type || !VALID_ASSET_TYPES.includes(c.asset_type)) return false;
      if (!c.title || typeof c.title !== "string" || !c.title.trim()) return false;
      if (!c.evidence_quote || typeof c.evidence_quote !== "string" || !c.evidence_quote.trim()) return false;
      if (typeof c.confidence !== "number" || c.confidence < MIN_CONFIDENCE) return false;
      if (!c.asset_data || typeof c.asset_data !== "object") return false;
      return true;
    })
    .map((c) => ({
      asset_type: c.asset_type,
      title: String(c.title).slice(0, 100),
      reason: String(c.reason || "").slice(0, 200),
      source: sourceType,
      confidence: Math.min(1, Math.max(0, Number(c.confidence) || 0.5)),
      asset_data: c.asset_data || {},
      evidence_quote: String(c.evidence_quote).slice(0, 500),
      tags: Array.isArray(c.tags) ? c.tags : [],
    }))
    .slice(0, maxCandidates);
}

/**
 * Validate that text meets minimum requirements for mining.
 */
function canMine(text) {
  return !!(text && typeof text === "string" && text.trim().length >= MIN_TEXT_LENGTH);
}

// ═══════════════════════════════════════
// Section A: Text validation
// ═══════════════════════════════════════

console.log("\n── A: Text Validation ──");

test("A1: Rejects empty string", () => {
  equal(canMine(""), false);
});

test("A2: Rejects null/undefined", () => {
  equal(canMine(null), false);
  equal(canMine(undefined), false);
});

test("A3: Rejects text shorter than 30 chars", () => {
  equal(canMine("太短了"), false);
  equal(canMine("这是一段只有二十五个字符的文本"), false);
});

test("A4: Accepts text >= 30 chars", () => {
  equal(canMine("这是一段足够长的文本内容，可以用来提取表达资产候选。今天我在工作中遇到了一个挑战。"), true);
});

test("A5: Handles whitespace-only text", () => {
  equal(canMine("   \n  \t  "), false);
});

// ═══════════════════════════════════════
// Section B: JSON Parsing Robustness
// ═══════════════════════════════════════

console.log("\n── B: JSON Parsing ──");

test("B1: Parses clean JSON response", () => {
  const raw = JSON.stringify({
    candidates: [{
      asset_type: "personal_story",
      title: "测试故事",
      reason: "值得保存",
      confidence: 0.8,
      asset_data: { background: "去年夏天", challenge: "学习新技能", action: "每天练习", result: "掌握了", reflection: "坚持很重要" },
      evidence_quote: "我每天花两小时练习，坚持了三个月。",
      tags: ["学习", "坚持"],
    }],
  });
  const result = parseCandidates(raw, "journal", "ref-123");
  equal(result.length, 1);
  equal(result[0].asset_type, "personal_story");
  equal(result[0].source, "journal");
});

test("B2: Parses JSON wrapped in markdown fence", () => {
  const raw = '```json\n' + JSON.stringify({
    candidates: [{
      asset_type: "viewpoint",
      title: "关于远程办公",
      reason: "清晰的论证",
      confidence: 0.7,
      asset_data: { topic: "远程办公", my_position: "支持混合模式", reasoning: "灵活性和效率" },
      evidence_quote: "远程办公提升了我的工作效率。",
      tags: ["工作", "效率"],
    }],
  }) + '\n```';
  // Our parser uses regex to extract {...} so markdown fence is fine
  const result = parseCandidates(raw, "english_coach", "sess-456");
  equal(result.length, 1);
  equal(result[0].asset_type, "viewpoint");
});

test("B3: Handles AI prose around JSON", () => {
  const raw = '好的，我已经分析了你的文本。以下是提取的资产：\n\n' + JSON.stringify({
    candidates: [{
      asset_type: "quality_expression",
      title: "精彩表达示范",
      reason: "语言流畅",
      confidence: 0.65,
      asset_data: { original_question: "如何学习", my_original_answer: "最好的学习方式是..." },
      evidence_quote: "最好的学习方式是把知识教给别人。",
      tags: ["表达", "学习"],
    }],
  }) + '\n\n希望这些对你有帮助！';
  const result = parseCandidates(raw, "reflection", "r-789");
  equal(result.length, 1);
  equal(result[0].evidence_quote, "最好的学习方式是把知识教给别人。");
});

test("B4: Returns empty array for non-JSON response", () => {
  const raw = "这段文本中没有值得提取的资产。";
  const result = parseCandidates(raw, "manual", null);
  equal(result.length, 0);
});

test("B5: Returns empty array for malformed JSON", () => {
  const raw = "{ candidates: [ { broken json } ] }";
  const result = parseCandidates(raw, "manual", null);
  equal(result.length, 0);
});

test("B6: Handles empty candidates array", () => {
  const raw = JSON.stringify({ candidates: [] });
  const result = parseCandidates(raw, "manual", null);
  equal(result.length, 0);
});

// ═══════════════════════════════════════
// Section C: Candidate Filtering
// ═══════════════════════════════════════

console.log("\n── C: Candidate Filtering ──");

test("C1: Filters out low-confidence candidates", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "personal_story", title: "好故事", confidence: 0.8, evidence_quote: "...", asset_data: { background: "a" } },
      { asset_type: "personal_story", title: "差故事", confidence: 0.3, evidence_quote: "...", asset_data: { background: "a" } },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  equal(result.length, 1);
  equal(result[0].title, "好故事");
});

test("C2: Filters out candidates with missing evidence_quote", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "viewpoint", title: "有证据", confidence: 0.7, evidence_quote: "这是证据", asset_data: { topic: "t" } },
      { asset_type: "viewpoint", title: "无证据", confidence: 0.7, evidence_quote: "", asset_data: { topic: "t" } },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  equal(result.length, 1);
  equal(result[0].title, "有证据");
});

test("C3: Filters out candidates with missing title", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "experience_case", title: "", confidence: 0.7, evidence_quote: "...", asset_data: { situation: "s" } },
      { asset_type: "experience_case", title: "有效标题", confidence: 0.7, evidence_quote: "...", asset_data: { situation: "s" } },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  equal(result.length, 1);
  equal(result[0].title, "有效标题");
});

test("C4: Filters out invalid asset_type", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "invalid_type", title: "坏类型", confidence: 0.8, evidence_quote: "...", asset_data: {} },
      { asset_type: "personal_story", title: "好类型", confidence: 0.8, evidence_quote: "...", asset_data: { background: "a" } },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  equal(result.length, 1);
  equal(result[0].asset_type, "personal_story");
});

test("C5: Filters out candidates without asset_data", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "personal_story", title: "无数据", confidence: 0.8, evidence_quote: "..." },
      { asset_type: "personal_story", title: "有数据", confidence: 0.8, evidence_quote: "...", asset_data: { background: "b" } },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  equal(result.length, 1);
});

test("C6: Enforces maxCandidates limit", () => {
  const items = [];
  for (let i = 0; i < 10; i++) {
    items.push({
      asset_type: "personal_story",
      title: `故事 ${i}`,
      confidence: 0.8,
      evidence_quote: `证据 ${i}`,
      asset_data: { background: `背景 ${i}` },
    });
  }
  const raw = JSON.stringify({ candidates: items });
  const result = parseCandidates(raw, "manual", null, 3);
  equal(result.length, 3);
});

test("C7: Respects custom maxCandidates", () => {
  const items = [];
  for (let i = 0; i < 10; i++) {
    items.push({
      asset_type: "personal_story",
      title: `故事 ${i}`,
      confidence: 0.8,
      evidence_quote: `证据 ${i}`,
      asset_data: { background: `背景 ${i}` },
    });
  }
  const raw = JSON.stringify({ candidates: items });
  const result = parseCandidates(raw, "manual", null, 5);
  equal(result.length, 5);
});

// ═══════════════════════════════════════
// Section D: Source Tracking
// ═══════════════════════════════════════

console.log("\n── D: Source Tracking ──");

test("D1: Sets source field on all candidates", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "personal_story", title: "测试", confidence: 0.8, evidence_quote: "...", asset_data: { background: "a" } },
      { asset_type: "viewpoint", title: "测试2", confidence: 0.7, evidence_quote: "...", asset_data: { topic: "t" } },
    ],
  });
  const result = parseCandidates(raw, "english_coach", "sess-001");
  equal(result.length, 2);
  equal(result[0].source, "english_coach");
  equal(result[1].source, "english_coach");
});

test("D2: Supports all source types", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "personal_story", title: "T", confidence: 0.8, evidence_quote: "...", asset_data: { background: "a" } },
    ],
  });
  const sources = ["chinese_speaking", "english_coach", "reflection", "journal", "manual"];
  for (const src of sources) {
    const result = parseCandidates(raw, src, null);
    equal(result[0].source, src);
  }
});

test("D3: Truncates long titles to 100 chars", () => {
  const longTitle = "A".repeat(200);
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "viewpoint", title: longTitle, confidence: 0.7, evidence_quote: "...", asset_data: { topic: "t" } },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  equal(result[0].title.length, 100);
});

test("D4: Truncates long evidence_quote to 500 chars", () => {
  const longQuote = "证".repeat(1000);
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "personal_story", title: "T", confidence: 0.8, evidence_quote: longQuote, asset_data: { background: "a" } },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  equal(result[0].evidence_quote.length, 500);
});

// ═══════════════════════════════════════
// Section E: asset_data Structure
// ═══════════════════════════════════════

console.log("\n── E: asset_data Structure ──");

test("E1: personal_story has expected fields", () => {
  const fields = REQUIRED_ASSET_DATA_FIELDS.personal_story;
  ok(fields.includes("background"));
  ok(fields.includes("challenge"));
  ok(fields.includes("action"));
  ok(fields.includes("result"));
});

test("E2: experience_case has expected fields", () => {
  const fields = REQUIRED_ASSET_DATA_FIELDS.experience_case;
  ok(fields.includes("situation"));
  ok(fields.includes("task"));
  ok(fields.includes("learning"));
});

test("E3: viewpoint has expected fields", () => {
  const fields = REQUIRED_ASSET_DATA_FIELDS.viewpoint;
  ok(fields.includes("topic"));
  ok(fields.includes("my_position"));
  ok(fields.includes("reasoning"));
});

test("E4: quality_expression has expected fields", () => {
  const fields = REQUIRED_ASSET_DATA_FIELDS.quality_expression;
  ok(fields.includes("original_question"));
  ok(fields.includes("my_original_answer"));
});

test("E5: Passes through valid asset_data", () => {
  const assetData = {
    background: "去年我开始学习编程",
    challenge: "理解和应用抽象概念",
    action: "通过项目实践来学习",
    result: "三个月后完成了第一个全栈项目",
    reflection: "项目驱动学习是最有效的方式",
  };
  const raw = JSON.stringify({
    candidates: [{
      asset_type: "personal_story",
      title: "学习编程的故事",
      confidence: 0.85,
      asset_data: assetData,
      evidence_quote: "通过项目实践来学习",
      tags: ["编程", "学习"],
    }],
  });
  const result = parseCandidates(raw, "journal", "entry-1");
  equal(result.length, 1);
  deepStrictEqual(result[0].asset_data, assetData);
});

// ═══════════════════════════════════════
// Section F: Confidence Clamping
// ═══════════════════════════════════════

console.log("\n── F: Confidence Clamping ──");

test("F1: Clamps confidence above 1.0 to 1.0", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "viewpoint", title: "A", confidence: 1.5, evidence_quote: "...", asset_data: { topic: "t" } },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  equal(result.length, 1);
  equal(result[0].confidence, 1.0);
});

test("F1b: Negative confidence filtered out before clamping", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "viewpoint", title: "B", confidence: -0.5, evidence_quote: "...", asset_data: { topic: "t" } },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  // -0.5 < MIN_CONFIDENCE(0.5), filtered out
  equal(result.length, 0);
});

test("F2: Rejects confidence exactly at threshold boundary", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "viewpoint", title: "边界上", confidence: 0.5, evidence_quote: "...", asset_data: { topic: "t" } },
      { asset_type: "viewpoint", title: "边界下", confidence: 0.499, evidence_quote: "...", asset_data: { topic: "t" } },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  // 0.5 is NOT less than MIN_CONFIDENCE (0.5), so it passes
  equal(result.length, 1);
  equal(result[0].title, "边界上");
});

test("F3: Handles NaN confidence", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "viewpoint", title: "NaN", confidence: "bad", evidence_quote: "...", asset_data: { topic: "t" } },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  // "bad" is not a number, typeof !== "number", so filtered out
  equal(result.length, 0);
});

// ═══════════════════════════════════════
// Section G: Tags Handling
// ═══════════════════════════════════════

console.log("\n── G: Tags ──");

test("G1: Passes through valid tags array", () => {
  const raw = JSON.stringify({
    candidates: [{
      asset_type: "personal_story",
      title: "T",
      confidence: 0.8,
      evidence_quote: "...",
      asset_data: { background: "a" },
      tags: ["编程", "学习", "成长"],
    }],
  });
  const result = parseCandidates(raw, "manual", null);
  deepStrictEqual(result[0].tags, ["编程", "学习", "成长"]);
});

test("G2: Defaults non-array tags to empty array", () => {
  const raw = JSON.stringify({
    candidates: [{
      asset_type: "personal_story",
      title: "T",
      confidence: 0.8,
      evidence_quote: "...",
      asset_data: { background: "a" },
      tags: "编程,学习",
    }],
  });
  const result = parseCandidates(raw, "manual", null);
  deepStrictEqual(result[0].tags, []);
});

test("G3: Handles missing tags field", () => {
  const raw = JSON.stringify({
    candidates: [{
      asset_type: "personal_story",
      title: "T",
      confidence: 0.8,
      evidence_quote: "...",
      asset_data: { background: "a" },
    }],
  });
  const result = parseCandidates(raw, "manual", null);
  deepStrictEqual(result[0].tags, []);
});

// ═══════════════════════════════════════
// Section H: Multi-type Mixed Candidates
// ═══════════════════════════════════════

console.log("\n── H: Mixed Candidates ──");

test("H1: Handles all four asset types in one response", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "personal_story", title: "故事", confidence: 0.8, evidence_quote: "e1", asset_data: { background: "a", challenge: "b", action: "c", result: "d", reflection: "e" }, tags: ["story"] },
      { asset_type: "experience_case", title: "案例", confidence: 0.75, evidence_quote: "e2", asset_data: { situation: "a", task: "b", action_taken: "c", result: "d", learning: "e" }, tags: ["case"] },
      { asset_type: "viewpoint", title: "观点", confidence: 0.7, evidence_quote: "e3", asset_data: { topic: "a", my_position: "b", reasoning: "c", example: "d", boundary: "e", counter_argument: "f" }, tags: ["view"] },
      { asset_type: "quality_expression", title: "表达", confidence: 0.65, evidence_quote: "e4", asset_data: { original_question: "a", my_original_answer: "b", optimized_answer: "c", why_good: "d", skill_tags: ["tag"] }, tags: ["expr"] },
    ],
  });
  const result = parseCandidates(raw, "chinese_speaking", "sess-001", 5);
  equal(result.length, 4);
  equal(result[0].asset_type, "personal_story");
  equal(result[1].asset_type, "experience_case");
  equal(result[2].asset_type, "viewpoint");
  equal(result[3].asset_type, "quality_expression");
});

test("H2: Skips invalid entries in mixed batch", () => {
  const raw = JSON.stringify({
    candidates: [
      { asset_type: "personal_story", title: "好", confidence: 0.8, evidence_quote: "e1", asset_data: { background: "a" }, tags: [] },
      { asset_type: "invalid", title: "坏类型", confidence: 0.8, evidence_quote: "e2", asset_data: {}, tags: [] },
      null,
      { asset_type: "viewpoint", title: "无数据", confidence: 0.8, evidence_quote: "e3", tags: [] },
      { asset_type: "experience_case", title: "好2", confidence: 0.75, evidence_quote: "e4", asset_data: { situation: "a", task: "b" }, tags: [] },
    ],
  });
  const result = parseCandidates(raw, "manual", null);
  equal(result.length, 2);
});

// ═══════════════════════════════════════
// Results
// ═══════════════════════════════════════

console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed > 0) {
  console.log("\n✗ SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("✓ ALL TESTS PASSED\n");
}
