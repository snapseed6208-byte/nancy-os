// ============================================
// Nancy OS — Phase 3.4 Dynamic Growth Engine Tests
// Tests for getGrowthSnapshot, buildGrowthSummary,
// and NancyPersonalProfileWithGrowth.
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
// Inlined growth engine functions
// (mirrors nancy-context.ts implementation)
// ═══════════════════════════════════════

const DIMENSION_LABELS_ZH = {
  relevance: "切题性",
  structure: "结构组织",
  evidence: "论据支撑",
  boundary: "边界意识",
  fluency: "流畅度",
  depth: "思想深度",
  logic: "逻辑性",
  creativity: "创意性",
  vocabulary: "词汇丰富度",
  grammar: "语法准确性",
  naturalness: "表达自然度",
  communication: "沟通能力",
  confidence: "自信度",
};

function computeGrowthSnapshot(attempts, exprProfile, recentMemories) {
  if (attempts.length === 0 && !exprProfile && recentMemories.length === 0) {
    return null;
  }

  const dimScores = new Map();
  for (const attempt of attempts) {
    const scores = attempt.scores || {};
    for (const [dim, score] of Object.entries(scores)) {
      if (typeof score === "number") {
        if (!dimScores.has(dim)) dimScores.set(dim, []);
        dimScores.get(dim).push(score);
      }
    }
  }

  const dimension_trends = [];
  for (const [dim, scores] of dimScores) {
    if (scores.length >= 2) {
      const start = Math.round(scores[0]);
      const end = Math.round(scores[scores.length - 1]);
      dimension_trends.push({
        dimension: dim,
        start_score: start,
        end_score: end,
        delta: end - start,
        sample_count: scores.length,
      });
    }
  }
  dimension_trends.sort((a, b) => b.delta - a.delta);

  const new_patterns = [];
  const newSkills = recentMemories.filter((m) =>
    m.memory_type === "skill" && m.reinforcement_count >= 2,
  );
  const newInsights = recentMemories.filter((m) =>
    m.memory_type === "insight" && m.confidence >= 0.7,
  );
  for (const m of [...newSkills, ...newInsights].slice(0, 5)) {
    new_patterns.push(m.content);
  }

  const important_events = [];
  const history = exprProfile?.improvement_history || [];
  if (Array.isArray(history) && history.length > 0) {
    for (const entry of history.slice(-3)) {
      if (typeof entry === "object" && entry) {
        const area = entry.area || "未知维度";
        const before = entry.before_score || 0;
        const after = entry.after_score || 0;
        important_events.push(`${area}: ${before}→${after}（+${after - before}）`);
      }
    }
  }
  for (const trend of dimension_trends) {
    if (trend.delta >= 10) {
      const label = DIMENSION_LABELS_ZH[trend.dimension] || trend.dimension;
      important_events.push(`${label}显著提升：${trend.start_score}→${trend.end_score}（+${trend.delta}）`);
    }
  }

  let overall_direction = "insufficient_data";
  if (dimension_trends.length > 0) {
    const avgDelta = dimension_trends.reduce((sum, t) => sum + t.delta, 0) / dimension_trends.length;
    if (avgDelta >= 5) overall_direction = "improving";
    else if (avgDelta >= -3) overall_direction = "stable";
    else overall_direction = "exploring";
  } else if (recentMemories.length > 0) {
    overall_direction = "exploring";
  }

  return {
    date: "2026-08-09",
    dimension_trends,
    new_patterns,
    important_events: [...new Set(important_events)].slice(0, 8),
    overall_direction,
  };
}

function buildGrowthSummary(snapshot) {
  const empty = {
    recent_progress: "尚未积累足够的训练数据来生成成长趋势",
    current_focus: "鼓励用户持续进行表达训练以建立数据基线",
    long_term_pattern: "数据不足，尚无法识别长期模式",
    top_improvements: [],
    recent_milestones: [],
    training_rhythm: "暂无训练记录",
  };

  if (!snapshot || snapshot.dimension_trends.length === 0) return empty;

  const trends = snapshot.dimension_trends;

  const improved = trends.filter((t) => t.delta >= 5).slice(0, 3);
  if (improved.length > 0) {
    const parts = improved.map((t) => {
      const label = DIMENSION_LABELS_ZH[t.dimension] || t.dimension;
      return `${label}（${t.start_score}→${t.end_score}，+${t.delta}）`;
    });
    empty.recent_progress = `最近在${parts.join("、")}方面有明显提升`;
  } else if (snapshot.overall_direction === "stable") {
    empty.recent_progress = "各项能力保持稳定，未见显著波动";
  } else {
    empty.recent_progress = "处于探索阶段，各项能力正在建立基线";
  }

  const declining = trends.filter((t) => t.delta < 0).slice(0, 2);
  const weakest = [...trends].sort((a, b) => a.end_score - b.end_score).slice(0, 2);
  if (declining.length > 0) {
    const parts = declining.map((t) => DIMENSION_LABELS_ZH[t.dimension] || t.dimension);
    empty.current_focus = `需要重点关注${parts.join("、")}的提升`;
  } else if (weakest.length > 0 && weakest[0].end_score < 65) {
    const parts = weakest.map((t) => DIMENSION_LABELS_ZH[t.dimension] || t.dimension);
    empty.current_focus = `薄弱领域：${parts.join("、")}仍需要持续练习`;
  } else {
    empty.current_focus = "各项能力均衡发展，可选择性挑战更高难度话题";
  }

  const sampleTotal = trends.reduce((sum, t) => sum + t.sample_count, 0);
  const avgDelta = Math.round(trends.reduce((sum, t) => sum + t.delta, 0) / trends.length);
  if (avgDelta >= 5) {
    empty.long_term_pattern = `整体呈上升趋势（平均每维度+${avgDelta}分），共${sampleTotal}个训练样本`;
  } else if (avgDelta >= 0) {
    empty.long_term_pattern = `整体保持稳定（平均变化+${avgDelta}分），共${sampleTotal}个训练样本`;
  } else {
    empty.long_term_pattern = `近期有轻微下降趋势（平均${avgDelta}分），建议增加训练频率`;
  }

  empty.top_improvements = improved.slice(0, 2).map((t) => {
    const label = DIMENSION_LABELS_ZH[t.dimension] || t.dimension;
    return `${label}: ${t.start_score}→${t.end_score}`;
  });

  for (const event of snapshot.important_events.slice(0, 3)) {
    empty.recent_milestones.push(event);
  }

  if (sampleTotal >= 10) {
    empty.training_rhythm = `过去60天训练频率较高（${sampleTotal}条评分记录），成长轨迹清晰`;
  } else if (sampleTotal >= 4) {
    empty.training_rhythm = `过去60天有${sampleTotal}条训练记录，保持了一定的练习节奏`;
  } else {
    empty.training_rhythm = `过去60天仅${sampleTotal}条训练记录，建议增加训练频率以获得更清晰的成长轨迹`;
  }

  return empty;
}

// ═══════════════════════════════════════
// Helpers to make mock attempt data
// ═══════════════════════════════════════

function makeAttempt(scores, daysAgo = 0) {
  return {
    id: `attempt-${daysAgo}`,
    scores,
    attempt_round: 1,
    created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  };
}

// ═══════════════════════════════════════
// SECTION A: Growth Snapshot Computation
// ═══════════════════════════════════════

console.log("\n═══ A: Growth Snapshot — Dimension Trends ═══");

test("A1: Clear improvement trend across 4 sessions", () => {
  const attempts = [
    makeAttempt({ relevance: 60, structure: 55, evidence: 50 }, 30),
    makeAttempt({ relevance: 65, structure: 60, evidence: 55 }, 21),
    makeAttempt({ relevance: 72, structure: 68, evidence: 62 }, 10),
    makeAttempt({ relevance: 78, structure: 75, evidence: 70 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);

  ok(snapshot, "Should produce snapshot");
  equal(snapshot.dimension_trends.length, 3, "Should have 3 dimension trends");

  const relevance = snapshot.dimension_trends.find((t) => t.dimension === "relevance");
  ok(relevance, "Should have relevance trend");
  equal(relevance.start_score, 60);
  equal(relevance.end_score, 78);
  equal(relevance.delta, 18);
  equal(relevance.sample_count, 4);

  equal(snapshot.overall_direction, "improving", "Clear improvement should be detected");
});

test("A2: Stable trend with small fluctuations", () => {
  const attempts = [
    makeAttempt({ relevance: 70, structure: 68 }, 30),
    makeAttempt({ relevance: 72, structure: 67 }, 20),
    makeAttempt({ relevance: 69, structure: 70 }, 10),
    makeAttempt({ relevance: 71, structure: 69 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);

  ok(snapshot, "Should produce snapshot");
  equal(snapshot.overall_direction, "stable", "Small changes should be stable");
});

test("A3: Declining trend (exploring phase)", () => {
  const attempts = [
    makeAttempt({ relevance: 75, structure: 72 }, 30),
    makeAttempt({ relevance: 70, structure: 68 }, 20),
    makeAttempt({ relevance: 65, structure: 62 }, 10),
    makeAttempt({ relevance: 60, structure: 58 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);

  ok(snapshot, "Should produce snapshot");
  equal(snapshot.overall_direction, "exploring", "Declining should be exploring");
});

test("A4: Single score data point returns no trend", () => {
  // Only one score — not enough for trend (needs >= 2)
  const attempts = [
    makeAttempt({ relevance: 70 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);

  // 1 data point per dim, not enough for trend (needs >=2)
  equal(snapshot.dimension_trends.length, 0, "Single point should not generate trend");
});

test("A5: Mixed improvement and decline dimensions", () => {
  const attempts = [
    makeAttempt({ relevance: 60, fluency: 70, structure: 65 }, 30),
    makeAttempt({ relevance: 75, fluency: 68, structure: 72 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);

  const relTrend = snapshot.dimension_trends.find((t) => t.dimension === "relevance");
  const fluTrend = snapshot.dimension_trends.find((t) => t.dimension === "fluency");

  ok(relTrend.delta > 0, `Relevance should improve, got delta=${relTrend.delta}`);
  ok(fluTrend.delta < 0, `Fluency should decline, got delta=${fluTrend.delta}`);

  // Most improved first
  equal(snapshot.dimension_trends[0].dimension, "relevance", "Most improved should be first");
});

// ═══════════════════════════════════════
// SECTION B: Growth Summary Messages
// ═══════════════════════════════════════

console.log("\n═══ B: Growth Summary — Natural Language ═══");

test("B1: Improving user gets positive summary", () => {
  const attempts = [
    makeAttempt({ relevance: 60, structure: 55, evidence: 50 }, 30),
    makeAttempt({ relevance: 78, structure: 75, evidence: 70 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const summary = buildGrowthSummary(snapshot);

  ok(summary.recent_progress.includes("提升"), `Should mention improvement: ${summary.recent_progress}`);
  ok(summary.recent_progress.includes("切题性"), "Should mention specific dimensions");
  ok(summary.long_term_pattern.includes("上升"), "Long term should indicate growth");
});

test("B2: Stable user gets neutral summary", () => {
  const attempts = [
    makeAttempt({ relevance: 70, structure: 68 }, 30),
    makeAttempt({ relevance: 71, structure: 69 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const summary = buildGrowthSummary(snapshot);

  ok(summary.recent_progress.includes("稳定"), `Should mention stability: ${summary.recent_progress}`);
});

test("B3: Weak dimension becomes current focus", () => {
  const attempts = [
    makeAttempt({ relevance: 78, structure: 42, evidence: 75 }, 30),
    makeAttempt({ relevance: 80, structure: 44, evidence: 78 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const summary = buildGrowthSummary(snapshot);

  ok(summary.current_focus.includes("结构"), `Should focus on weakest dim: ${summary.current_focus}`);
  ok(summary.current_focus.includes("薄弱"), "Should label as 薄弱");
});

test("B4: Declining dimensions become focus", () => {
  const attempts = [
    makeAttempt({ relevance: 75, fluency: 72 }, 30),
    makeAttempt({ relevance: 72, fluency: 58 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const summary = buildGrowthSummary(snapshot);

  ok(summary.current_focus.includes("流畅度"), `Declining dim should be focus: ${summary.current_focus}`);
});

test("B5: Top improvements are correctly identified", () => {
  const attempts = [
    makeAttempt({ relevance: 60, structure: 65, evidence: 70 }, 30),
    makeAttempt({ relevance: 78, structure: 68, evidence: 72 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const summary = buildGrowthSummary(snapshot);

  equal(summary.top_improvements.length, 1, "Only relevance improved by >=5");
  ok(summary.top_improvements[0].includes("切题性"), `Top improvement should be 切题性: ${summary.top_improvements[0]}`);
});

// ═══════════════════════════════════════
// SECTION C: Important Events & Milestones
// ═══════════════════════════════════════

console.log("\n═══ C: Important Events ═══");

test("C1: Significant delta (>=10) creates milestone event", () => {
  const attempts = [
    makeAttempt({ relevance: 60, structure: 55 }, 30),
    makeAttempt({ relevance: 78, structure: 58 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);

  ok(snapshot.important_events.length > 0, "Significant change should create event");
  ok(snapshot.important_events.some((e) => e.includes("切题性")), "Should mention dimension label");
  ok(snapshot.important_events.some((e) => e.includes("+18")), "Should show delta magnitude");
});

test("C2: Improvement history events are included", () => {
  const attempts = [
    makeAttempt({ relevance: 60 }, 30),
    makeAttempt({ relevance: 65 }, 2),
  ];
  const exprProfile = {
    improvement_history: [
      { date: "2026-08-01", before_score: 65, after_score: 78, area: "evidence", sessions: 5 },
    ],
  };
  const snapshot = computeGrowthSnapshot(attempts, exprProfile, []);

  ok(snapshot.important_events.some((e) => e.includes("evidence")), "Should include history events");
});

test("C3: Milestones are surfaced in summary", () => {
  const attempts = [
    makeAttempt({ relevance: 55 }, 30),
    makeAttempt({ relevance: 72 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const summary = buildGrowthSummary(snapshot);

  ok(summary.recent_milestones.length > 0, "Should have milestone");
  ok(summary.recent_milestones[0].includes("切题性"), "Milestone should mention dimension");
});

// ═══════════════════════════════════════
// SECTION D: New Pattern Detection
// ═══════════════════════════════════════

console.log("\n═══ D: New Pattern Detection ═══");

test("D1: Recently reinforced skills are new patterns", () => {
  const memories = [
    { memory_type: "skill", content: "沟通能力（多次广交会实战）", confidence: 0.88, status: "confirmed", reinforcement_count: 3 },
    { memory_type: "insight", content: "通过刻意练习表达力提升明显", confidence: 0.72, status: "confirmed", reinforcement_count: 1 },
  ];
  const snapshot = computeGrowthSnapshot([], null, memories);

  ok(snapshot.new_patterns.includes("沟通能力（多次广交会实战）"), "High-confidence reinforced skill should be pattern");
  ok(snapshot.new_patterns.includes("通过刻意练习表达力提升明显"), "High-confidence insight should be pattern");
});

test("D2: Skills with count < 2 or insight with confidence < 0.7 are excluded", () => {
  const memories = [
    { memory_type: "skill", content: "Python入门", confidence: 0.4, status: "probable", reinforcement_count: 1 },
    { memory_type: "insight", content: "不太确定的洞察", confidence: 0.5, status: "probable", reinforcement_count: 1 },
  ];
  const snapshot = computeGrowthSnapshot([], null, memories);

  equal(snapshot.new_patterns.length, 0, "Low-confidence patterns should be excluded");
});

test("D3: Exploring mode when only memories (no scores)", () => {
  const memories = [
    { memory_type: "insight", content: "职业方向倾向于AI产品管理", confidence: 0.7, status: "confirmed", reinforcement_count: 2 },
  ];
  const snapshot = computeGrowthSnapshot([], null, memories);

  equal(snapshot.overall_direction, "exploring", "Insights without scores → exploring");
});

// ═══════════════════════════════════════
// SECTION E: Empty Data / Edge Cases
// ═══════════════════════════════════════

console.log("\n═══ E: Empty Data — Edge Cases ═══");

test("E1: No data at all returns null", () => {
  const snapshot = computeGrowthSnapshot([], null, []);
  equal(snapshot, null, "No data should return null");
});

test("E2: Null snapshot produces empty growth summary", () => {
  const summary = buildGrowthSummary(null);
  ok(summary.recent_progress.includes("尚未积累"), "Should indicate insufficient data");
  equal(summary.top_improvements.length, 0);
  equal(summary.recent_milestones.length, 0);
});

test("E3: Scores with null/undefined values are skipped", () => {
  const attempts = [
    makeAttempt({ relevance: 70, structure: null }, 10),
    makeAttempt({ relevance: 75, structure: 65 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);

  ok(snapshot, "Should not crash on null scores");
  // structure only has 1 valid score → no trend
  ok(!snapshot.dimension_trends.find((t) => t.dimension === "structure"),
    "Dimension with insufficient data should not have trend");
});

test("E4: Scores that aren't numbers are filtered", () => {
  const attempts = [
    makeAttempt({ relevance: 70, extra_info: "this is a string, not numeric" }, 10),
    makeAttempt({ relevance: 75 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);

  ok(snapshot, "Should not crash on non-numeric scores");
  equal(snapshot.dimension_trends.length, 1, "Only numeric dimension should be counted");
});

// ═══════════════════════════════════════
// SECTION F: Training Rhythm
// ═══════════════════════════════════════

console.log("\n═══ F: Training Rhythm ═══");

test("F1: High training frequency", () => {
  const attempts = [];
  for (let i = 0; i < 12; i++) {
    attempts.push(makeAttempt({ relevance: 60 + i * 2 }, i * 3));
  }
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const summary = buildGrowthSummary(snapshot);

  ok(summary.training_rhythm.includes("较高"), `High volume: ${summary.training_rhythm}`);
  ok(summary.training_rhythm.includes("12"), "Should mention sample count");
});

test("F2: Low training frequency", () => {
  const attempts = [
    makeAttempt({ relevance: 60 }, 30),
    makeAttempt({ relevance: 62 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const summary = buildGrowthSummary(snapshot);

  ok(summary.training_rhythm.includes("仅2条"), `Low volume: ${summary.training_rhythm}`);
});

// ═══════════════════════════════════════
// SECTION G: Growth Profile Integration
// ═══════════════════════════════════════

console.log("\n═══ G: Growth Profile Integration ═══");

function makeGrowthProfile(baseProfile, growthSnapshot) {
  const growth_summary = growthSnapshot ? buildGrowthSummary(growthSnapshot) : buildGrowthSummary(null);
  return {
    ...baseProfile,
    growth_summary,
    growth_snapshot: growthSnapshot,
  };
}

test("G1: Growth profile extends base profile correctly", () => {
  const baseProfile = {
    identity: { display_name: "Nancy", life_theme: "表达力提升" },
    career_direction: "AI产品",
    current_goals: ["提升表达"],
    strengths: ["structure（72分）"],
    weaknesses: ["fluency（48分 — 薄弱）"],
    valuable_assets: [],
    learning_patterns: ["累计训练4次"],
    communication_style: "内向但善于深度交流",
    has_real_data: true,
  };

  const attempts = [
    makeAttempt({ relevance: 60, structure: 55 }, 30),
    makeAttempt({ relevance: 78, structure: 75 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const profile = makeGrowthProfile(baseProfile, snapshot);

  ok(profile.growth_summary, "Should have growth summary");
  ok(profile.growth_snapshot, "Should have growth snapshot");
  ok(profile.growth_summary.recent_progress.includes("提升"), "Growth should show progress");
  equal(profile.identity.display_name, "Nancy", "Base identity preserved");
  equal(profile.career_direction, "AI产品", "Base career preserved");
});

test("G2: New user has growth but empty summary", () => {
  const baseProfile = {
    identity: { display_name: "", life_theme: "" },
    career_direction: "尚未明确职业方向",
    current_goals: ["尚未明确当前目标"],
    strengths: ["尚未积累足够的优势数据"],
    weaknesses: ["尚未识别明确的薄弱领域"],
    valuable_assets: [],
    learning_patterns: ["尚未形成明确的学习模式"],
    communication_style: "尚未建立沟通风格画像",
    has_real_data: false,
  };

  const profile = makeGrowthProfile(baseProfile, null);

  ok(profile.growth_summary.recent_progress.includes("尚未积累"), "No data → empty progress");
  ok(profile.growth_summary.training_rhythm.includes("暂无"), "No data → no rhythm");
  equal(profile.growth_snapshot, null, "No growth snapshot for new user");
});

test("G3: Growth profile still marks has_real_data correctly", () => {
  const baseProfile = {
    identity: { display_name: "", life_theme: "" },
    career_direction: "尚未明确职业方向",
    current_goals: ["尚未明确当前目标"],
    strengths: ["尚未积累足够的优势数据"],
    weaknesses: ["尚未识别明确的薄弱领域"],
    valuable_assets: [],
    learning_patterns: ["尚未形成明确的学习模式"],
    communication_style: "尚未建立沟通风格画像",
    has_real_data: false,
  };

  const attempts = [
    makeAttempt({ relevance: 60 }, 30),
    makeAttempt({ relevance: 72 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const profile = makeGrowthProfile(baseProfile, snapshot);

  ok(profile.growth_summary.recent_progress.includes("提升"), "Training data → growth insight");
  ok(profile.growth_summary.top_improvements.length > 0, "Should have top improvements");
});

// ═══════════════════════════════════════
// SECTION H: AI Context — Growth Injected
// ═══════════════════════════════════════

console.log("\n═══ H: AI Context with Growth ═══");

test("H1: Growth context includes dimension-specific progress", () => {
  const attempts = [
    makeAttempt({ relevance: 60, structure: 55 }, 30),
    makeAttempt({ relevance: 78, structure: 75 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const summary = buildGrowthSummary(snapshot);

  ok(summary.recent_progress.includes("切题性"), "Should use Chinese dimension labels");
  ok(summary.recent_progress.includes("结构组织"), "Should mention structure");
  ok(summary.recent_progress.includes("78"), "Should include final scores");
});

test("H2: Agent would know what Nancy is currently working on", () => {
  const attempts = [
    makeAttempt({ relevance: 78, structure: 72, fluency: 45 }, 30),
    makeAttempt({ relevance: 80, structure: 74, fluency: 48 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const summary = buildGrowthSummary(snapshot);

  ok(summary.current_focus.includes("流畅度"), "Agent should be told to focus on fluency");
});

test("H3: Stable user summary doesn't fabricate progress", () => {
  const attempts = [
    makeAttempt({ relevance: 70 }, 30),
    makeAttempt({ relevance: 71 }, 2),
  ];
  const snapshot = computeGrowthSnapshot(attempts, null, []);
  const summary = buildGrowthSummary(snapshot);

  ok(summary.recent_progress.includes("稳定"), "Should say stable, not fabricate improvement");
  ok(!summary.recent_progress.includes("明显提升"), "Should not claim significant improvement when none exists");
});

// ═══════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════

console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) process.exit(1);
