// English Expression Activation SRS V2 — Regression Test Suite
// Tests the standalone expressionSrs.ts scheduling module
// Run: node tests/english_activation_srs_v2.mjs

// ── Inline the SRS module for pure Node.js testing (no TypeScript) ──

const MIN_EF = 1.3;
const INITIAL_EF = 2.5;
const MAX_INTERVAL = 365;
const ACTIVATION_REPS = 3;
const PRODUCTION_REPS = 6;
const MASTERY_REPS = 8;
const MAINTENANCE_INTERVAL = 90;

function ratingToQuality(rating) {
  switch (rating) {
    case "again": return 0;
    case "hard": return 1;
    case "good": return 2;
    case "easy": return 3;
  }
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function determineStage(repetitions, intervalDays, productionCount) {
  if (repetitions >= MASTERY_REPS && intervalDays >= MAINTENANCE_INTERVAL) {
    return "maintenance";
  }
  if (repetitions >= PRODUCTION_REPS && intervalDays >= 60 && productionCount >= 2) {
    return "production";
  }
  if (repetitions >= ACTIVATION_REPS) {
    return "activation";
  }
  return "learning";
}

function stageToStatus(stage) {
  switch (stage) {
    case "maintenance": return "mastered";
    case "production":
    case "activation": return "review";
    case "learning":
    default: return "learning";
  }
}

function scheduleExpressionReview(rating, current, now = new Date()) {
  const ef = current.ease_factor ?? INITIAL_EF;
  const reps = current.repetitions ?? 0;
  const interval = current.interval_days ?? 0;
  const lapses = current.lapse_count ?? 0;
  const productions = current.production_count ?? 0;

  let newEF = ef;
  let newInterval;
  let newReps;
  let newLapses = lapses;

  const q = ratingToQuality(rating);
  newEF = ef + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02));
  if (newEF < MIN_EF) newEF = MIN_EF;

  switch (rating) {
    case "again":
      newLapses = lapses + 1;
      newReps = 0;
      newInterval = 1;
      break;

    case "hard":
      newReps = reps;
      if (interval === 0) {
        newInterval = 1;
      } else {
        newInterval = Math.max(1, Math.round(interval * 1.2));
      }
      break;

    case "good":
      newReps = reps + 1;
      if (interval === 0) {
        newInterval = 1;
      } else if (reps === 0) {
        newInterval = 4;
      } else {
        newInterval = Math.min(MAX_INTERVAL, Math.round(interval * newEF));
      }
      break;

    case "easy":
      newReps = reps + 1;
      if (interval === 0) {
        newInterval = 4;
      } else {
        newInterval = Math.min(MAX_INTERVAL, Math.round(interval * newEF * 1.3));
      }
      break;
  }

  const stage = determineStage(newReps, newInterval, productions);
  const status = stageToStatus(stage);
  const nextDate = addDays(now, newInterval);

  return {
    ease_factor: Math.round(newEF * 100) / 100,
    repetitions: newReps,
    interval_days: newInterval,
    lapse_count: newLapses,
    next_review_date: nextDate,
    status,
    stage,
  };
}

function daysUntilDue(nextReviewDate, now = new Date()) {
  if (!nextReviewDate) return 0;
  const next = new Date(nextReviewDate + "T00:00:00");
  const diff = Math.ceil((next.getTime() - now.getTime()) / 86400000);
  return Math.max(0, diff);
}

function isDue(nextReviewDate, now = new Date()) {
  if (!nextReviewDate) return true;
  return new Date(nextReviewDate + "T00:00:00") <= now;
}

function isMastered(result) {
  if ("stage" in result) return result.stage === "maintenance";
  return determineStage(
    result.repetitions || 0,
    result.interval_days || 0,
    result.production_count || 0,
  ) === "maintenance";
}

// ── Test Framework ──

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function eq(actual, expected, msg) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    failures.push(`${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    console.error(`  FAIL: ${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function approx(actual, expected, epsilon, msg) {
  if (Math.abs(actual - expected) <= epsilon) {
    passed++;
  } else {
    failed++;
    failures.push(`${msg} — expected ~${expected}, got ${actual}`);
    console.error(`  FAIL: ${msg} — expected ~${expected}, got ${actual}`);
  }
}

function section(name) {
  console.log(`\n${name}`);
}

// ── Baseline: default new expression ──

const NEW_EXPR = {
  ease_factor: 2.5,
  repetitions: 0,
  interval_days: 0,
  lapse_count: 0,
  production_count: 0,
  status: "learning",
  next_review_date: null,
};

// ============================================================
// SECTION A: SM-2 V2 — Again Rating
// ============================================================
section("A. Again Rating");

// A1: Again on new card → reset to interval 1, reps 0, lapse 1
(() => {
  const r = scheduleExpressionReview("again", NEW_EXPR);
  eq(r.repetitions, 0, "A1a: Again resets reps to 0");
  eq(r.interval_days, 1, "A1b: Again sets interval to 1 day");
  eq(r.lapse_count, 1, "A1c: Again increments lapse_count");
  eq(r.status, "learning", "A1d: Again stays in learning");
  eq(r.stage, "learning", "A1e: Again stays in learning stage");
})();

// A2: Again reduces ease factor (but not below MIN_EF)
(() => {
  const r = scheduleExpressionReview("again", { ...NEW_EXPR, ease_factor: 1.35 });
  assert(r.ease_factor >= MIN_EF, "A2a: EF doesn't go below MIN_EF (1.3)");
  assert(r.ease_factor < 1.35, "A2b: Again reduces EF");
})();

// A3: Again on high-EF card → EF drops but stays >= 1.3
(() => {
  const r = scheduleExpressionReview("again", { ...NEW_EXPR, ease_factor: 2.8, repetitions: 5, interval_days: 30 });
  assert(r.ease_factor >= 1.3, "A3a: Again EF stays >= 1.3 on high EF card");
  eq(r.repetitions, 0, "A3b: Again resets reps even on mature card");
  eq(r.interval_days, 1, "A3c: Again resets interval to 1 on mature card");
  eq(r.lapse_count, 1, "A3d: Again increments lapse from 0");
})();

// A4: Again increments existing lapse count
(() => {
  const r = scheduleExpressionReview("again", { ...NEW_EXPR, lapse_count: 2, repetitions: 3, interval_days: 10 });
  eq(r.lapse_count, 3, "A4: Again increments existing lapse_count (2→3)");
})();

// ============================================================
// SECTION B: SM-2 V2 — Hard Rating (THE FIX)
// ============================================================
section("B. Hard Rating — V2 Fix (no reps reset)");

// B1: Hard on new card → keep reps at 0, interval 1
(() => {
  const r = scheduleExpressionReview("hard", NEW_EXPR);
  eq(r.repetitions, 0, "B1a: Hard keeps reps at 0 on new card");
  eq(r.interval_days, 1, "B1b: Hard gives 1 day on new card");
  eq(r.lapse_count, 0, "B1c: Hard does NOT increment lapse");
})();

// B2: Hard does NOT reset repetitions (THE KEY FIX)
(() => {
  const r = scheduleExpressionReview("hard", {
    ...NEW_EXPR,
    repetitions: 5,
    interval_days: 20,
  });
  eq(r.repetitions, 5, "B2a: Hard KEEPS repetitions at 5 (V2 fix — was reset to 0 before)");
  assert(r.interval_days > 0, "B2b: Hard gives positive interval");
  approx(r.interval_days, 24, 2, "B2c: Hard advances interval at ~1.2x (20 * 1.2 = 24)");
})();

// B3: Hard on high-rep card → keeps reps, modest interval advance
(() => {
  const r = scheduleExpressionReview("hard", {
    ...NEW_EXPR,
    repetitions: 10,
    interval_days: 100,
    ease_factor: 2.5,
  });
  eq(r.repetitions, 10, "B3a: Hard keeps reps at 10");
  eq(r.interval_days, 120, "B3b: Hard advances 100→120 (100 * 1.2)");
})();

// B4: Hard EF adjustment
(() => {
  const r = scheduleExpressionReview("hard", { ...NEW_EXPR, ease_factor: 2.5, repetitions: 3, interval_days: 10 });
  assert(r.ease_factor < 2.5, "B4a: Hard reduces EF slightly");
  assert(r.ease_factor >= MIN_EF, "B4b: Hard EF stays >= 1.3");
})();

// ============================================================
// SECTION C: SM-2 V2 — Good Rating (THE FIX)
// ============================================================
section("C. Good Rating — V2 Fix (no reps reset)");

// C1: Good on new card → reps 1, interval 1
(() => {
  const r = scheduleExpressionReview("good", NEW_EXPR);
  eq(r.repetitions, 1, "C1a: Good increments reps (0→1)");
  eq(r.interval_days, 1, "C1b: Good gives interval 1 on new card");
})();

// C2: Good on first review (reps 0, interval 0) → interval 4
(() => {
  const r = scheduleExpressionReview("good", { ...NEW_EXPR, repetitions: 0 });
  eq(r.repetitions, 1, "C2a: Good reps 0→1");
  eq(r.interval_days, 1, "C2b: Good on 0 interval stays at 1");
})();

// NOTE: The SM-2 "reps===0 && interval===0" case in the original V1 went to 4
// V2: because interval is 0 (explicitly stored), we go into `interval === 0` → 1
// This is intentional for the first review. EF-based growth starts from review 2.

// C3: Good after 1 review (reps=1, interval=1) → EF-based growth
(() => {
  const r = scheduleExpressionReview("good", {
    ...NEW_EXPR,
    repetitions: 1,
    interval_days: 1,
    ease_factor: 2.5,
  });
  eq(r.repetitions, 2, "C3a: Good reps 1→2");
  eq(r.interval_days, 3, "C3b: Good interval grows (1 * 2.5 = 2.5 → 3)");
})();

// C4: Good does NOT reset repetitions (THE KEY FIX)
(() => {
  const r = scheduleExpressionReview("good", {
    ...NEW_EXPR,
    repetitions: 4,
    interval_days: 15,
    ease_factor: 2.3,
  });
  eq(r.repetitions, 5, "C4a: Good KEEPS and increments reps (4→5, was reset to 0 before)");
  eq(r.interval_days, 35, "C4b: Good advances interval (15 * 2.3 = 34.5 → 35)");
})();

// C5: Good at high interval → respects MAX_INTERVAL cap
(() => {
  const r = scheduleExpressionReview("good", {
    ...NEW_EXPR,
    repetitions: 10,
    interval_days: 300,
    ease_factor: 2.5,
  });
  eq(r.interval_days, 365, "C5: Good caps at MAX_INTERVAL (300 * 2.5 = 750, capped at 365)");
  eq(r.repetitions, 11, "C5b: Good increments reps");
})();

// ============================================================
// SECTION D: SM-2 V2 — Easy Rating
// ============================================================
section("D. Easy Rating");

// D1: Easy on new card → reps 1, interval 4
(() => {
  const r = scheduleExpressionReview("easy", NEW_EXPR);
  eq(r.repetitions, 1, "D1a: Easy increments reps (0→1)");
  eq(r.interval_days, 4, "D1b: Easy gives interval 4 on new card");
})();

// D2: Easy on mature card → accelerated growth (1.3x multiplier)
(() => {
  const r = scheduleExpressionReview("easy", {
    ...NEW_EXPR,
    repetitions: 3,
    interval_days: 10,
    ease_factor: 2.5,
  });
  eq(r.repetitions, 4, "D2a: Easy increments reps (3→4)");
  // EF adjusts first: 2.5 + 0.1 = 2.6, then interval = round(10 * 2.6 * 1.3) = round(33.8) = 34
  eq(r.interval_days, 34, "D2b: Easy accelerated interval (10 * 2.6 * 1.3 = 33.8 → 34)");
})();

// D3: Easy EF adjustment (increases more than Good)
(() => {
  const goodR = scheduleExpressionReview("good", { ...NEW_EXPR, ease_factor: 2.5, repetitions: 2, interval_days: 4 });
  const easyR = scheduleExpressionReview("easy", { ...NEW_EXPR, ease_factor: 2.5, repetitions: 2, interval_days: 4 });
  assert(easyR.ease_factor > goodR.ease_factor, "D3: Easy EF increase > Good EF increase");
})();

// D4: Easy caps at MAX_INTERVAL
(() => {
  const r = scheduleExpressionReview("easy", {
    ...NEW_EXPR,
    repetitions: 5,
    interval_days: 300,
    ease_factor: 2.5,
  });
  eq(r.interval_days, 365, "D4: Easy caps at MAX_INTERVAL");
})();

// ============================================================
// SECTION E: Interval Progression (full learning trajectory)
// ============================================================
section("E. Full Learning Trajectory");

// E1: Simulate a "perfect" review sequence (all Easy) from new → maintenance
(() => {
  let state = { ...NEW_EXPR };
  const history = [];

  for (let i = 0; i < 12; i++) {
    state = {
      ease_factor: state.ease_factor,
      repetitions: state.repetitions,
      interval_days: state.interval_days,
      lapse_count: state.lapse_count,
      production_count: state.production_count,
      status: state.status,
      next_review_date: state.next_review_date,
    };
    const r = scheduleExpressionReview("easy", state);
    history.push({ rep: r.repetitions, interval: r.interval_days, stage: r.stage });
    state.repetitions = r.repetitions;
    state.interval_days = r.interval_days;
    state.ease_factor = r.ease_factor;
    state.lapse_count = r.lapse_count;
    state.production_count = i >= 5 ? state.production_count + 1 : state.production_count; // simulate productions
  }

  eq(history[0].interval, 4, "E1a: Review 1 (Easy): interval=4");
  eq(history[0].stage, "learning", "E1b: Review 1 stage=learning");
  assert(history[history.length - 1].interval >= 60, "E1c: Final interval >= 60 days");
  assert(history[history.length - 1].rep >= 8, "E1d: Final reps >= 8");
})();

// E2: Simulate a "mixed" review sequence (Good/Good/Easy pattern)
(() => {
  let state = { ...NEW_EXPR };
  const ratings = ["good", "good", "easy", "good", "easy", "good", "easy", "easy"];
  const intervals = [];

  for (const rating of ratings) {
    state = {
      ease_factor: state.ease_factor,
      repetitions: state.repetitions,
      interval_days: state.interval_days,
      lapse_count: state.lapse_count,
      production_count: state.production_count + 1,
      status: state.status,
      next_review_date: state.next_review_date,
    };
    const r = scheduleExpressionReview(rating, state);
    intervals.push(r.interval_days);
    state.repetitions = r.repetitions;
    state.interval_days = r.interval_days;
    state.ease_factor = r.ease_factor;
    state.lapse_count = r.lapse_count;
    state.production_count = r.production_count;
  }

  // Intervals should grow monotonically (no resets since no Again)
  for (let i = 1; i < intervals.length; i++) {
    assert(intervals[i] >= intervals[i - 1], `E2: Interval grows monotonically: ${intervals[i - 1]} → ${intervals[i]}`);
  }
})();

// E3: Simulate a "lapse and recovery" sequence
(() => {
  let state = { ...NEW_EXPR, repetitions: 4, interval_days: 20, ease_factor: 2.4 };

  // Lapse (Again)
  const r1 = scheduleExpressionReview("again", state);
  eq(r1.repetitions, 0, "E3a: After lapse, reps reset to 0");
  eq(r1.interval_days, 1, "E3b: After lapse, interval reset to 1");
  eq(r1.lapse_count, 1, "E3c: Lapse count incremented");

  // Recovery (Good on the reset state)
  state.repetitions = r1.repetitions;
  state.interval_days = r1.interval_days;
  state.ease_factor = r1.ease_factor;
  state.lapse_count = r1.lapse_count;
  const r2 = scheduleExpressionReview("good", state);
  eq(r2.repetitions, 1, "E3d: Recovery Good reps 0→1");
  // reps=0, interval=1 → Good's "reps===0" branch → interval 4
  eq(r2.interval_days, 4, "E3e: Recovery Good interval starts at 4 (reps=0 fast-track)");

  // Second Good
  state.repetitions = r2.repetitions;
  state.interval_days = r2.interval_days;
  state.ease_factor = r2.ease_factor;
  state.lapse_count = r2.lapse_count;
  const r3 = scheduleExpressionReview("good", state);
  assert(r3.interval_days >= 2, "E3f: Second Good after lapse grows interval");
})();

// ============================================================
// SECTION F: Stage Determination
// ============================================================
section("F. Stage Determination");

// F1: New card → learning
(() => {
  eq(determineStage(0, 0, 0), "learning", "F1: 0/0/0 → learning");
  eq(determineStage(1, 1, 0), "learning", "F1b: 1/1/0 → learning");
  eq(determineStage(2, 4, 0), "learning", "F1c: 2/4/0 → learning");
})();

// F2: 3+ reps → activation
(() => {
  eq(determineStage(3, 5, 0), "activation", "F2a: 3/5/0 → activation");
  eq(determineStage(4, 10, 0), "activation", "F2b: 4/10/0 → activation");
  eq(determineStage(5, 30, 1), "activation", "F2c: 5/30/1 → activation (production threshold not met)");
})();

// F3: 6+ reps + interval≥60 + 2+ productions → production
(() => {
  eq(determineStage(6, 60, 2), "production", "F3a: 6/60/2 → production");
  eq(determineStage(7, 80, 3), "production", "F3b: 7/80/3 → production");
  eq(determineStage(6, 59, 2), "activation", "F3c: 6/59/2 → activation (interval < 60)");
  eq(determineStage(6, 60, 1), "activation", "F3d: 6/60/1 → activation (prod < 2)");
  eq(determineStage(5, 60, 2), "activation", "F3e: 5/60/2 → activation (reps < 6)");
})();

// F4: 8+ reps + interval≥90 → maintenance
(() => {
  eq(determineStage(8, 90, 3), "maintenance", "F4a: 8/90/3 → maintenance");
  eq(determineStage(10, 120, 5), "maintenance", "F4b: 10/120/5 → maintenance");
  eq(determineStage(8, 89, 3), "production", "F4c: 8/89/3 → production (interval < 90, but ≥60 repr≥6 prod≥2)");
  eq(determineStage(8, 60, 3), "production", "F4d: 8/60/3 → production");
})();

// F5: stageToStatus mapping
(() => {
  eq(stageToStatus("learning"), "learning", "F5a: learning → learning");
  eq(stageToStatus("activation"), "review", "F5b: activation → review");
  eq(stageToStatus("production"), "review", "F5c: production → review");
  eq(stageToStatus("maintenance"), "mastered", "F5d: maintenance → mastered");
})();

// ============================================================
// SECTION G: Helper Functions
// ============================================================
section("G. Helper Functions");

// G1: daysUntilDue — future date (use fixed reference to avoid TZ issues)
(() => {
  const fixedNow = new Date("2026-08-09T12:00:00Z");
  const futureStr = "2026-08-16";
  eq(daysUntilDue(futureStr, fixedNow), 7, "G1a: 7 days in future → 7");
})();

// G2: daysUntilDue — today → 0
(() => {
  const today = new Date().toISOString().split("T")[0];
  eq(daysUntilDue(today), 0, "G2a: Today → 0");
})();

// G3: daysUntilDue — past/overdue → 0 (not negative)
(() => {
  const past = new Date();
  past.setDate(past.getDate() - 5);
  const pastStr = past.toISOString().split("T")[0];
  eq(daysUntilDue(pastStr), 0, "G3a: Overdue by 5 days → 0 (not -5, this is the fix)");
})();

// G4: daysUntilDue — null → 0
(() => {
  eq(daysUntilDue(null), 0, "G4a: null → 0 (new card, due now)");
})();

// G5: isDue — null → true
(() => {
  assert(isDue(null), "G5a: null → true (new card)");
})();

// G6: isDue — past date → true
(() => {
  const past = new Date();
  past.setDate(past.getDate() - 1);
  assert(isDue(past.toISOString().split("T")[0]), "G6a: Yesterday → true");
})();

// G7: isDue — today → true
(() => {
  assert(isDue(new Date().toISOString().split("T")[0]), "G7a: Today → true");
})();

// G8: isDue — future → false
(() => {
  const future = new Date();
  future.setDate(future.getDate() + 3);
  assert(!isDue(future.toISOString().split("T")[0]), "G8a: 3 days from now → false");
})();

// G9: isMastered
(() => {
  assert(isMastered({ stage: "maintenance" }), "G9a: maintenance stage → true");
  assert(!isMastered({ stage: "production" }), "G9b: production stage → false");
  assert(!isMastered({ stage: "learning" }), "G9c: learning stage → false");

  // From ExpressionSrsFields
  assert(isMastered({ repetitions: 10, interval_days: 120, production_count: 5 }), "G9d: 10/120/5 → mastered");
  assert(!isMastered({ repetitions: 5, interval_days: 30, production_count: 1 }), "G9e: 5/30/1 → not mastered");
})();

// ============================================================
// SECTION H: Edge Cases
// ============================================================
section("H. Edge Cases");

// H1: Negative EF input → clamped to MIN_EF
(() => {
  const r = scheduleExpressionReview("again", { ...NEW_EXPR, ease_factor: 1.0 });
  assert(r.ease_factor >= MIN_EF, "H1: EF below MIN_EF input → output clamped to 1.3");
})();

// H2: Very high interval with Easy → capped at MAX_INTERVAL
(() => {
  const r = scheduleExpressionReview("easy", {
    ...NEW_EXPR,
    repetitions: 10,
    interval_days: 350,
    ease_factor: 2.5,
  });
  eq(r.interval_days, 365, "H2: 350d Easy → capped at 365");
})();

// H3: Interval 0 with Good → interval 1
(() => {
  const r = scheduleExpressionReview("good", { ...NEW_EXPR, interval_days: 0, repetitions: 1 });
  eq(r.interval_days, 1, "H3: interval=0, reps=1, Good → interval 1 (re-learning)");
})();

// H4: Missing fields (null/undefined) → defaults
(() => {
  const r = scheduleExpressionReview("good", {
    ease_factor: undefined,
    repetitions: undefined,
    interval_days: undefined,
    lapse_count: undefined,
    production_count: undefined,
    status: "new",
    next_review_date: null,
  });
  eq(r.repetitions, 1, "H4a: Missing reps defaults to 0, Good → 1");
  eq(r.interval_days, 1, "H4b: Missing interval defaults to 0, Good → 1");
  eq(r.ease_factor, 2.5, "H4c: Missing EF defaults to 2.5");
})();

// H5: Very low EF → EF floor applies on each review
(() => {
  // Repeated "again" on a card shouldn't push EF below 1.3
  let state = { ...NEW_EXPR, ease_factor: 1.3 };
  for (let i = 0; i < 5; i++) {
    const r = scheduleExpressionReview("again", state);
    state.ease_factor = r.ease_factor;
    state.repetitions = r.repetitions;
    state.interval_days = r.interval_days;
    state.lapse_count = r.lapse_count;
  }
  eq(state.ease_factor, 1.3, "H5: EF floor holds at 1.3 after repeated lapses");
})();

// H6: MAX_INTERVAL cap on Good at high EF
(() => {
  const r = scheduleExpressionReview("good", {
    ...NEW_EXPR,
    repetitions: 20,
    interval_days: 350,
    ease_factor: 2.6,
  });
  eq(r.interval_days, 365, "H6: 350 * 2.6 = 910, capped at 365");
})();

// H7: Hard rounding — 1.2 * 7 = 8.4 → 8
(() => {
  const r = scheduleExpressionReview("hard", {
    ...NEW_EXPR,
    repetitions: 3,
    interval_days: 7,
    ease_factor: 2.5,
  });
  eq(r.interval_days, 8, "H7: Hard 7 * 1.2 = 8.4 → 8");
})();

// H8: Hard at interval 1 → still 1 (max(1, round(1 * 1.2)) = max(1, 1) = 1)
(() => {
  const r = scheduleExpressionReview("hard", {
    ...NEW_EXPR,
    repetitions: 3,
    interval_days: 1,
    ease_factor: 2.5,
  });
  eq(r.interval_days, 1, "H8: Hard at interval 1 stays at 1");
})();

// ============================================================
// SECTION I: Production Count & Stage Interaction
// ============================================================
section("I. Production Count & Stage");

// I1: Production count preserved (not modified by SRS)
(() => {
  const r = scheduleExpressionReview("good", { ...NEW_EXPR, production_count: 3 });
  eq(r.repetitions, 1, "I1a: Good increments reps");
  // production_count is passed through to stage determination but not modified by SRS
  eq(r.stage, "learning", "I1b: 1 rep → always learning regardless of productions");
})();

// I2: With enough reps (6) and interval (60) + 2 productions → production stage
(() => {
  const r = scheduleExpressionReview("good", {
    ...NEW_EXPR,
    repetitions: 6,
    interval_days: 60,
    production_count: 2,
    ease_factor: 2.5,
  });
  eq(r.repetitions, 7, "I2a: Good reps 6→7");
  eq(r.stage, "production", "I2b: 7/60/2 → production stage");
  eq(r.status, "review", "I2c: production stage → review status");
})();

// I3: Without production counts, high reps → activation (not production)
(() => {
  const r = scheduleExpressionReview("easy", {
    ...NEW_EXPR,
    repetitions: 6,
    interval_days: 70,
    production_count: 0,
    ease_factor: 2.5,
  });
  eq(r.stage, "activation", "I3: 7/70/0 → activation (not production, need prod≥2)");
})();

// ============================================================
// SECTION J: Overdue Card Behavior
// ============================================================
section("J. Overdue Card Behavior");

// J1: Overdue card → daysUntilDue returns 0 (not negative)
(() => {
  const past = new Date();
  past.setDate(past.getDate() - 10);
  eq(daysUntilDue(past.toISOString().split("T")[0]), 0, "J1: 10 days overdue → 0 days until due");
})();

// J2: Overdue card reviewed Good → gets new interval based on stored interval_days (not 0)
(() => {
  // The key: even though the card is overdue, interval_days stores the original interval
  const r = scheduleExpressionReview("good", {
    ...NEW_EXPR,
    repetitions: 4,
    interval_days: 30, // Original scheduled interval was 30 days
    ease_factor: 2.3,
    next_review_date: "2026-01-01", // Overdue by months
  });
  eq(r.repetitions, 5, "J2a: Overdue card Good → reps increment normally");
  eq(r.interval_days, 69, "J2b: Overdue card interval based on stored 30d (30 * 2.3 = 69), NOT remaining days");
})();

// J3: Overdue card reviewed Again → lapse
(() => {
  const r = scheduleExpressionReview("again", {
    ...NEW_EXPR,
    repetitions: 3,
    interval_days: 15,
    next_review_date: "2026-01-01",
  });
  eq(r.repetitions, 0, "J3a: Overdue Again → reps reset");
  eq(r.interval_days, 1, "J3b: Overdue Again → interval reset to 1");
  eq(r.lapse_count, 1, "J3c: Overdue Again → lapse incremented");
})();

// ============================================================
// SECTION K: Maintenance / Mastery Exclusion
// ============================================================
section("K. Mastered Card Exclusion");

// K1: Mastered card → not due for daily review
(() => {
  const masteredState = {
    repetitions: 10,
    interval_days: 120,
    production_count: 5,
  };
  assert(isMastered(masteredState), "K1a: High stats → mastered");
})();

// K2: Near-mastery but not quite → not mastered
(() => {
  assert(!isMastered({ repetitions: 7, interval_days: 80, production_count: 3 }), "K2a: 7/80/3 → not mastered (need 8/90)");
  assert(!isMastered({ repetitions: 8, interval_days: 89, production_count: 3 }), "K2b: 8/89/3 → not mastered (interval < 90)");
})();

// K3: scheduleExpressionReview → mastered stage → status=mastered
(() => {
  const r = scheduleExpressionReview("easy", {
    ...NEW_EXPR,
    repetitions: 7,
    interval_days: 80,
    production_count: 3,
    ease_factor: 2.5,
  });
  // 7→8 reps, interval 80→260 (80 * 2.5 * 1.3 = 260)
  eq(r.repetitions, 8, "K3a: reps 7→8");
  eq(r.stage, "maintenance", "K3b: 8/260/3 → maintenance");
  eq(r.status, "mastered", "K3c: maintenance → mastered status");
})();

// ============================================================
// SECTION L: Regression — Bug Confirmation Tests
// ============================================================
section("L. Regression — Old Bugs Confirmed Fixed");

// L1: OLD BUG: estimateInterval used remaining days → overdue=0
// FIX: interval_days is now explicitly stored, never derived from date diff
(() => {
  // Simulate: card was scheduled 30 days, became overdue by 60 days
  const r = scheduleExpressionReview("good", {
    ...NEW_EXPR,
    repetitions: 3,
    interval_days: 30, // This is the KEY: stored interval, not date-derived
    ease_factor: 2.5,
    next_review_date: "2025-01-01", // Massively overdue
  });
  // OLD behavior would have: 0 * 2.5 = 0 (because remaining days = 0)
  // NEW behavior: 30 * 2.5 = 75
  eq(r.interval_days, 75, "L1a: Overdue card uses stored interval_days (30), NOT remaining days (0)");
  // OLD: 30 * 2.5 = 75 ✓ confirmed — old bug would have given 0
})();

// L2: OLD BUG: Hard reset reps to 0
// FIX: Hard keeps repetitions
(() => {
  const r = scheduleExpressionReview("hard", {
    ...NEW_EXPR,
    repetitions: 5,
    interval_days: 20,
  });
  eq(r.repetitions, 5, "L2: Hard keeps reps at 5 (old bug would reset to 0)");
})();

// L3: OLD BUG: Good reset reps to 0
// FIX: Good increments repetitions
(() => {
  const r = scheduleExpressionReview("good", {
    ...NEW_EXPR,
    repetitions: 5,
    interval_days: 20,
  });
  eq(r.repetitions, 6, "L3: Good increments reps 5→6 (old bug would reset to 0)");
})();

// L4: OLD BUG: Only Easy counted as success
// FIX: Good also counts as success (increments reps)
(() => {
  const ratings = ["good", "good", "good", "good", "good"];
  let state = { ...NEW_EXPR };
  for (const rating of ratings) {
    state = {
      ...state,
      ease_factor: state.ease_factor,
      repetitions: state.repetitions,
      interval_days: state.interval_days,
      lapse_count: state.lapse_count,
      production_count: state.production_count,
    };
    const r = scheduleExpressionReview(rating, state);
    state.repetitions = r.repetitions;
    state.interval_days = r.interval_days;
    state.ease_factor = r.ease_factor;
    state.lapse_count = r.lapse_count;
  }
  eq(state.repetitions, 5, "L4: 5 consecutive 'Good' → reps=5 (old bug would stay at 0 after first)");
})();

// ============================================================
// RESULTS
// ============================================================

console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"=".repeat(50)}`);

if (failures.length > 0) {
  console.log(`\nFAILURES:`);
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
} else {
  console.log(`\nAll ${passed} tests passed.`);
  process.exit(0);
}
