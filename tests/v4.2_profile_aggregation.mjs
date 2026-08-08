// ============================================
// Expression Profile Aggregation Tests (self-contained)
// 10 test cases covering: consecutive patterns,
// confidence thresholds, old data compat,
// improvement history, frequency tracking.
// ============================================

// ── Inlined type-only dependencies (no imports needed) ──

const CONFIDENCE_THRESHOLD = 3;

function isV4Diagnosis(d) {
  if (!d || typeof d !== "object") return false;
  return typeof d.skill_version === "string" && d.skill_version.startsWith("chinese-v4");
}

function severityToNumber(s) {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

function numberToSeverity(n) {
  return n >= 2.5 ? "high" : n >= 1.5 ? "medium" : "low";
}

function mapIssueToArea(issue) {
  const title = issue.title || "";
  if (/证据|例子|数据|支撑|evidence|example/i.test(title)) return "evidence";
  if (/结构|逻辑|组织|框架|structure|logic|flow/i.test(title)) return "structure";
  if (/深度|思辨|批判|分析|思考|表层|depth|critical/i.test(title)) return "depth";
  if (/清晰|流畅|衔接|啰嗦|重复|clarity|fluency/i.test(title)) return "clarity";
  if (/切题|偏题|主旨|立场|relevance|focus/i.test(title)) return "relevance";
  if (/呈现|语速|停顿|口头禅|语气|delivery|pace/i.test(title)) return "delivery";
  if (/边界|条件|反方|权衡|boundary|counter|tradeoff/i.test(title)) return "boundary";
  if (/场景|冲突|行动|结果|反思|scene|conflict|action|result|reflection/i.test(title)) return "narrative";
  if (/抽象|具体|abstraction|concrete/i.test(title)) return "abstraction";
  if (/细节|表达/i.test(title)) return "general";
  return "general";
}

const FOCUS_AREA_LABELS = {
  evidence: "具体证据", structure: "表达结构", depth: "思考深度",
  clarity: "表达清晰度", relevance: "切题度", delivery: "口语呈现",
  boundary: "边界辨析", narrative: "叙事完整度", abstraction: "抽象升级",
  general: "综合表达",
};

const FOCUS_AREA_ADVICE = {
  evidence: "多用具体例子、数据或个人经历来支撑观点",
  structure: "尝试用 PREP 或 金字塔原理 组织表达，先给结论再展开",
  depth: "思考观点的反面、边界条件和权衡，不只停留在表面",
  clarity: "减少填充词，用短句，每个观点之间留停顿",
  relevance: "开头明确立场，每句话都服务于核心观点",
  delivery: "控制语速，注意停顿节奏，减少'然后'、'就是'等口头禅",
  boundary: "明确你的观点适用于什么条件，什么情况下不成立",
  narrative: "补充场景细节、冲突点和具体行动，不只讲结果",
  abstraction: "从具体案例中提炼通用规律，不只是复述事实",
  general: "每次练习前回顾上一次的AI建议，聚焦一个改进点",
};

function extractProfileSignals(input) {
  const { diagnosis, topic_type, is_retry, round1_score, round2_score } = input;
  const dimensionKeys = [];
  const issueAreas = [];

  if (diagnosis && isV4Diagnosis(diagnosis)) {
    for (const dim of diagnosis.dimensions) {
      if (dim.score >= 6) dimensionKeys.push(dim.key);
    }
    for (const issue of diagnosis.top_issues) {
      if (issue.severity === "high" || issue.severity === "medium") {
        issueAreas.push(mapIssueToArea(issue));
      }
    }
  }

  let score = 0;
  if (diagnosis?.overall?.score != null) {
    score = diagnosis.overall.score;
  } else if (diagnosis) {
    if (typeof diagnosis.overall_score === "number") score = diagnosis.overall_score;
    else if (typeof diagnosis.scores?.total === "number") score = diagnosis.scores.total;
    else if (typeof diagnosis.scores?.overall_score === "number") score = diagnosis.scores.overall_score;
  }

  const improvement = is_retry && round1_score != null && round2_score != null
    ? { area: topic_type, delta: round2_score - round1_score }
    : null;

  return { dimensionKeys, issueAreas, topicType: topic_type, score, isRetry: is_retry, improvement };
}

function mergeProfileSignals(input) {
  const { existing, signals } = input;
  const extracted = extractProfileSignals(signals);

  const strengths = { ...(existing?.strengths ?? {}) };
  const weaknesses = { ...(existing?.weaknesses ?? {}) };
  const prevPatterns = existing?.patterns ?? {};
  const improvementHistory = [...(existing?.improvement_history ?? [])];

  for (const key of extracted.dimensionKeys) {
    strengths[key] = (strengths[key] || 0) + 1;
  }

  const now = new Date().toISOString();
  for (const area of extracted.issueAreas) {
    const prev = weaknesses[area];
    if (prev) {
      const newCount = prev.count + 1;
      weaknesses[area] = {
        count: newCount,
        last_seen: now,
        avg_severity: numberToSeverity((severityToNumber(prev.avg_severity) * prev.count + 2) / newCount),
      };
    } else {
      weaknesses[area] = { count: 1, last_seen: now, avg_severity: "medium" };
    }
  }

  const preferredTypes = { ...(prevPatterns.preferred_types ?? {}) };
  preferredTypes[extracted.topicType] = (preferredTypes[extracted.topicType] || 0) + 1;
  const totalSessions = (prevPatterns.total_sessions ?? 0) + (extracted.isRetry ? 0 : 1);
  const totalRetries = (prevPatterns.total_retries ?? 0) + (extracted.isRetry ? 1 : 0);

  const prevTrend = prevPatterns.score_trend ?? [];
  const scoreTrend = extracted.score > 0
    ? [...prevTrend.slice(-19), { date: now, score: extracted.score, topic_type: extracted.topicType }]
    : prevTrend;

  const allScores = scoreTrend.map((p) => p.score);
  const avgScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : (prevPatterns.avg_score ?? 0);

  const recentFocusAreas = Object.entries(weaknesses)
    .filter(([, v]) => v.count >= CONFIDENCE_THRESHOLD)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([key]) => key);

  const patterns = {
    preferred_types: preferredTypes,
    total_sessions: totalSessions,
    total_retries: totalRetries,
    avg_score: avgScore,
    score_trend: scoreTrend,
    recent_focus_areas: recentFocusAreas,
  };

  if (extracted.improvement && extracted.improvement.delta > 0) {
    improvementHistory.push({
      date: now,
      before_score: signals.round1_score ?? 0,
      after_score: signals.round2_score ?? 0,
      area: extracted.improvement.area,
      sessions: totalSessions,
    });
    if (improvementHistory.length > 50) {
      improvementHistory.splice(0, improvementHistory.length - 50);
    }
  }

  return { strengths, weaknesses, patterns, improvement_history: improvementHistory };
}

function getTrainingFocus(profile) {
  if (!profile) return [];
  return Object.entries(profile.weaknesses)
    .filter(([, v]) => v.count >= CONFIDENCE_THRESHOLD)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([key, v]) => ({
      area: key,
      label: FOCUS_AREA_LABELS[key] || key,
      advice: FOCUS_AREA_ADVICE[key] || FOCUS_AREA_ADVICE.general,
      count: v.count,
    }));
}

// ── Helper: build a minimal V4 diagnosis ──

function v4Diagnosis(overrides = {}) {
  return {
    skill_version: "chinese-v4.1",
    topic_type: "opinion",
    overall: { score: 72, summary: "表达清晰但缺乏具体证据" },
    dimensions: [
      { key: "relevance", label: "切题度", score: 8, max_score: 10, diagnosis: "切题", evidence_quote: "..." },
      { key: "structure", label: "结构", score: 6, max_score: 10, diagnosis: "基本有序", evidence_quote: "..." },
      { key: "depth", label: "深度", score: 5, max_score: 10, diagnosis: "停留在表面", evidence_quote: "..." },
      { key: "evidence", label: "证据", score: 3, max_score: 10, diagnosis: "缺乏具体例子", evidence_quote: "..." },
      { key: "clarity", label: "清晰度", score: 7, max_score: 10, diagnosis: "表达清楚", evidence_quote: "..." },
      { key: "delivery", label: "呈现", score: 6, max_score: 10, diagnosis: "语速适中", evidence_quote: "..." },
    ],
    top_issues: [
      { severity: "high", title: "缺乏具体证据支撑", evidence_quote: "我觉得...", why_it_matters: "...", action: "加入数据" },
      { severity: "medium", title: "未考虑反方观点", evidence_quote: "...", why_it_matters: "...", action: "引入反方" },
    ],
    recommended_structure: { name: "PREP", reason: "适合观点类", steps: ["Point", "Reason", "Example", "Point"] },
    answer_outline: [],
    self_questions: ["这个观点的边界在哪？"],
    key_upgrades: [],
    thinking_or_deepening: { title: "深化", items: [] },
    fact_consistency: { status: "safe", message: "", unconfirmed_details: [] },
    delivery_feedback: { summary: "OK", time_control: "good", pace_comment: "适中", filler_comment: "少" },
    retry_focus: ["evidence"],
    ...overrides,
  };
}

function makeSignal(sessionId, topicType, round, isRetry, diagnosis, r1Score, r2Score) {
  return {
    session_id: sessionId,
    topic_type: topicType,
    attempt_round: round,
    is_retry: isRetry,
    diagnosis,
    round1_score: r1Score,
    round2_score: r2Score,
  };
}

// ── Assertion helper ──

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${label}`); }
}

function section(title) {
  console.log(`\n${title}`);
}

// ══════════════════════════════════════════
// TEST 1: Consecutive opinions accumulate "evidence" weakness
// ══════════════════════════════════════════
section("TEST 1: Consecutive opinions → evidence weakness");
{
  let profile = null;
  const diag = v4Diagnosis();
  for (let i = 0; i < 3; i++) {
    profile = mergeProfileSignals({ existing: profile, signals: makeSignal(`sess-op-${i}`, "opinion", 1, false, diag) });
  }
  const evidence = profile?.weaknesses?.evidence;
  assert(evidence != null, "evidence weakness exists after 3 sessions");
  assert(evidence?.count === 3, `evidence count = 3 (got ${evidence?.count})`);

  const boundary = profile?.weaknesses?.boundary;
  assert(boundary?.count === 3, `boundary count = 3 (got ${boundary?.count})`);

  assert(profile?.strengths?.relevance === 3, `relevance strength count = 3 (got ${profile?.strengths?.relevance})`);

  const focus = getTrainingFocus(profile);
  assert(focus.length >= 2, `at least 2 focus areas (got ${focus.length})`);
  assert(focus[0]?.area === "evidence" || focus[0]?.area === "boundary",
    `top focus is evidence or boundary (got ${focus[0]?.area})`);
}

// ══════════════════════════════════════════
// TEST 2: Consecutive experiences accumulate "narrative" weakness
// ══════════════════════════════════════════
section("TEST 2: Consecutive experiences → narrative weakness");
{
  let profile = null;
  const expDiag = v4Diagnosis({
    topic_type: "experience",
    top_issues: [
      { severity: "high", title: "场景描述过于简单", evidence_quote: "...", why_it_matters: "...", action: "补充细节" },
      { severity: "medium", title: "缺少行动细节", evidence_quote: "...", why_it_matters: "...", action: "具体化" },
    ],
    dimensions: [
      { key: "narrative", label: "叙事", score: 4, max_score: 10, diagnosis: "场景缺失", evidence_quote: "..." },
      { key: "relevance", label: "切题度", score: 7, max_score: 10, diagnosis: "切题", evidence_quote: "..." },
    ],
  });
  for (let i = 0; i < 3; i++) {
    profile = mergeProfileSignals({ existing: profile, signals: makeSignal(`sess-exp-${i}`, "experience", 1, false, expDiag) });
  }
  // Both issues map to narrative: "场景"→narrative, "行动"→narrative
  // 3 sessions × 2 issues = 6 contributions
  assert(profile?.weaknesses?.narrative?.count === 6, `narrative weakness count = 6 (got ${profile?.weaknesses?.narrative?.count})`);

  const focus = getTrainingFocus(profile);
  assert(focus.length >= 1, `1+ focus areas after experiences (got ${focus.length})`);
  assert(focus[0]?.area === "narrative", `top focus is narrative (got ${focus[0]?.area})`);
}

// ══════════════════════════════════════════
// TEST 3: Single anomaly does NOT reach threshold
// ══════════════════════════════════════════
section("TEST 3: Single anomaly below confidence threshold");
{
  let profile = null;
  profile = mergeProfileSignals({ existing: profile, signals: makeSignal("sess-01", "opinion", 1, false, v4Diagnosis()) });

  const depthDiag = v4Diagnosis({
    top_issues: [{ severity: "medium", title: "缺乏深度分析", evidence_quote: "...", why_it_matters: "...", action: "深化" }],
  });
  for (let i = 0; i < 2; i++) {
    profile = mergeProfileSignals({ existing: profile, signals: makeSignal(`sess-depth-${i}`, "opinion", 1, false, depthDiag) });
  }

  assert(profile?.weaknesses?.evidence?.count === 1, `evidence count = 1 (anomaly)`);
  assert(profile?.weaknesses?.depth?.count === 2, `depth count = 2 (below threshold)`);

  const focus = getTrainingFocus(profile);
  assert(focus.length === 0, `no focus areas (all below threshold), got ${focus.length}`);
}

// ══════════════════════════════════════════
// TEST 4: Old V3 diagnosis — score only, no dimensions/issues
// ══════════════════════════════════════════
section("TEST 4: V3 diagnosis backward compat");
{
  const v3Diagnosis = { version: "chinese-v3", overall_score: 65, scores: { total: 65 } };
  const signals = extractProfileSignals(makeSignal("old-01", "opinion", 1, false, v3Diagnosis));
  assert(signals.dimensionKeys.length === 0, `V3 yields 0 dimension keys (got ${signals.dimensionKeys.length})`);
  assert(signals.issueAreas.length === 0, `V3 yields 0 issue areas (got ${signals.issueAreas.length})`);
  assert(signals.score === 65, `V3 score extracted: 65 (got ${signals.score})`);
}

// ══════════════════════════════════════════
// TEST 5: Pattern tracking — preferred types
// ══════════════════════════════════════════
section("TEST 5: Preferred topic types tracking");
{
  let profile = null;
  const types = ["opinion", "opinion", "experience", "opinion", "concept", "opinion"];
  for (const t of types) {
    profile = mergeProfileSignals({ existing: profile, signals: makeSignal(`type-${t}`, t, 1, false, v4Diagnosis({ topic_type: t })) });
  }
  assert(profile?.patterns?.preferred_types?.opinion === 4, `opinion count = 4`);
  assert(profile?.patterns?.preferred_types?.experience === 1, `experience count = 1`);
  assert(profile?.patterns?.preferred_types?.concept === 1, `concept count = 1`);
  assert(profile?.patterns?.total_sessions === 6, `total sessions = 6`);
  assert(profile?.patterns?.total_retries === 0, `total retries = 0`);
}

// ══════════════════════════════════════════
// TEST 6: Score trend accumulation
// ══════════════════════════════════════════
section("TEST 6: Score trend tracking");
{
  let profile = null;
  const scores = [65, 68, 72, 70, 78, 75, 82, 80, 85, 88];
  for (const s of scores) {
    profile = mergeProfileSignals({
      existing: profile,
      signals: makeSignal(`trend-${s}`, "opinion", 1, false, v4Diagnosis({ overall: { score: s, summary: `Test ${s}` } })),
    });
  }
  assert(profile?.patterns?.score_trend?.length === 10, `trend has 10 points`);
  assert(profile?.patterns?.score_trend[9].score === 88, `last score = 88`);
  assert(profile?.patterns?.avg_score === 76, `avg score = 76 (got ${profile?.patterns?.avg_score})`);
}

// ══════════════════════════════════════════
// TEST 7: Retry improvement tracked
// ══════════════════════════════════════════
section("TEST 7: Retry improvement history");
{
  let profile = null;
  profile = mergeProfileSignals({
    existing: profile,
    signals: makeSignal("retry-01", "opinion", 1, false, v4Diagnosis({ overall: { score: 65, summary: "R1" } })),
  });
  profile = mergeProfileSignals({
    existing: profile,
    signals: makeSignal("retry-01", "opinion", 2, true, v4Diagnosis({ overall: { score: 78, summary: "R2" } }), 65, 78),
  });
  assert(profile?.patterns?.total_retries === 1, "retry count = 1");
  assert(profile?.improvement_history?.length === 1, "1 improvement entry");
  assert(profile?.improvement_history[0]?.before_score === 65, "before = 65");
  assert(profile?.improvement_history[0]?.after_score === 78, "after = 78");
}

// ══════════════════════════════════════════
// TEST 8: Null diagnosis doesn't crash
// ══════════════════════════════════════════
section("TEST 8: Null diagnosis safety");
{
  const signals = extractProfileSignals({
    session_id: "null-test", topic_type: "opinion", attempt_round: 1, is_retry: false, diagnosis: null,
  });
  assert(signals.dimensionKeys.length === 0, "null diagnosis → 0 dimension keys");
  assert(signals.issueAreas.length === 0, "null diagnosis → 0 issue areas");
  assert(signals.score === 0, "null diagnosis → score 0");

  const merged = mergeProfileSignals({
    existing: null,
    signals: { session_id: "null-test", topic_type: "opinion", attempt_round: 1, is_retry: false, diagnosis: null },
  });
  assert(merged.patterns.total_sessions === 1, "null diagnosis merge doesn't crash");
}

// ══════════════════════════════════════════
// TEST 9: Issue-to-area mapping covers all patterns
// ══════════════════════════════════════════
section("TEST 9: Issue area mapping coverage");
{
  const testCases = [
    ["缺乏具体证据支撑观点", "evidence"],
    ["结构松散，缺少过渡", "structure"],
    ["思考停留在表层", "depth"],
    ["表达不够清晰流畅", "clarity"],
    ["开头未明确立场", "relevance"],
    ["语速过快，缺少停顿", "delivery"],
    ["未考虑观点边界条件", "boundary"],
    ["场景描述过于抽象", "narrative"],
    ["缺少冲突和转折", "narrative"],
    ["停留在抽象层面", "abstraction"],
  ];
  for (const [title, expected] of testCases) {
    const diag = v4Diagnosis({ top_issues: [{ severity: "high", title, evidence_quote: "...", why_it_matters: "...", action: "改进" }] });
    const signals = extractProfileSignals(makeSignal("map-test", "opinion", 1, false, diag));
    assert(signals.issueAreas.some((a) => a === expected),
      `"${title.substring(0, 20)}..." → "${expected}" (got [${signals.issueAreas.join(", ")}])`);
  }
}

// ══════════════════════════════════════════
// TEST 10: Mixed topic types generate diverse focus
// ══════════════════════════════════════════
section("TEST 10: Mixed types → diverse profile");
{
  let profile = null;

  for (let i = 0; i < 3; i++) {
    profile = mergeProfileSignals({ existing: profile, signals: makeSignal(`mix-op-${i}`, "opinion", 1, false, v4Diagnosis()) });
  }

  const expDiag = v4Diagnosis({
    topic_type: "experience",
    top_issues: [
      { severity: "high", title: "场景描述过于简单", evidence_quote: "...", why_it_matters: "...", action: "补充细节" },
    ],
  });
  for (let i = 0; i < 2; i++) {
    profile = mergeProfileSignals({ existing: profile, signals: makeSignal(`mix-exp-${i}`, "experience", 1, false, expDiag) });
  }

  const conceptDiag = v4Diagnosis({
    topic_type: "concept",
    top_issues: [{ severity: "medium", title: "表达不够清晰流畅", evidence_quote: "...", why_it_matters: "...", action: "简化" }],
  });
  for (let i = 0; i < 3; i++) {
    profile = mergeProfileSignals({ existing: profile, signals: makeSignal(`mix-con-${i}`, "concept", 1, false, conceptDiag) });
  }

  const focus = getTrainingFocus(profile);
  assert(focus.length >= 3, `3+ focus areas from mixed types (got ${focus.length})`);
  assert(focus.some((f) => f.area === "evidence"), "evidence in focus");
  assert(focus.some((f) => f.area === "clarity"), "clarity in focus");

  const pref = profile?.patterns?.preferred_types;
  assert(pref?.opinion === 3, "3 opinions");
  assert(pref?.experience === 2, "2 experiences");
  assert(pref?.concept === 3, "3 concepts");

  const narrativeInFocus = focus.some((f) => f.area === "narrative");
  assert(!narrativeInFocus, "narrative NOT in focus (only 2, below threshold)");
}

// ══════════════════════════════════════════
console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(50)}`);
if (failed > 0) process.exit(1);
