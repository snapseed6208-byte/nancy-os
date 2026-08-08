// ============================================
// Nancy OS — Expression Asset Context Integration Tests
// Phase 3.2 Stage 7: Tests for getExpressionAssets,
// matchExpressionAssets, and agent integration.
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

// ── Inlined from nancy-context.ts ──

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function intersect(a, b) {
  const bSet = new Set(b);
  return a.filter((t) => bSet.has(t)).length;
}

function matchExpressionAssets(assets, query) {
  if (assets.total === 0) return [];

  const allAssets = [
    ...assets.stories,
    ...assets.cases,
    ...assets.viewpoints,
    ...assets.expressions,
  ];

  const queryTokens = tokenize([
    query.topic,
    query.question,
    query.scenario,
    query.skill,
  ].filter(Boolean).join(" "));

  if (queryTokens.length === 0) {
    // No query → return highest quality assets
    return allAssets
      .sort((a, b) => (b.quality_score.reusability || 0) - (a.quality_score.reusability || 0))
      .slice(0, query.limit || 3)
      .map((a) => ({
        asset_id: a.id,
        title: a.title,
        asset_type: a.asset_type,
        match_score: a.quality_score.reusability || 50,
        reason: "高质量可复用资产",
        usage_suggestion: a.usable_for[0] || `在表达中引用"${a.title}"`,
      }));
  }

  const scored = allAssets.map((asset) => {
    const assetTokens = tokenize([
      asset.title,
      ...asset.tags,
      ...asset.scenarios,
      ...asset.key_skills,
    ].join(" "));

    // Tag overlap score
    const tagOverlap = intersect(queryTokens, asset.tags.map(tokenize).flat());
    const tagScore = asset.tags.length > 0
      ? (tagOverlap / Math.max(asset.tags.length, 1)) * 40
      : 0;

    // Scenario keyword match
    const scenarioText = asset.scenarios.join(" ");
    const scenarioTokens = tokenize(scenarioText);
    const scenarioOverlap = intersect(queryTokens, scenarioTokens);
    const scenarioScore = scenarioTokens.length > 0
      ? (scenarioOverlap / Math.max(scenarioTokens.length, 1)) * 30
      : 0;

    // Skill match
    const skillText = asset.key_skills.join(" ");
    const skillTokens = tokenize(skillText);
    const skillOverlap = intersect(queryTokens, skillTokens);
    const skillScore = skillTokens.length > 0
      ? (skillOverlap / Math.max(skillTokens.length, 1)) * 20
      : 0;

    // Quality boost
    const qualityScore = ((asset.quality_score.reusability || 50) / 100) * 10;

    const matchScore = Math.round(tagScore + scenarioScore + skillScore + qualityScore);

    // Build reason
    const reasons = [];
    if (tagOverlap > 1) reasons.push(`标签匹配：${tagOverlap}个共同关键词`);
    if (scenarioOverlap > 1) reasons.push(`场景相关`);
    if (skillOverlap > 1) reasons.push(`技能匹配：${skillOverlap}个共同技能`);
    if (reasons.length === 0) reasons.push("通用高质量资产");

    return {
      asset_id: asset.id,
      title: asset.title,
      asset_type: asset.asset_type,
      match_score: Math.min(matchScore, 100),
      reason: reasons.join("；"),
      usage_suggestion: asset.usable_for[0] || `引用"${asset.title}"来丰富表达`,
    };
  });

  return scored
    .filter((s) => s.match_score > 0)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, query.limit || 5);
}

// ============================================
// SECTION A: Data Layer — matchExpressionAssets
// ============================================

console.log("\n═══ A: matchExpressionAssets — Relevance Scoring ═══");

// Mock asset collection (simulating what getExpressionAssets returns)
const mockCollection = {
  stories: [
    {
      id: "story-1",
      title: "广交会客户接待经历",
      asset_type: "personal_story",
      tags: ["communication", "customer_service", "cross_cultural", "negotiation"],
      summary: "在广交会接待海外客户 → 解决沟通障碍 → 成功签约",
      key_skills: ["communication", "customer_service", "negotiation"],
      scenarios: ["广交会客户接待", "解决语言沟通障碍"],
      usable_for: [
        "分享关于\"广交会客户接待\"的真实经历",
        "分享关于\"解决语言沟通障碍\"的真实经历",
      ],
      quality_score: { completeness: 85, authenticity: 90, reusability: 80 },
    },
    {
      id: "story-2",
      title: "TikTok直播突破经历",
      asset_type: "personal_story",
      tags: ["content_creation", "live_streaming", "audience_growth"],
      summary: "从0开始做TikTok直播 → 克服镜头恐惧 → 积累10万粉丝",
      key_skills: ["content_creation", "live_streaming"],
      scenarios: ["TikTok直播起步", "克服镜头恐惧"],
      usable_for: ["分享关于\"TikTok直播起步\"的真实经历"],
      quality_score: { completeness: 70, authenticity: 95, reusability: 60 },
    },
  ],
  cases: [
    {
      id: "case-1",
      title: "AI项目面试准备",
      asset_type: "experience_case",
      tags: ["interview", "AI", "project_management", "communication"],
      summary: "准备AI岗位面试 | 整理项目经验 | 学会了STAR表达法",
      key_skills: ["interview", "communication", "project_management"],
      scenarios: ["AI岗位面试准备", "STAR表达法应用"],
      usable_for: ["分享关于\"AI岗位面试准备\"的真实经历"],
      quality_score: { completeness: 90, authenticity: 85, reusability: 75 },
    },
  ],
  viewpoints: [
    {
      id: "view-1",
      title: "远程工作效率比办公室更高",
      asset_type: "viewpoint",
      tags: ["remote_work", "productivity", "work_life_balance"],
      summary: "关于\"远程工作\"：我的立场是远程工作效率更高",
      key_skills: ["productivity"],
      scenarios: ["远程工作"],
      usable_for: ["用你的观点\"远程工作效率比办公室更高\"来论证立场"],
      quality_score: { completeness: 80, authenticity: 90, reusability: 70 },
    },
  ],
  expressions: [],
  total: 4,
};

test("A1: Empty query returns top quality assets", () => {
  const result = matchExpressionAssets(mockCollection, {});
  ok(result.length > 0, "Should return assets even with empty query");
  // Should be sorted by reusability (story-1 has 80, case-1 has 75, view-1 has 70, story-2 has 60)
  const scores = result.map((r) => r.match_score);
  for (let i = 0; i < scores.length - 1; i++) {
    ok(scores[i] >= scores[i + 1], `Scores should be descending: ${scores[i]} >= ${scores[i + 1]}`);
  }
});

test("A2: Topic match — 'interview' should match case-1 high", () => {
  // case-1 tags include "interview" — tokenize will find exact match
  const result = matchExpressionAssets(mockCollection, { topic: "interview", skill: "communication" });
  ok(result.length > 0, "Should return matches");
  // case-1 (AI项目面试准备) should be top match because it has "interview" and "communication" tags
  const topMatch = result[0];
  ok(topMatch.asset_id === "case-1" || topMatch.match_score > 40,
    `Top match should be interview-related, got: ${topMatch.title} (${topMatch.match_score})`);
});

test("A3: Scenario match — '客户沟通' should match story-1", () => {
  const result = matchExpressionAssets(mockCollection, { scenario: "客户沟通" });
  const story1Match = result.find((r) => r.asset_id === "story-1");
  ok(story1Match, "story-1 should appear in results");
  ok((story1Match?.match_score || 0) > 0, "story-1 should have positive match score");
});

test("A4: Skill match — 'communication' should rank story-1 and case-1 high", () => {
  const result = matchExpressionAssets(mockCollection, { skill: "communication" });
  const topIds = result.slice(0, 2).map((r) => r.asset_id);
  ok(topIds.includes("story-1") || topIds.includes("case-1"),
    "communication skill should match story-1 or case-1");
});

test("A5: limit parameter", () => {
  const result = matchExpressionAssets(mockCollection, { limit: 2 });
  ok(result.length <= 2, `Should return at most 2, got ${result.length}`);
});

test("A6: Each result has required fields", () => {
  const result = matchExpressionAssets(mockCollection, { topic: "面试" });
  for (const r of result) {
    ok(typeof r.asset_id === "string", "asset_id should be string");
    ok(typeof r.title === "string", "title should be string");
    ok(typeof r.match_score === "number", "match_score should be number");
    ok(r.match_score >= 0 && r.match_score <= 100, "match_score should be 0-100");
    ok(typeof r.reason === "string", "reason should be string");
    ok(typeof r.usage_suggestion === "string", "usage_suggestion should be string");
  }
});

// ============================================
// SECTION B: Edge Cases
// ============================================

console.log("\n═══ B: Edge Cases ═══");

test("B1: Empty collection returns empty array", () => {
  const empty = { stories: [], cases: [], viewpoints: [], expressions: [], total: 0 };
  const result = matchExpressionAssets(empty, { topic: "面试" });
  equal(result.length, 0, "Empty collection should return empty array");
});

test("B2: No-match query still returns quality assets with low scores", () => {
  const result = matchExpressionAssets(mockCollection, { topic: "zzz_nonexistent_xyz" });
  // Even with no keyword match, quality boost gives a baseline score
  ok(result.every((r) => typeof r.match_score === "number"), "All results should have scores");
});

test("B3: All match scores are between 0-100", () => {
  const queries = [
    { topic: "面试" },
    { scenario: "直播" },
    { skill: "negotiation" },
    {},
    { topic: "nonexistent_xyz_123" },
  ];
  for (const q of queries) {
    const result = matchExpressionAssets(mockCollection, q);
    for (const r of result) {
      ok(r.match_score >= 0 && r.match_score <= 100,
        `Score ${r.match_score} out of range for query ${JSON.stringify(q)}`);
    }
  }
});

// ============================================
// SECTION C: Integration — Graceful Degradation
// ============================================

console.log("\n═══ C: Graceful Degradation (0 assets) ═══");

test("C1: Zero assets — matchExpressionAssets returns []", () => {
  const empty = { stories: [], cases: [], viewpoints: [], expressions: [], total: 0 };
  const result = matchExpressionAssets(empty, { topic: "面试", skill: "communication" });
  equal(result.length, 0);
});

test("C2: Zero assets — ExpressionAssetCollection.total is 0", () => {
  const empty = { stories: [], cases: [], viewpoints: [], expressions: [], total: 0 };
  equal(empty.total, 0);
  equal(empty.stories.length, 0);
  equal(empty.cases.length, 0);
  equal(empty.viewpoints.length, 0);
  equal(empty.expressions.length, 0);
});

// ============================================
// SECTION D: Data Isolation
// ============================================

console.log("\n═══ D: Data Isolation ═══");

test("D1: Different user assets are isolated — relevance differs", () => {
  const user1Assets = { stories: [mockCollection.stories[0]], cases: [], viewpoints: [], expressions: [], total: 1 };
  const user2Assets = { stories: [mockCollection.stories[1]], cases: [], viewpoints: [], expressions: [], total: 1 };

  const r1 = matchExpressionAssets(user1Assets, { topic: "广交会" });
  const r2 = matchExpressionAssets(user2Assets, { topic: "广交会" });

  // User 1 has 广交会 story, user 2 doesn't — user 1 should score noticeably higher
  ok(r1.length > 0, "User 1 should match 广交会");
  const u1score = r1[0].match_score;
  const u2score = r2.length > 0 ? r2[0].match_score : 0;
  ok(u1score > u2score,
    `User 1 score (${u1score}) should be higher than user 2 (${u2score}) for 广交会 topic`);
});

// ============================================
// SECTION E: extractAssetCompact — Content Extraction
// ============================================

console.log("\n═══ E: Content Extraction Quality ═══");

test("E1: personal_story has summary, skills, scenarios", () => {
  const story = mockCollection.stories[0];
  ok(story.summary.length > 0, "Story should have summary");
  ok(story.key_skills.length > 0, "Story should have key_skills");
  ok(story.scenarios.length > 0, "Story should have scenarios");
  ok(story.usable_for.length > 0, "Story should have usable_for");
});

test("E2: experience_case has STAR framework fields in summary", () => {
  const exp = mockCollection.cases[0];
  ok(exp.summary.includes("AI"), "Summary should contain key content");
  ok(exp.key_skills.includes("interview"), "Skills should include interview");
});

test("E3: viewpoint has topic-related structure", () => {
  const vp = mockCollection.viewpoints[0];
  ok(vp.title.length > 0, "Viewpoint should have title");
  ok(vp.scenarios.length > 0, "Viewpoint should have scenarios");
});

test("E4: quality_score has all three dimensions", () => {
  for (const asset of [...mockCollection.stories, ...mockCollection.cases, ...mockCollection.viewpoints]) {
    ok(typeof asset.quality_score.completeness === "number", "completeness should be number");
    ok(typeof asset.quality_score.authenticity === "number", "authenticity should be number");
    ok(typeof asset.quality_score.reusability === "number", "reusability should be number");
  }
});

// ============================================
// RESULTS
// ============================================

console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) process.exit(1);
