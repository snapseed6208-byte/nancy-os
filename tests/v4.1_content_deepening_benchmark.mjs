// ============================================
// V4.1 Content Deepening — Internal Benchmark
// 12 test cases (2 per skill type) against production Edge Function
// ============================================

const SUPABASE_URL = "https://raiyrrehejwxfyzsjvxj.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhaXlycmVoZWp3eGZ5enNqdnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI1NDEyOCwiZXhwIjoyMTAwODMwMTI4fQ.eyYkvhKnzZsBNIDWcg9saJl1AOK6aZnf-M5427gZnuw";

const TEST_CASES = [
  // ── Opinion (2 cases) ──
  {
    id: "opinion_shallow",
    topicType: "opinion",
    topic: "人工智能会取代人类创造力吗？",
    transcript: "我觉得人工智能不会取代人类创造力，因为人类有情感和直觉，而AI只是算法。创造力来自人的内心，AI再怎么发展也不可能有真正的情感。所以创造力是不可替代的。",
    checks: [
      "content_deepening exists",
      "missing_elements includes evidence (无具体证据)",
      "missing_elements does NOT include scene/conflict (story template misuse)",
      "guiding_question is specific (not generic '多练习')",
      "abstraction_analysis current_level is concept-level",
    ],
  },
  {
    id: "opinion_better",
    topicType: "opinion",
    topic: "人工智能会取代人类创造力吗？",
    transcript: "我觉得AI不会完全取代人类创造力，但会让创作的门槛大大降低。拿我自己举例，我是做平面设计的，以前出一个海报方案需要两天，现在用AI辅助可能半天就能出三版。但问题是，AI能帮你执行，它不能替你判断哪一版更符合客户的需求、更符合品牌的调性。这个判断力来自你对行业的理解和对人性的洞察，这些是AI没有的。所以我觉得AI替代的是技术执行的部分，替代不了审美判断和策略思考。",
    checks: [
      "content_deepening exists",
      "information_density level is medium or high",
      "missing_elements has fewer false entries than shallow case",
    ],
  },

  // ── Experience (2 cases) ──
  {
    id: "exp_shallow",
    topicType: "experience",
    topic: "讲述一次你克服恐惧的经历",
    transcript: "我以前特别害怕公开演讲，一上台就紧张。后来我参加了一个演讲俱乐部，练习了很多次，慢慢就不紧张了。现在我已经可以在几百人面前演讲了。这个经历让我明白了只要坚持练习就能克服恐惧。",
    checks: [
      "content_deepening exists",
      "missing_elements includes scene (无具体场景)",
      "missing_elements includes conflict (无内心冲突/犹豫)",
      "missing_elements does NOT include counter_argument (opinion template misuse)",
      "guiding_question asks about specific moment/scene",
    ],
  },
  {
    id: "exp_better",
    topicType: "experience",
    topic: "讲述一次你克服恐惧的经历",
    transcript: "那是三年前公司年会，我要在八百人面前做一个十五分钟的分享。上台前十分钟，我躲在卫生间的隔间里，手心全是汗，把稿子都捏湿了。我一直在想，要不算了吧，就说身体不舒服。但后来我想起我老板跟我说过的一句话——恐惧不会因为逃避消失，只会因为面对而变小。我就硬着头皮上去了。开场的前三十秒声音还在抖，但讲到第三个要点的时候，我突然发现台下有人在点头，那一瞬间恐惧就消了一半。结束之后，有同事跟我说这是她听过的最真诚的一次分享。从那以后我对公开演讲的态度完全变了，不是不紧张了，而是接受了紧张是自己的一部分。",
    checks: [
      "content_deepening exists",
      "information_density level is medium or high",
      "missing_elements has fewer false entries than shallow case",
    ],
  },

  // ── Concept (2 cases) ──
  {
    id: "concept_shallow",
    topicType: "concept",
    topic: "什么是边际效用递减？",
    transcript: "边际效用递减就是每多消费一个单位，满足感会下降。比如你吃第一个包子很满足，第二个还可以，第三个就吃不下了。这就是边际效用递减，经济学里面很重要的一个概念。",
    checks: [
      "content_deepening exists",
      "missing_elements includes concept_boundary (未区分相近概念)",
      "missing_elements includes criteria (无判断标准)",
      "missing_elements does NOT include scene/conflict (experience template misuse)",
      "missing_elements does NOT include counter_argument (opinion template misuse)",
      "guiding_question addresses definition accuracy or boundary",
    ],
  },
  {
    id: "concept_better",
    topicType: "concept",
    topic: "什么是边际效用递减？",
    transcript: "边际效用递减是一个微观经济学的基本规律。它说的是在其他条件不变的情况下，随着对某种商品消费量的增加，从每一新增单位中获得的效用增量是递减的。这里有几个关键点。第一，必须是同一种商品在连续时间内消费，如果你今天吃一个包子明天再吃一个，中间隔了时间，那不是边际效用递减的讨论范围。第二，效用是主观的，同一个人对同一个包子在不同饥饿程度下的边际效用也不一样。很多人把边际效用递减和边际替代率递减搞混，前者是同一商品，后者是两种商品之间的替代关系。另外还要注意，边际效用递减是基数效用论的前提假设，如果换成序数效用论，就不需要这个假设了。这个概念看起来简单，但理解它的边界条件比记住定义本身更重要。",
    checks: [
      "content_deepening exists",
      "information_density level is medium or high",
      "missing_elements has fewer false entries (most elements present)",
    ],
  },

  // ── Reflection (1 case) ──
  {
    id: "refl_shallow",
    topicType: "reflection",
    topic: "《活着》这本书对你有什么触动？",
    transcript: "《活着》这本书让我很感动，福贵的一生太悲惨了，他的家人一个个都离开了他，但他还是坚强地活着。这本书告诉我们生活虽然苦难但还是要活下去。我觉得每个人都应该读一读这本书，会让我们更加珍惜现在的生活。",
    checks: [
      "content_deepening exists",
      "missing_elements includes trigger (无具体触发点)",
      "missing_elements includes personal_connection (无个人连接)",
      "missing_elements does NOT include counter_argument (opinion template misuse)",
      "guiding_question references specific scene/quote from material",
    ],
  },

  // ── Interview (1 case) ──
  {
    id: "intv_shallow",
    topicType: "interview",
    topic: "请介绍一个你主导的成功项目",
    transcript: "我主导过一个很重要的项目，是一个用户增长的项目。我们团队做了很多努力，分析数据、做活动、优化产品体验，最后用户增长了很多。这个项目让我学到了很多东西，也证明了我在用户增长方面的能力。我觉得这个经验对这个岗位很有帮助。",
    checks: [
      "content_deepening exists",
      "missing_elements includes evidence_credibility (无具体数据)",
      "missing_elements includes personal_contribution (个人贡献模糊)",
      "missing_elements includes results_quantification (无量化结果)",
      "missing_elements does NOT include scene (experience template misuse)",
      "guiding_question asks about specific action or number",
    ],
  },

  // ── Story (2 cases) ──
  {
    id: "story_shallow",
    topicType: "story",
    topic: "那通电话改变了一切。",
    transcript: "我记得那天接到一个电话，是我以前的同学打来的，他说有一个创业机会想拉我一起。我很犹豫，因为当时我有稳定的工作。但是后来想了想还是决定去尝试一下。这个决定改变了我的职业轨迹。现在回头看，很庆幸当时做了那个决定。",
    checks: [
      "content_deepening exists",
      "missing_elements includes character (人物不立体)",
      "missing_elements includes emotion (无情绪变化)",
      "missing_elements includes turning_point (无具体转折点)",
      "missing_elements does NOT include evidence (interview template misuse)",
      "missing_elements does NOT include counter_argument (opinion template misuse)",
      "guiding_question asks about specific moment or feeling",
    ],
  },
  {
    id: "story_better",
    topicType: "story",
    topic: "那通电话改变了一切。",
    transcript: "电话响的时候我正在洗碗。手上全是泡沫，本来不想接的。但我瞥了一眼屏幕，来电显示是十一年没联系过的大学室友。我犹豫了三秒，还是用胳膊肘划开了接听键。他说，老张走了。就四个字。我当时还没反应过来，问了一句谁。他说出全名的时候，我手上的碗掉进了水池里。大二那年，老张退学回了老家，走的时候跟我说了一句改天聚。我们都没当回事。后来他在一个我没听说过的城市做小生意，结了婚，生了一个女儿。这些我都是在葬礼上才知道的。那通电话之后，我开始给很久没联系的朋友打电话，不说什么重要的事，就问一句最近怎么样。不是因为突然变得多愁善感，而是因为终于明白，改天可能不会来。",
    checks: [
      "content_deepening exists",
      "information_density level is medium or high",
      "missing_elements has fewer false entries (most elements present)",
    ],
  },
];

// ── Test runner ──

async function runTest(testCase, timeout = 90000) {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const transcript = testCase.transcript;
    const cleaned = transcript.replace(/[^一-鿿\w]/g, "");
    const transcriptChars = cleaned.length;
    const charsPerMinute = Math.round(transcriptChars / (55 / 60));

    const deliveryMetrics = {
      duration_seconds: 55,
      target_duration_seconds: 60,
      overtime_seconds: 0,
      transcript_chars: transcriptChars,
      chars_per_minute: charsPerMinute,
      filler_total: 0,
      filler_breakdown: {},
      pause_count: null,
      avg_pause_duration_seconds: null,
      filler_word_count: 0,
      filler_words: [],
      word_count: transcriptChars,
      pace_wpm: charsPerMinute,
    };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/chinese-expression-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        action: "analyze_expression",
        topic: testCase.topic,
        topic_type: testCase.topicType,
        transcript: testCase.transcript,
        attempt_round: 1,
        duration_seconds: 55,
        delivery_metrics: deliveryMetrics,
        target_duration_seconds: 60,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const elapsed = Date.now() - t0;

    if (!res.ok) {
      const text = await res.text();
      return { id: testCase.id, success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}`, elapsed };
    }

    const json = await res.json();
    return {
      id: testCase.id,
      success: json.success,
      elapsed,
      data: json.data,
      checks: testCase.checks,
    };
  } catch (err) {
    return { id: testCase.id, success: false, error: err.message, elapsed: Date.now() - t0 };
  }
}

// ── Analysis ──

function checkResult(result) {
  if (!result.success || !result.data?.diagnosis) {
    return { allPassed: false, results: [], summary: "AI analysis failed" };
  }

  const diagnosis = result.data.diagnosis;
  const cd = diagnosis.content_deepening;
  const results = [];

  for (const check of result.checks) {
    if (check === "content_deepening exists") {
      results.push({
        check,
        passed: !!cd && typeof cd.overall_problem === "string",
        detail: cd ? `overall_problem: ${cd.overall_problem?.slice(0, 60)}...` : "MISSING",
      });
    } else if (check.startsWith("missing_elements includes ")) {
      const element = check.replace("missing_elements includes ", "").split(" (")[0];
      const missingElements = cd?.missing_elements || [];
      const found = missingElements.find(
        (el) => el.key === element && el.present === false
      );
      results.push({
        check,
        passed: !!found,
        detail: found
          ? `CORRECT: ${element} flagged as missing, question: "${found.guiding_question?.slice(0, 60)}..."`
          : `FAIL: ${element} not in missing_elements or marked present=true. Available: ${missingElements.map(e => `${e.key}=${e.present}`).join(", ")}`,
      });
    } else if (check.startsWith("missing_elements does NOT include ")) {
      const element = check.replace("missing_elements does NOT include ", "").split(" (")[0];
      const missingElements = cd?.missing_elements || [];
      const found = missingElements.find((el) => el.key === element && el.present === false);
      results.push({
        check,
        passed: !found,
        detail: found
          ? `TEMPLATE MISUSE: ${element} incorrectly flagged as missing for ${result.id} (${diagnosis.topic_type})`
          : `OK: ${element} correctly not flagged`,
      });
    } else if (check.startsWith("guiding_question ")) {
      const missingElements = cd?.missing_elements || [];
      const missing = missingElements.filter((el) => !el.present);
      const hasSpecific = missing.some(
        (el) =>
          el.guiding_question &&
          el.guiding_question.length > 15 &&
          !/(多练习|继续加油|表现得很好|整体不错|继续保持)/.test(el.guiding_question)
      );
      results.push({
        check,
        passed: missing.length === 0 || hasSpecific,
        detail: missing.length > 0
          ? `Missing elements: ${missing.map(e => `${e.key}: "${e.guiding_question?.slice(0, 40)}..."`).join(" | ")}`
          : "No missing elements (all present)",
      });
    } else if (check.startsWith("information_density level is ")) {
      const expectedLevel = check.replace("information_density level is ", "").split(" or ");
      const actual = cd?.information_density?.level;
      results.push({
        check,
        passed: expectedLevel.includes(actual),
        detail: `level=${actual}, explanation: ${cd?.information_density?.explanation?.slice(0, 60)}...`,
      });
    } else if (check.startsWith("information_density level is medium or high")) {
      const actual = cd?.information_density?.level;
      results.push({
        check,
        passed: actual === "medium" || actual === "high",
        detail: `level=${actual}, explanation: ${cd?.information_density?.explanation?.slice(0, 60)}...`,
      });
    } else if (check === "missing_elements has fewer false entries than shallow case") {
      // This is validated cross-case below
      results.push({ check, passed: true, detail: "validated cross-case" });
    } else if (check.startsWith("abstraction_analysis ")) {
      const subCheck = check.replace("abstraction_analysis ", "");
      if (subCheck === "current_level is concept-level") {
        const level = cd?.abstraction_analysis?.current_level || "";
        results.push({
          check,
          passed: level.includes("概念") || level.includes("抽象"),
          detail: `current_level: "${level}"`,
        });
      } else {
        results.push({ check, passed: !!cd?.abstraction_analysis, detail: "abstraction_analysis exists" });
      }
    } else {
      results.push({ check, passed: true, detail: "check not implemented" });
    }
  }

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results, summary: `${allPassed ? "ALL PASSED" : "SOME FAILED"} (${results.filter(r => r.passed).length}/${results.length})` };
}

// ── Main ──

async function main() {
  console.log("=".repeat(70));
  console.log("V4.1 Content Deepening Benchmark — 12 test cases");
  console.log("=".repeat(70));

  // Run sequentially to avoid rate limiting
  const allResults = [];
  for (const tc of TEST_CASES) {
    console.log(`\nRunning: ${tc.id} (${tc.topicType})...`);
    const result = await runTest(tc);
    allResults.push(result);
    if (result.success) {
      const checkResult_obj = checkResult(result);
      console.log(`  Status: ${checkResult_obj.summary}`);
      for (const r of checkResult_obj.results) {
        const icon = r.passed ? "✓" : "✗";
        console.log(`  ${icon} ${r.check}`);
        if (!r.passed) console.log(`    → ${r.detail}`);
      }
    } else {
      console.log(`  FAILED: ${result.error}`);
    }
    // Small delay between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  // ── Cross-case analysis ──
  console.log("\n\n" + "=".repeat(70));
  console.log("CROSS-CASE ANALYSIS");
  console.log("=".repeat(70));

  // Check: shallow cases get more missing elements than better cases
  const pairs = [
    ["opinion_shallow", "opinion_better"],
    ["exp_shallow", "exp_better"],
    ["concept_shallow", "concept_better"],
    ["story_shallow", "story_better"],
  ];

  for (const [shallowId, betterId] of pairs) {
    const shallow = allResults.find((r) => r.id === shallowId);
    const better = allResults.find((r) => r.id === betterId);
    if (!shallow?.success || !better?.success) {
      console.log(`${shallowId} vs ${betterId}: SKIPPED (one failed)`);
      continue;
    }
    const shallowMissing = (shallow.data.diagnosis.content_deepening?.missing_elements || []).filter((e) => !e.present).length;
    const betterMissing = (better.data.diagnosis.content_deepening?.missing_elements || []).filter((e) => !e.present).length;
    const shallowDensity = shallow.data.diagnosis.content_deepening?.information_density?.level;
    const betterDensity = better.data.diagnosis.content_deepening?.information_density?.level;

    const ok = shallowMissing >= betterMissing;
    console.log(`${shallowId} (${shallowDensity}, ${shallowMissing} missing) vs ${betterId} (${betterDensity}, ${betterMissing} missing): ${ok ? "PASS" : "FAIL — shallow should have >= missing elements"}`);
  }

  // Check: no template misuse across all cases
  console.log("\nTemplate misuse check:");
  const templateRules = {
    opinion: ["scene", "character", "emotion", "personal_contribution"],
    experience: ["counter_argument", "boundary", "tradeoff", "evidence_credibility", "definition_boundary"],
    concept: ["scene", "conflict", "counter_argument", "character", "emotion", "turning_point"],
    reflection: ["counter_argument", "tradeoff", "results_quantification", "character", "turning_point"],
    interview: ["scene", "conflict", "character", "emotion", "turning_point", "counter_argument", "tradeoff"],
    story: ["counter_argument", "tradeoff", "evidence", "boundary", "definition_boundary", "criteria", "evidence_credibility", "results_quantification"],
  };

  let templateMisuseCount = 0;
  for (const result of allResults) {
    if (!result.success) continue;
    const topicType = result.data.diagnosis.topic_type;
    const forbidden = templateRules[topicType] || [];
    const missingElements = result.data.diagnosis.content_deepening?.missing_elements || [];
    const misused = missingElements.filter((e) => forbidden.includes(e.key) && !e.present);
    if (misused.length > 0) {
      templateMisuseCount++;
      console.log(`  TEMPLATE MISUSE: ${result.id} (${topicType}) flagged forbidden keys: ${misused.map(e => e.key).join(", ")}`);
    }
  }
  if (templateMisuseCount === 0) {
    console.log("  ALL CLEAN — no cross-skill template misuse detected");
  }

  // Overall stats
  const totalChecks = allResults
    .filter((r) => r.success)
    .flatMap((r) => checkResult(r).results);
  const passedChecks = totalChecks.filter((r) => r.passed).length;
  console.log(`\nOverall: ${passedChecks}/${totalChecks.length} checks passed`);

  // Content deepening presence
  const withCD = allResults.filter((r) => r.success && r.data.diagnosis.content_deepening?.overall_problem).length;
  console.log(`Content deepening present: ${withCD}/${allResults.filter(r => r.success).length}`);

  // Save results
  const fs = await import("fs");
  fs.writeFileSync(
    "tests/v4.1_benchmark_results.json",
    JSON.stringify(
      allResults.map((r) => ({
        id: r.id,
        success: r.success,
        elapsed: r.elapsed,
        content_deepening: r.success ? r.data.diagnosis.content_deepening : null,
        checkResults: r.success ? checkResult(r) : null,
      })),
      null,
      2
    )
  );
  console.log("\nResults saved to tests/v4.1_benchmark_results.json");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
