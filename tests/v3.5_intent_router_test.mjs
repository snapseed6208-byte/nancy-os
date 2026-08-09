// ============================================
// Nancy OS — Phase 3.5 Stage 2: Intent Router Tests
// Tests for detectUserIntent() keyword-based classifier.
// ============================================

import { equal, ok, notEqual } from "node:assert/strict";

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
// Inlined Intent Router (mirrors nancy-context.ts)
// ═══════════════════════════════════════

const INTENT_RULES = [
  {
    intent: "interview",
    keywords: [
      { word: "面试", weight: 3 }, { word: "interview", weight: 3 },
      { word: "简历", weight: 2 }, { word: "求职", weight: 2 },
      { word: "自我介绍", weight: 3 }, { word: "职业规划", weight: 2 },
    ],
    phrases: [
      { phrase: "面试问题", weight: 4 }, { phrase: "模拟面试", weight: 5 },
      { phrase: "自我介绍", weight: 4 }, { phrase: "job interview", weight: 5 },
    ],
    subTypes: [
      { word: "自我介绍", subType: "self_intro" },
      { word: "行为面试", subType: "behavioral" },
      { word: "technical", subType: "technical" },
    ],
    suggestedAgent: "chinese-expression-agent",
  },
  {
    intent: "speaking_practice",
    keywords: [
      { word: "表达", weight: 2 }, { word: "演讲", weight: 2 },
      { word: "口语", weight: 2 }, { word: "一分钟", weight: 2 },
      { word: "中文表达", weight: 3 }, { word: "speaking", weight: 1 },
    ],
    phrases: [
      { phrase: "中文表达训练", weight: 5 }, { phrase: "一分钟表达", weight: 5 },
      { phrase: "练习表达", weight: 4 }, { phrase: "表达训练", weight: 5 },
    ],
    subTypes: [
      { word: "观点", subType: "opinion" }, { word: "经历", subType: "experience" },
      { word: "故事", subType: "story" }, { word: "面试", subType: "interview" },
    ],
    suggestedAgent: "chinese-expression-agent",
  },
  {
    intent: "english_learning",
    keywords: [
      { word: "英语", weight: 3 }, { word: "english", weight: 3 },
      { word: "单词", weight: 2 }, { word: "翻译", weight: 2 },
      { word: "vocabulary", weight: 2 }, { word: "grammar", weight: 2 },
    ],
    phrases: [
      { phrase: "英语学习", weight: 5 }, { phrase: "用英语说", weight: 5 },
      { phrase: "english learning", weight: 5 }, { phrase: "英语怎么说", weight: 5 },
    ],
    subTypes: [
      { word: "口语", subType: "speaking" }, { word: "单词", subType: "vocabulary" },
      { word: "翻译", subType: "translation" },
    ],
    suggestedAgent: "english-coach",
  },
  {
    intent: "reflection",
    keywords: [
      { word: "反思", weight: 3 }, { word: "回顾", weight: 2 },
      { word: "复盘", weight: 3 }, { word: "reflect", weight: 2 },
      { word: "journal", weight: 2 }, { word: "心情", weight: 1 },
    ],
    phrases: [
      { phrase: "本周总结", weight: 5 }, { phrase: "帮我反思", weight: 5 },
      { phrase: "回顾这一周", weight: 5 }, { phrase: "今天过得", weight: 4 },
    ],
    subTypes: [
      { word: "今天", subType: "daily" }, { word: "本周", subType: "weekly" },
      { word: "daily", subType: "daily" }, { word: "weekly", subType: "weekly" },
    ],
    suggestedAgent: "reflection-agent",
  },
  {
    intent: "planning",
    keywords: [
      { word: "计划", weight: 3 }, { word: "任务", weight: 2 },
      { word: "目标", weight: 2 }, { word: "规划", weight: 3 },
      { word: "plan", weight: 2 }, { word: "task", weight: 2 },
    ],
    phrases: [
      { phrase: "帮我规划", weight: 5 }, { phrase: "任务拆解", weight: 5 },
      { phrase: "制定计划", weight: 5 }, { phrase: "下一步做什么", weight: 4 },
    ],
    subTypes: [
      { word: "拆解", subType: "task_breakdown" },
      { word: "目标", subType: "goal_setting" },
    ],
    suggestedAgent: "task-breakdown-agent",
  },
  {
    intent: "knowledge_import",
    keywords: [
      { word: "导入", weight: 3 }, { word: "文章", weight: 2 },
      { word: "读书", weight: 2 }, { word: "import", weight: 2 },
      { word: "article", weight: 2 }, { word: "链接", weight: 1 },
    ],
    phrases: [
      { phrase: "帮我分析这篇文章", weight: 5 }, { phrase: "导入材料", weight: 5 },
      { phrase: "提取关键信息", weight: 5 }, { phrase: "这篇文章讲了什么", weight: 4 },
    ],
    subTypes: [
      { word: "文章", subType: "article" }, { word: "视频", subType: "video" },
    ],
    suggestedAgent: "resource-extract",
  },
  {
    intent: "health",
    keywords: [
      { word: "健康", weight: 3 }, { word: "运动", weight: 2 },
      { word: "饮食", weight: 2 }, { word: "减肥", weight: 2 },
      { word: "health", weight: 2 }, { word: "diet", weight: 2 },
    ],
    phrases: [
      { phrase: "健康管理", weight: 4 }, { phrase: "饮食建议", weight: 4 },
      { phrase: "运动计划", weight: 4 },
    ],
    subTypes: [
      { word: "饮食", subType: "diet" }, { word: "运动", subType: "exercise" },
    ],
    suggestedAgent: "health-coach-agent",
  },
];

const ALL_INTENTS = INTENT_RULES.map((r) => r.intent);

function detectUserIntent(text) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return {
      intent: "general", confidence: 1.0, subType: "",
      suggestedAgent: "chinese-expression-agent",
      allIntents: [{ intent: "general", confidence: 1.0 }],
    };
  }

  const lower = text.toLowerCase();
  const scores = new Map();
  const subTypeScores = new Map();

  for (const rule of INTENT_RULES) {
    let score = 0;
    const subMap = new Map();

    for (const kw of rule.keywords) {
      const lowerKw = kw.word.toLowerCase();
      let count = 0, pos = -1;
      while ((pos = lower.indexOf(lowerKw, pos + 1)) !== -1) count++;
      if (count > 0) score += kw.weight * Math.min(count, 3);
    }

    for (const ph of rule.phrases) {
      if (lower.includes(ph.phrase.toLowerCase())) {
        score += ph.weight;
      }
    }

    for (const st of rule.subTypes) {
      if (lower.includes(st.word.toLowerCase())) {
        subMap.set(st.subType, (subMap.get(st.subType) || 0) + 1);
      }
    }

    if (score > 0) {
      scores.set(rule.intent, score);
      subTypeScores.set(rule.intent, subMap);
    }
  }

  if (scores.size === 0) {
    return {
      intent: "general", confidence: 0.8, subType: "",
      suggestedAgent: "chinese-expression-agent",
      allIntents: [{ intent: "general", confidence: 0.8 }],
    };
  }

  const maxPossible = 35;
  const allIntents = [];
  for (const [intent, rawScore] of scores) {
    allIntents.push({
      intent,
      confidence: Math.min(1, Math.round((rawScore / maxPossible) * 100) / 100),
    });
  }
  allIntents.sort((a, b) => b.confidence - a.confidence);

  const top = allIntents[0];
  const topRule = INTENT_RULES.find((r) => r.intent === top.intent);
  const topSubMap = subTypeScores.get(top.intent);
  let subType = "";
  if (topSubMap && topSubMap.size > 0) {
    subType = [...topSubMap.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  return {
    intent: top.intent,
    confidence: top.confidence,
    subType,
    suggestedAgent: topRule.suggestedAgent,
    allIntents,
  };
}

// ═══════════════════════════════════════
// Section A: Core Intent Detection
// ═══════════════════════════════════════

console.log("\n── A: Core Intent Detection ──");

test("A1: Detects speaking_practice from Chinese expression query", () => {
  const result = detectUserIntent("帮我练习一分钟口语表达");
  equal(result.intent, "speaking_practice");
  ok(result.confidence >= 0.1);
});

test("A2: Detects english_learning from English query", () => {
  const result = detectUserIntent("我想提高英语口语能力");
  equal(result.intent, "english_learning");
  equal(result.suggestedAgent, "english-coach");
});

test("A3: Detects reflection from weekly review", () => {
  const result = detectUserIntent("帮我回顾这一周的进展和收获");
  equal(result.intent, "reflection");
  equal(result.suggestedAgent, "reflection-agent");
});

test("A4: Detects planning from task breakdown request", () => {
  const result = detectUserIntent("帮我规划明天的任务安排");
  equal(result.intent, "planning");
  equal(result.suggestedAgent, "task-breakdown-agent");
});

test("A5: Detects interview from interview prep query", () => {
  const result = detectUserIntent("模拟面试：请做一下自我介绍");
  equal(result.intent, "interview");
  equal(result.suggestedAgent, "chinese-expression-agent");
});

test("A6: Detects knowledge_import from article analysis request", () => {
  const result = detectUserIntent("帮我分析这篇文章的核心观点");
  equal(result.intent, "knowledge_import");
});

test("A7: Detects health from diet query", () => {
  const result = detectUserIntent("今天我想记录一下饮食和运动情况");
  equal(result.intent, "health");
});

// ═══════════════════════════════════════
// Section B: Sub-Type Detection
// ═══════════════════════════════════════

console.log("\n── B: Sub-Type Detection ──");

test("B1: Detects 'opinion' sub-type for speaking_practice", () => {
  const result = detectUserIntent("我想练习表达自己的观点和立场");
  equal(result.intent, "speaking_practice");
  equal(result.subType, "opinion");
});

test("B2: Detects 'daily' sub-type for reflection", () => {
  const result = detectUserIntent("帮我反思一下今天的经历");
  equal(result.intent, "reflection");
  equal(result.subType, "daily");
});

test("B3: Detects 'weekly' sub-type for reflection", () => {
  const result = detectUserIntent("本周总结一下我的学习进展");
  equal(result.intent, "reflection");
  equal(result.subType, "weekly");
});

test("B4: Detects 'task_breakdown' sub-type for planning", () => {
  const result = detectUserIntent("帮我把这个任务拆解成小步骤");
  equal(result.intent, "planning");
  equal(result.subType, "task_breakdown");
});

test("B5: Detects 'speaking' sub-type for english_learning", () => {
  const result = detectUserIntent("我想练习英语口语发音");
  equal(result.intent, "english_learning");
  equal(result.subType, "speaking");
});

// ═══════════════════════════════════════
// Section C: Phrase Match Priority
// ═══════════════════════════════════════

console.log("\n── C: Phrase Match Priority ──");

test("C1: Exact phrase '一分钟表达' strongly signals speaking_practice", () => {
  const result = detectUserIntent("我想做一分钟表达训练，话题是环保");
  equal(result.intent, "speaking_practice");
  ok(result.confidence >= 0.2, `confidence ${result.confidence} should be >= 0.2`);
});

test("C2: Exact phrase '任务拆解' strongly signals planning", () => {
  const result = detectUserIntent("任务拆解：帮我分解这个项目");
  equal(result.intent, "planning");
});

test("C3: Exact English phrase routes correctly", () => {
  const result = detectUserIntent("I want to improve my english learning and speaking skills");
  equal(result.intent, "english_learning");
});

// ═══════════════════════════════════════
// Section D: Edge Cases & Graceful Degradation
// ═══════════════════════════════════════

console.log("\n── D: Edge Cases ──");

test("D1: Empty string returns general", () => {
  const result = detectUserIntent("");
  equal(result.intent, "general");
  equal(result.confidence, 1.0);
});

test("D2: Null/undefined returns general", () => {
  const r1 = detectUserIntent(null);
  equal(r1.intent, "general");
  const r2 = detectUserIntent(undefined);
  equal(r2.intent, "general");
});

test("D3: Unrecognizable text returns general", () => {
  const result = detectUserIntent("asdfghjkl qwerty");
  equal(result.intent, "general");
});

test("D4: Very short text works without error", () => {
  const result = detectUserIntent("嗨");
  equal(result.intent, "general");
});

test("D5: Multi-intent text picks highest confidence", () => {
  const result = detectUserIntent("帮我反思这一周的表达训练进展");
  // Both "反思" and "表达" appear, but which scores higher?
  ok(result.intent === "reflection" || result.intent === "speaking_practice");
  ok(result.allIntents.length >= 1);
});

test("D6: allIntents contains multiple intents for mixed query", () => {
  const result = detectUserIntent("帮我总结这周的英语学习成果并规划下周的计划");
  ok(result.allIntents.length >= 2, `expected >= 2, got ${result.allIntents.length}`);
});

// ═══════════════════════════════════════
// Section E: Agent Routing
// ═══════════════════════════════════════

console.log("\n── E: Agent Routing ──");

test("E1: speaking_practice → chinese-expression-agent", () => {
  const result = detectUserIntent("中文表达训练");
  equal(result.suggestedAgent, "chinese-expression-agent");
});

test("E2: english_learning → english-coach", () => {
  const result = detectUserIntent("英语学习");
  equal(result.suggestedAgent, "english-coach");
});

test("E3: reflection → reflection-agent", () => {
  const result = detectUserIntent("帮我反思");
  equal(result.suggestedAgent, "reflection-agent");
});

test("E4: planning → task-breakdown-agent", () => {
  const result = detectUserIntent("制定计划");
  equal(result.suggestedAgent, "task-breakdown-agent");
});

test("E5: knowledge_import → resource-extract", () => {
  const result = detectUserIntent("导入材料");
  equal(result.suggestedAgent, "resource-extract");
});

test("E6: health → health-coach-agent", () => {
  const result = detectUserIntent("健康管理");
  equal(result.suggestedAgent, "health-coach-agent");
});

// ═══════════════════════════════════════
// Section F: Return Shape
// ═══════════════════════════════════════

console.log("\n── F: Return Shape ──");

test("F1: Return has all required fields", () => {
  const result = detectUserIntent("帮我练习表达");
  ok("intent" in result);
  ok("confidence" in result);
  ok("subType" in result);
  ok("suggestedAgent" in result);
  ok("allIntents" in result);
  ok(Array.isArray(result.allIntents));
});

test("F2: Confidence is between 0 and 1", () => {
  const result = detectUserIntent("帮我练习一分钟中文表达训练");
  ok(result.confidence >= 0 && result.confidence <= 1, `confidence: ${result.confidence}`);
});

test("F3: allIntents sorted by confidence descending", () => {
  const result = detectUserIntent("帮我反思并规划明天的任务和英语学习计划");
  for (let i = 1; i < result.allIntents.length; i++) {
    ok(result.allIntents[i - 1].confidence >= result.allIntents[i].confidence,
      `${result.allIntents[i - 1].intent}(${result.allIntents[i - 1].confidence}) should be >= ${result.allIntents[i].intent}(${result.allIntents[i].confidence})`);
  }
});

// ═══════════════════════════════════════
// Results
// ═══════════════════════════════════════

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed > 0) {
  console.log("\n✗ SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("✓ ALL TESTS PASSED\n");
}
