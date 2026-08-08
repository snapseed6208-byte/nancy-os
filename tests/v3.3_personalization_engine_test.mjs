// ============================================
// Nancy OS — Phase 3.3 Dynamic Personalization Engine Tests
// Tests for getNancyPersonalProfile and
// buildNancyPersonalProfileContext.
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
// Mock data simulating what the DB returns
// ═══════════════════════════════════════

function makeMockProfile(overrides = {}) {
  return {
    id: "user-1",
    display_name: "Nancy",
    life_theme: "表达力提升",
    bio: "一个正在成长的年轻人",
    career_field: "AI产品",
    industry: "科技",
    current_milestone: "提升中文表达",
    preferences: { focus_area: "沟通表达", learning_goal: "流利表达" },
    ...overrides,
  };
}

function makeMockExpressionProfile(overrides = {}) {
  return {
    id: "ep-1",
    user_id: "user-1",
    strengths: { relevance: 78, structure: 72, evidence: 65 },
    weaknesses: { boundary: 42, fluency: 48, depth: 55 },
    patterns: {
      preferred_types: { opinion: 12, experience: 5, concept: 3 },
      total_sessions: 20,
      avg_score: 72,
    },
    improvement_history: [
      { date: "2026-08-01", before_score: 65, after_score: 78, area: "evidence" },
    ],
    knowledge_transfer_profile: {},
    asset_stats: { total: 5, by_type: { personal_story: 3, viewpoint: 2 } },
    ...overrides,
  };
}

function makeMockAssets(count = 5) {
  const base = [
    { id: "a1", title: "广交会客户接待经历", asset_type: "personal_story", tags: ["communication", "negotiation", "customer_service"], quality_score: { completeness: 85, authenticity: 90, reusability: 80 }, asset_data: {} },
    { id: "a2", title: "TikTok直播突破经历", asset_type: "personal_story", tags: ["content_creation", "live_streaming"], quality_score: { completeness: 70, authenticity: 95, reusability: 60 }, asset_data: {} },
    { id: "a3", title: "AI项目面试准备", asset_type: "experience_case", tags: ["interview", "AI", "communication"], quality_score: { completeness: 90, authenticity: 85, reusability: 75 }, asset_data: {} },
    { id: "a4", title: "远程工作效率更高", asset_type: "viewpoint", tags: ["remote_work", "productivity"], quality_score: { completeness: 80, authenticity: 90, reusability: 70 }, asset_data: {} },
    { id: "a5", title: "Python学习心得", asset_type: "quality_expression", tags: ["python", "learning", "coding"], quality_score: { completeness: 75, authenticity: 80, reusability: 55 }, asset_data: {} },
  ];
  return base.slice(0, count);
}

function makeMockMemories(count = 10) {
  const all = [
    { memory_type: "personality", content: "内向但善于深度交流", confidence: 0.9, status: "confirmed" },
    { memory_type: "preference", content: "偏爱结构化表达而非即兴发挥", confidence: 0.85, status: "confirmed" },
    { memory_type: "preference", content: "喜欢在早晨进行创造性工作", confidence: 0.8, status: "confirmed" },
    { memory_type: "habit", content: "每周至少练习中文表达3次", confidence: 0.75, status: "confirmed" },
    { memory_type: "habit", content: "周一精力最好, 下午容易分心", confidence: 0.7, status: "confirmed" },
    { memory_type: "skill", content: "沟通能力（多次广交会实战）", confidence: 0.88, status: "confirmed" },
    { memory_type: "skill", content: "项目管理和面试准备", confidence: 0.75, status: "confirmed" },
    { memory_type: "insight", content: "职业方向倾向于AI产品管理", confidence: 0.7, status: "confirmed" },
    { memory_type: "insight", content: "通过刻意练习表达力有明显提升", confidence: 0.65, status: "probable" },
    { memory_type: "preference", content: "更信任基于真实经历的建议而非通用模板", confidence: 0.9, status: "confirmed" },
  ];
  return all.slice(0, count);
}

function mockEmptyCollection() {
  return { profile: null, exprProfile: null, assets: [], memories: [] };
}

// ═══════════════════════════════════════
// Simulated getNancyPersonalProfile logic
// (inlined for testing — mirrors nancy-context.ts)
// ═══════════════════════════════════════

function buildNancyPersonalProfile(profile, exprProfile, assets, memories) {
  const hasRealData = !!(profile || exprProfile || assets.length > 0 || memories.length > 0);

  const identity = {
    display_name: profile?.display_name || "",
    life_theme: profile?.life_theme || "",
    bio_summary: profile?.bio || "",
    career_field: profile?.career_field || "",
    industry: profile?.industry || "",
    current_milestone: profile?.current_milestone || "",
  };

  const careerMemories = memories
    .filter((m) => m.memory_type === "insight" || m.memory_type === "skill")
    .filter((m) => /职业|工作|行业|career|方向|发展|专业/.test(String(m.content)))
    .map((m) => String(m.content));
  const careerParts = [];
  if (identity.career_field) careerParts.push(identity.career_field);
  if (identity.industry) careerParts.push(`(${identity.industry}行业)`);
  if (careerMemories.length > 0) careerParts.push(careerMemories[0]);
  const career_direction = careerParts.length > 0
    ? careerParts.join(" ")
    : "尚未明确职业方向";

  const goals = [];
  if (identity.current_milestone) goals.push(identity.current_milestone);
  if (identity.life_theme) goals.push(`生活主题：${identity.life_theme}`);
  const goalMemories = memories
    .filter((m) => /目标|计划|想|希望|goal|milestone|aspire/i.test(String(m.content)))
    .slice(0, 3)
    .map((m) => String(m.content));
  goals.push(...goalMemories);
  if (profile?.preferences && typeof profile.preferences === "object") {
    const prefs = profile.preferences;
    if (prefs.focus_area) goals.push(`专注领域：${prefs.focus_area}`);
    if (prefs.learning_goal) goals.push(`学习目标：${prefs.learning_goal}`);
  }

  const strengths = [];
  if (exprProfile?.strengths && typeof exprProfile.strengths === "object") {
    const s = exprProfile.strengths;
    for (const [dim, val] of Object.entries(s)) {
      const score = typeof val === "number" ? val : 0;
      if (score >= 70) strengths.push(`${dim}（${score}分）`);
    }
  }
  const skillStrengths = memories
    .filter((m) => m.memory_type === "skill" && (m.confidence) >= 0.7)
    .map((m) => String(m.content));
  strengths.push(...skillStrengths.slice(0, 5));
  const assetSkills = new Map();
  for (const a of assets) {
    const tags = (a.tags || []);
    for (const t of tags) {
      if (t.length > 1) assetSkills.set(t, (assetSkills.get(t) || 0) + 1);
    }
  }
  const topAssetSkills = [...assetSkills.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([skill, count]) => `${skill}（${count}条素材）`);
  strengths.push(...topAssetSkills);

  const weaknesses = [];
  if (exprProfile?.weaknesses && typeof exprProfile.weaknesses === "object") {
    const w = exprProfile.weaknesses;
    for (const [dim, val] of Object.entries(w)) {
      const score = typeof val === "number" ? val : 0;
      const label = score < 50 ? `${dim}（${score}分 — 薄弱）` : `${dim}（${score}分 — 待提升）`;
      weaknesses.push(label);
    }
  }

  const valuable_assets = assets
    .map((a) => {
      const qs = (a.quality_score || {});
      return {
        title: String(a.title || ""),
        asset_type: String(a.asset_type || ""),
        quality_score: qs.reusability || 0,
      };
    })
    .filter((a) => a.title)
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, 8);

  const learning_patterns = [];
  if (exprProfile?.patterns && typeof exprProfile.patterns === "object") {
    const p = exprProfile.patterns;
    if (p.preferred_types) {
      const pt = p.preferred_types;
      const top = Object.entries(pt).sort(([, a], [, b]) => b - a).slice(0, 3);
      learning_patterns.push(`偏好表达类型：${top.map(([t, c]) => `${t}(${c}次)`).join("、")}`);
    }
    if (typeof p.total_sessions === "number") {
      learning_patterns.push(`累计训练${p.total_sessions}次`);
    }
    if (typeof p.avg_score === "number") {
      learning_patterns.push(`平均得分${p.avg_score}分`);
    }
  }
  const habitPatterns = memories
    .filter((m) => m.memory_type === "habit")
    .slice(0, 3)
    .map((m) => String(m.content));
  learning_patterns.push(...habitPatterns);

  const personalityMemories = memories
    .filter((m) => m.memory_type === "personality")
    .slice(0, 5)
    .map((m) => String(m.content));
  const preferenceMemories = memories
    .filter((m) => m.memory_type === "preference")
    .filter((m) => /沟通|表达|交流|说话|写作|演讲|communication|speaking/i.test(String(m.content)))
    .slice(0, 3)
    .map((m) => String(m.content));
  const styleClues = [...personalityMemories, ...preferenceMemories];
  const communication_style = styleClues.length > 0
    ? styleClues.join("；")
    : "尚未建立沟通风格画像";

  return {
    identity,
    career_direction,
    current_goals: goals.length > 0 ? goals : ["尚未明确当前目标"],
    strengths: strengths.length > 0 ? strengths : ["尚未积累足够的优势数据"],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["尚未识别明确的薄弱领域"],
    valuable_assets,
    learning_patterns: learning_patterns.length > 0 ? learning_patterns : ["尚未形成明确的学习模式"],
    communication_style,
    has_real_data: hasRealData && (memories.length > 0 || assets.length > 0 || !!exprProfile),
  };
}

// ═══════════════════════════════════════
// SECTION A: Full Profile Aggregation
// ═══════════════════════════════════════

console.log("\n═══ A: Full Profile Aggregation ═══");

test("A1: Full profile with all data sources", () => {
  const profile = makeMockProfile();
  const exprProfile = makeMockExpressionProfile();
  const assets = makeMockAssets(5);
  const memories = makeMockMemories(10);
  const result = buildNancyPersonalProfile(profile, exprProfile, assets, memories);

  // Identity
  equal(result.identity.display_name, "Nancy");
  equal(result.identity.life_theme, "表达力提升");
  equal(result.identity.career_field, "AI产品");
  equal(result.identity.current_milestone, "提升中文表达");

  // Has real data
  ok(result.has_real_data, "Should have real data");

  // Career direction includes career field
  ok(result.career_direction.includes("AI产品"), `Career direction should include AI产品, got: ${result.career_direction}`);

  // Goals
  ok(result.current_goals.some((g) => g.includes("提升中文表达")), "Goals should include current milestone");
  ok(result.current_goals.some((g) => g.includes("专注领域")), "Goals should include focus_area");

  // Strengths
  ok(result.strengths.length > 0, "Should have strengths");
  ok(result.strengths.some((s) => s.includes("relevance")), "Should include relevance strength");

  // Weaknesses
  ok(result.weaknesses.length > 0, "Should have weaknesses");
  ok(result.weaknesses.some((w) => w.includes("boundary")), "Should include boundary weakness");
  ok(result.weaknesses.some((w) => w.includes("薄弱")), "Low-scoring weakness should be labeled 薄弱");

  // Valuable assets
  ok(result.valuable_assets.length > 0, "Should have valuable assets");
  // Sorted by reusability desc
  for (let i = 0; i < result.valuable_assets.length - 1; i++) {
    ok(result.valuable_assets[i].quality_score >= result.valuable_assets[i + 1].quality_score,
      "Assets should be sorted by quality_score desc");
  }

  // Learning patterns
  ok(result.learning_patterns.length > 0, "Should have learning patterns");
  ok(result.learning_patterns.some((p) => p.includes("累计训练")), "Should include total_sessions");

  // Communication style
  ok(result.communication_style.length > 0, "Should have communication style");
  ok(result.communication_style.includes("内向但善于深度交流"), "Should include personality memory");
});

test("A2: Profile with only profile table (no expression data)", () => {
  const profile = makeMockProfile();
  const result = buildNancyPersonalProfile(profile, null, [], []);

  equal(result.identity.display_name, "Nancy");
  ok(result.career_direction.includes("AI产品"), "Career should use profile fields");
  ok(result.current_goals.some((g) => g.includes("提升中文表达")), "Should include milestone as goal");
  equal(result.strengths[0], "尚未积累足够的优势数据");
  equal(result.weaknesses[0], "尚未识别明确的薄弱领域");
  equal(result.valuable_assets.length, 0);
  equal(result.has_real_data, false, "profile-only should not count as real data");
});

test("A3: Asset skills appear in strengths when count >= 2", () => {
  const assets = [
    { id: "a1", title: "T1", asset_type: "personal_story", tags: ["communication", "negotiation"], quality_score: { completeness: 80, authenticity: 80, reusability: 80 }, asset_data: {} },
    { id: "a2", title: "T2", asset_type: "experience_case", tags: ["communication", "AI"], quality_score: { completeness: 80, authenticity: 80, reusability: 80 }, asset_data: {} },
  ];
  const result = buildNancyPersonalProfile(null, null, assets, []);

  const commStrength = result.strengths.find((s) => s.includes("communication"));
  ok(commStrength, "communication should appear as strength (count=2)");
  ok(commStrength.includes("2条素材"), "Should show asset count");
});

test("A4: Skill memories with high confidence appear in strengths", () => {
  const memories = [
    { memory_type: "skill", content: "沟通能力（多次广交会实战）", confidence: 0.88, status: "confirmed" },
    { memory_type: "skill", content: "Python入门", confidence: 0.4, status: "candidate" },
  ];
  const result = buildNancyPersonalProfile(null, null, [], memories);

  ok(result.strengths.some((s) => s.includes("广交会")), "High-confidence skill should appear");
  ok(!result.strengths.some((s) => s.includes("Python")), "Low-confidence skill should not appear");
});

test("A5: Communication style aggregates personality + expression preferences", () => {
  const memories = [
    { memory_type: "personality", content: "内向但善于深度交流", confidence: 0.9, status: "confirmed" },
    { memory_type: "preference", content: "偏爱结构化表达而非即兴发挥", confidence: 0.85, status: "confirmed" },
    { memory_type: "preference", content: "喜欢在早晨进行创造性工作", confidence: 0.8, status: "confirmed" },
  ];
  const result = buildNancyPersonalProfile(null, null, [], memories);

  ok(result.communication_style.includes("内向但善于深度交流"), "Should include personality");
  ok(result.communication_style.includes("结构化表达"), "Should include expression-related preference");
  ok(!result.communication_style.includes("早晨"), "Should NOT include non-expression preference");
});

// ═══════════════════════════════════════
// SECTION B: Empty/Graceful Degradation
// ═══════════════════════════════════════

console.log("\n═══ B: Empty Data — Graceful Degradation ═══");

test("B1: Completely empty user returns sensible defaults", () => {
  const result = buildNancyPersonalProfile(null, null, [], []);

  equal(result.identity.display_name, "");
  equal(result.career_direction, "尚未明确职业方向");
  equal(result.current_goals[0], "尚未明确当前目标");
  equal(result.strengths[0], "尚未积累足够的优势数据");
  equal(result.weaknesses[0], "尚未识别明确的薄弱领域");
  equal(result.valuable_assets.length, 0);
  equal(result.learning_patterns[0], "尚未形成明确的学习模式");
  equal(result.communication_style, "尚未建立沟通风格画像");
  equal(result.has_real_data, false);
});

test("B2: empty profile is not null-accessing", () => {
  // Should not throw
  const result = buildNancyPersonalProfile(null, null, [], []);
  ok(typeof result.identity === "object", "identity should be object");
  ok(Array.isArray(result.current_goals), "current_goals should be array");
  ok(Array.isArray(result.strengths), "strengths should be array");
  ok(Array.isArray(result.weaknesses), "weaknesses should be array");
});

test("B3: Expression profile with empty objects doesn't break", () => {
  const exprProfile = {
    strengths: {},
    weaknesses: {},
    patterns: {},
    improvement_history: [],
    knowledge_transfer_profile: {},
    asset_stats: {},
  };
  const result = buildNancyPersonalProfile(null, exprProfile, [], []);

  equal(result.strengths[0], "尚未积累足够的优势数据");
  equal(result.weaknesses[0], "尚未识别明确的薄弱领域");
});

// ═══════════════════════════════════════
// SECTION C: Context Builder Output
// ═══════════════════════════════════════

console.log("\n═══ C: buildNancyPersonalProfileContext Output ═══");

function buildContext(profile) {
  if (!profile.has_real_data) {
    return "[NEW_USER_CONTEXT]";
  }

  const lines = [];
  lines.push("## Nancy 个人智能画像（统一上下文）");
  const id = profile.identity;
  if (id.display_name || id.life_theme) {
    lines.push("### 身份画像");
    if (id.display_name) lines.push(`- 名称：${id.display_name}`);
    if (id.career_field) lines.push(`- 职业领域：${id.career_field}`);
  }
  if (profile.communication_style !== "尚未建立沟通风格画像") {
    lines.push(`### 沟通风格\n- ${profile.communication_style}`);
  }
  return lines.join("\n");
}

test("C1: Real profile context includes key sections", () => {
  const profile = makeMockProfile();
  const memories = makeMockMemories(10);
  const result = buildNancyPersonalProfile(profile, null, [], memories);
  const ctx = buildContext(result);

  ok(ctx.includes("Nancy"), "Context should include display name");
  ok(ctx.includes("AI产品"), "Context should include career field");
  ok(ctx.includes("智能画像"), "Context should have title");
});

test("C2: New user context is minimal placeholder", () => {
  const result = buildNancyPersonalProfile(null, null, [], []);
  const ctx = buildContext(result);

  equal(ctx, "[NEW_USER_CONTEXT]");
  ok(!ctx.includes("Nancy"), "New user should not have name");
});

test("C3: Context does NOT contain raw JSON", () => {
  const profile = makeMockProfile();
  const exprProfile = makeMockExpressionProfile();
  const result = buildNancyPersonalProfile(profile, exprProfile, [], []);
  const ctx = buildContext(result);

  ok(!ctx.includes("{"), "Context should not have raw JSON braces");
  ok(!ctx.includes('"strengths"'), "Context should not have raw field names");
});

// ═══════════════════════════════════════
// SECTION D: Cross-Source Integration
// ═══════════════════════════════════════

console.log("\n═══ D: Cross-Source Integration ═══");

test("D1: Career direction blends profile + memory", () => {
  const profile = makeMockProfile();
  const memories = [
    { memory_type: "insight", content: "职业方向倾向于AI产品管理", confidence: 0.7, status: "confirmed" },
  ];
  const result = buildNancyPersonalProfile(profile, null, [], memories);

  ok(result.career_direction.includes("AI产品"), "Should include career from profile");
});

test("D2: Goals blend milestone + preferences + memories", () => {
  const profile = makeMockProfile();
  const memories = [
    { memory_type: "insight", content: "希望通过表达力提升获得晋升机会", confidence: 0.7, status: "confirmed" },
  ];
  const result = buildNancyPersonalProfile(profile, null, [], memories);

  ok(result.current_goals.some((g) => g.includes("提升中文表达")), "Should include milestone");
  ok(result.current_goals.some((g) => g.includes("专注领域")), "Should include preferences");
  ok(result.current_goals.some((g) => g.includes("晋升")), "Should include relevant memory");
});

test("D3: Asset tags with single occurrence don't become strengths", () => {
  const assets = [
    { id: "a1", title: "T1", asset_type: "viewpoint", tags: ["unique_skill_xyz"], quality_score: { completeness: 80, authenticity: 80, reusability: 80 }, asset_data: {} },
  ];
  const result = buildNancyPersonalProfile(null, null, assets, []);

  const tagStrength = result.strengths.find((s) => s.includes("unique_skill_xyz"));
  ok(!tagStrength, "Single-occurrence tag should not be a strength");
});

test("D4: High-scoring strengths (>=70) included, low excluded", () => {
  const exprProfile = makeMockExpressionProfile({
    strengths: { relevance: 78, structure: 72, evidence: 65, logic: 55, creativity: 90 },
  });
  const result = buildNancyPersonalProfile(null, exprProfile, [], []);

  ok(result.strengths.some((s) => s.includes("relevance")), "Score 78 should appear");
  ok(result.strengths.some((s) => s.includes("creativity")), "Score 90 should appear");
  ok(!result.strengths.some((s) => s.includes("logic")), "Score 55 should not appear");
  ok(!result.strengths.some((s) => s.includes("evidence")), "Score 65 should not appear");
});

test("D5: Weakness labeling distinguishes 薄弱 from 待提升", () => {
  const exprProfile = makeMockExpressionProfile({
    weaknesses: { boundary: 42, fluency: 48, depth: 55, vocabulary: 60 },
  });
  const result = buildNancyPersonalProfile(null, exprProfile, [], []);

  const boundary = result.weaknesses.find((w) => w.includes("boundary"));
  ok(boundary.includes("薄弱"), `boundary (42) should be 薄弱, got: ${boundary}`);

  const depth = result.weaknesses.find((w) => w.includes("depth"));
  ok(depth.includes("待提升"), `depth (55) should be 待提升, got: ${depth}`);
});

// ═══════════════════════════════════════
// SECTION E: Agent Integration — Data Shapes
// ═══════════════════════════════════════

console.log("\n═══ E: Agent Integration Shapes ═══");

test("E1: Profile output matches expected agent contract", () => {
  const profile = makeMockProfile();
  const exprProfile = makeMockExpressionProfile();
  const assets = makeMockAssets(3);
  const memories = makeMockMemories(8);
  const result = buildNancyPersonalProfile(profile, exprProfile, assets, memories);

  // Type checks
  ok(typeof result.identity === "object" && result.identity !== null, "identity is object");
  ok(typeof result.career_direction === "string", "career_direction is string");
  ok(Array.isArray(result.current_goals), "current_goals is array");
  ok(Array.isArray(result.strengths), "strengths is array");
  ok(Array.isArray(result.weaknesses), "weaknesses is array");
  ok(Array.isArray(result.valuable_assets), "valuable_assets is array");
  ok(Array.isArray(result.learning_patterns), "learning_patterns is array");
  ok(typeof result.communication_style === "string", "communication_style is string");
  ok(typeof result.has_real_data === "boolean", "has_real_data is boolean");
});

test("E2: Valuable asset entries have correct shape", () => {
  const assets = makeMockAssets(3);
  const result = buildNancyPersonalProfile(null, null, assets, []);

  ok(result.valuable_assets.length > 0, "Should have assets");
  const a = result.valuable_assets[0];
  ok(typeof a.title === "string", "title is string");
  ok(typeof a.asset_type === "string", "asset_type is string");
  ok(typeof a.quality_score === "number", "quality_score is number");
});

test("E3: Chinese expression agent would receive real data", () => {
  // Simulates what chinese-expression-agent passes to getNancyPersonalProfile
  const result = buildNancyPersonalProfile(
    makeMockProfile(),
    makeMockExpressionProfile(),
    makeMockAssets(5),
    makeMockMemories(8),
  );

  ok(result.has_real_data, "Should have real data for a returning user");
  ok(result.communication_style.length > 10, "Should have meaningful communication style");
  ok(result.valuable_assets.length >= 3, "Should have multiple assets");
});

test("E4: English coach agent would get personalized context", () => {
  const memories = [
    { memory_type: "personality", content: "内向但善于深度交流", confidence: 0.9, status: "confirmed" },
    { memory_type: "preference", content: "偏爱结构化表达而非即兴发挥", confidence: 0.85, status: "confirmed" },
    { memory_type: "skill", content: "沟通能力（多次广交会实战）", confidence: 0.88, status: "confirmed" },
  ];
  const result = buildNancyPersonalProfile(
    makeMockProfile({ career_field: "国际贸易" }),
    null,
    [],
    memories,
  );

  ok(result.communication_style.includes("结构化表达"), "English coach should see communication style");
  ok(result.career_direction.includes("国际贸易"), "English coach should see career");
  ok(result.strengths.some((s) => s.includes("广交会")), "English coach should see relevant skills");
});

test("E5: Reflection agent would get long-term patterns", () => {
  const exprProfile = makeMockExpressionProfile();
  const memories = makeMockMemories(10);
  const result = buildNancyPersonalProfile(null, exprProfile, [], memories);

  ok(result.learning_patterns.length > 0, "Should have learning patterns for reflection");
  ok(result.learning_patterns.some((p) => p.includes("累计训练")), "Should include session count");
  ok(result.strengths.length > 0, "Should aggregate strengths");
});

// ═══════════════════════════════════════
// SECTION F: "No Fabrication" Guard
// ═══════════════════════════════════════

console.log("\n═══ F: No-Fabrication Guard ═══");

test("F1: Empty user profile context explicitly forbids fabrication", () => {
  const result = buildNancyPersonalProfile(null, null, [], []);
  const ctx = buildContext(result);

  ok(!ctx.includes("Nancy"), "Should not invent a name");
  equal(ctx, "[NEW_USER_CONTEXT]", "Should use empty placeholder");
});

test("F2: has_real_data is false when only profile exists (no memories/assets/training)", () => {
  const profile = makeMockProfile();
  const result = buildNancyPersonalProfile(profile, null, [], []);

  equal(result.has_real_data, false, "Profile alone should not count as real data");
});

test("F3: Fake/placeholder data is never injected", () => {
  const result = buildNancyPersonalProfile(null, null, [], []);

  // Every field should have a default placeholder, not fake data
  ok(!result.identity.display_name, "No fake display name");
  equal(result.communication_style, "尚未建立沟通风格画像");
  ok(!result.career_direction.includes("工程师"), "No fake career");
  ok(!result.strengths.includes("编程"), "No fake strengths");
});

test("F4: Valuable assets only include real user data", () => {
  const assets = makeMockAssets(2);
  const result = buildNancyPersonalProfile(null, null, assets, []);

  equal(result.valuable_assets.length, 2);
  equal(result.valuable_assets[0].title, "广交会客户接待经历");
  // Should NOT contain AI-generated placeholder assets
  ok(!result.valuable_assets.some((a) => a.title.includes("示例")), "No example placeholders");
  ok(!result.valuable_assets.some((a) => a.title.includes("placeholder")), "No placeholder data");
});

// ═══════════════════════════════════════
// SECTION G: Token Budget
// ═══════════════════════════════════════

console.log("\n═══ G: Token Budget ═══");

function buildFullContext(profile) {
  if (!profile.has_real_data) return "[NEW_USER]";

  const lines = [];
  lines.push("## Nancy 个人智能画像（统一上下文）");
  lines.push("以下是你正在帮助的用户画像。所有建议和反馈必须基于这些真实信息，不得编造。");
  lines.push("");

  const id = profile.identity;
  if (id.display_name || id.life_theme) {
    lines.push("### 身份画像");
    if (id.display_name) lines.push(`- 名称：${id.display_name}`);
    if (id.life_theme) lines.push(`- 生活主题：${id.life_theme}`);
    if (id.career_field) lines.push(`- 职业领域：${id.career_field}`);
    if (id.industry) lines.push(`- 行业：${id.industry}`);
    if (id.current_milestone) lines.push(`- 当前阶段：${id.current_milestone}`);
    lines.push("");
  }

  if (profile.career_direction !== "尚未明确职业方向" || profile.current_goals[0] !== "尚未明确当前目标") {
    lines.push("### 职业方向与目标");
    if (profile.career_direction !== "尚未明确职业方向") lines.push(`- 职业方向：${profile.career_direction}`);
    for (const g of profile.current_goals.slice(0, 5)) lines.push(`- 目标：${g}`);
    lines.push("");
  }

  if (profile.strengths[0] !== "尚未积累足够的优势数据") {
    lines.push("### 优势与特长");
    for (const s of profile.strengths.slice(0, 8)) lines.push(`- ${s}`);
    lines.push("");
  }

  if (profile.weaknesses[0] !== "尚未识别明确的薄弱领域") {
    lines.push("### 薄弱领域（需关注）");
    for (const w of profile.weaknesses.slice(0, 5)) lines.push(`- ${w}`);
    lines.push("");
  }

  if (profile.valuable_assets.length > 0) {
    lines.push("### 核心表达资产（禁止编造经历，只能使用以下真实资产）");
    for (const a of profile.valuable_assets.slice(0, 5)) lines.push(`- [${a.asset_type}] ${a.title}（可复用性：${a.quality_score}）`);
    lines.push("");
  }

  if (profile.communication_style !== "尚未建立沟通风格画像") {
    lines.push("### 沟通风格");
    lines.push(`- ${profile.communication_style}`);
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("使用规则：");
  lines.push("- 以上所有信息均来自用户真实数据，请在回答中自然地融入");
  lines.push("- 禁止编造用户的经历、技能或偏好");
  lines.push("- 如果用户提到画像中未覆盖的新信息，可以在回答中顺势提问以丰富画像");

  return lines.join("\n");
}

test("G1: Full context stays under 1500 chars", () => {
  const result = buildNancyPersonalProfile(
    makeMockProfile(),
    makeMockExpressionProfile(),
    makeMockAssets(5),
    makeMockMemories(10),
  );
  const ctx = buildFullContext(result);

  ok(ctx.length < 1500, `Context should be under 1500 chars for token budget, got ${ctx.length}`);
});

test("G2: Empty context is minimal", () => {
  const result = buildNancyPersonalProfile(null, null, [], []);
  const ctx = buildFullContext(result);

  ok(ctx.length < 50, `Empty context should be tiny, got ${ctx.length}`);
});

// ═══════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════

console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) process.exit(1);
