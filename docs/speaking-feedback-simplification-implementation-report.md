# Speaking Feedback Simplification Implementation Report

已完成本地最小实现；未部署、未 push、未执行数据库迁移或历史回填。先完成只读审计，再修改代码。审计见 [Speaking Feedback Simplification Audit](speaking-feedback-simplification-audit.md)。

## 1. Current duplicate-answer root cause

主反馈原来一次生成 naturalVersion、finalHighScoreAnswer 和 oneBetterExample 三个答案；随后独立调用 generateReferenceAnswer 再生成第四个。前者要求保留原内容顺序、后者要求结构升级，产品把语言修正和内容优化拆成了相近的学习版本。复述提示词继承整个首次提示词，并要求同等详细输出，再次制造多版本。独立 reference 原来写入历史，却没有在首次结果页显示。

## 2. Old schema

```text
naturalVersion
fluencyScore / grammarScore / vocabularyScore / naturalnessScore
mainProblems / usefulCorrections / betterChunks / oneBetterExample
expressionsUsed / expressionsMissed / expressionUpgrade
contentAnalysis / answerStructure
finalHighScoreAnswer (older alias: structuredBetterAnswer)
diagnosis / keyImprovements / keyUpgrades

Second call: { referenceAnswer }
```

数据库使用 snake_case 列；高分答案实际存于 structured_better_answer，未发现当前代码使用独立 optimized_version 列。有关列在 migration 063、064、066 中已有定义。

## 3. New schema

```ts
{
  final_upgraded_answer: string;
  overall_score: number | null;
  target_score: number | null;
  key_issues: Array<{ type: string; message: string }>;
  revision_mode: "light" | "structure" | "expand" | "trim" | "rewrite" | null;
  optimization_summary: string;
  expansion_notice: string;
  reference_answer: string;
  takeaway_expressions: Array<{
    expression: string; meaning: string; why_useful: string;
  }>;
  detailed_analysis: {
    fluencyScore?: number;
    grammarScore?: number;
    vocabularyScore?: number;
    naturalnessScore?: number;
    usefulCorrections?: string;
    expressionsUsed?: string[];
    expressionsMissed?: string[];
    contentAnalysis?: Record<string, unknown>;
  };
  retry_checks: Array<{ type: string; message: string }>;
}
```

这是客户端归一化契约：正常首次 AI 输出必须提供一个最终答案、评分和合法 revision_mode；缺失/异常的评分与 mode 归一化为 null，避免把缺失评分展示成 0 分。retry_checks 首次为空，复述返回四类检查。详细维度使用 detailed_analysis；旧字段仅在历史读取层兼容，不新增 legacy_analysis 包袱。

模型原始输出通过既有 Edge raw-text 路由返回，前端负责容错解析。主答案字段放在提示词 JSON 的最前面；即使尾部可选字段截断，仍可恢复已完整闭合的主答案字符串。不完整的主答案本身不会被猜补。

## 4. Removed versions

- 删除首次/历史中的自然版、结构化高分版、额外范例等重复卡片，统一成最终优化表达。
- 删除 generateReferenceAnswer 的第二次请求及异步等待，避免参考答案保存时的竞态。
- 删除旧结构骨架、重复诊断、七维评分卡、多表达升级大卡、对应加库处理和无引用组件/解析器。
- 旧列保留；新记录的 natural_version 为空，不再生成其内容。structured_better_answer 仅作为同一个最终答案的存储兼容映射。

## 5. Final Upgraded Answer logic

首次一次调用同时生成一个用户优化答案和一个独立参考答案。提示词明确 “The final upgraded answer is NOT a paraphrase ladder”。先诊断，再按 Relevance → Content → Structure → Grammar/Collocation → Naturalness → Band-level upgrade 处理。

最终答案同时作为首次主卡内容和复述唯一学习目标。generateBetterVersion 也返回这个字段。复述客户端会忽略模型意外返回的新版本，保持首次学习目标不变。

## 6. Revision modes

| Mode | 判断与处理 |
| --- | --- |
| light | 内容逻辑良好，仅语言小修，保留约 80–90% 原表达 |
| structure | 已有足够内容，重排顺序 |
| expand | 观点薄，补解释、影响或假设例子 |
| trim | 跑题或重复，直接删减 |
| rewrite | 多种实质问题并存，整体重组 |

mode 存储但不占用用户界面。复述不进行新一轮 revision 分类。

## 7. Relevance trimming

忠于真实核心观点，不逐句保留。提示词允许删除跑题、低相关、重复和无效铺垫。cooking 的学校/住址/天气例子与大城市案例均在规则或回归样例中覆盖。

## 8. Content expansion

允许合理补充 why、explanation、effect、hypothetical example、result；禁止添加未经提供的工作、日期、关系或经历。所有新增理由/例子必须通过 expansion_notice 标注“参考性展开”。UI 即使缺少该字段，也提示新增内容须按实际情况确认。

新增 speaking_feedback 请求标记，Edge 仅对这类请求停止注入学习、个人资料和经历上下文，并跳过故事资产使用记录，避免把历史故事混入当前回答。其他调用的注入逻辑保持原状。

## 9. Structure optimization

允许按题型自然重排，opinion 与 experience 采用不同组织思路，不强制 STAR。优化思路用 2–4 句中文说明保留、删除、补充和重排的实际变化。

## 10. Grammar/naturalness handling

先语法和搭配，再自然口语节奏与句式变化。禁止机械高级词替换，也不为了固定 7 分目标重写已很好的答案。评分基于文本估计，UI 不声称评估了发音；未改动 ASR、录音或 pronunciation pipeline。

## 11. Reference Answer behavior

与最终答案同次生成，因此可比较两个方向。明确要求选择另一种实质性思路，例如最终答案讲工作机会，参考讲文化生活。参考可用假设场景，但不代表用户真实经历。独立参考默认折叠；malformed/缺失时隐藏，不阻断主答案。

## 12. Takeaway expressions

轻量展示最多四条，归一化层去重，并只保留确实出现在最终答案中的表达。坏数组、空值和不存在于最终答案的短语被忽略。没有有效表达时不显示此板块。

## 13. Historical compatibility

不迁移、不回填、不删除旧记录。完整新契约保存于现有 content_analysis.feedback_v2；content_analysis 顶层仍保留内容诊断。现有评分列、combined_feedback、useful_corrections、表达使用数据、question、transcript、audio 继续保存。

读取优先级：

```text
final_upgraded_answer (including content_analysis.feedback_v2)
→ high_score_version / finalHighScoreAnswer
→ structured_better_answer / structuredBetterAnswer
→ optimized_version / optimizedVersion
→ natural_version / naturalVersion
```

reference_answer 独立读取，不作为用户优化答案。旧 one_better_example 只在独立参考缺失时作为历史参考兜底。历史详情和实时反馈使用同一组件；历史复述只展示检查摘要，不再次摆放多个答案。实际第一轮按 is_retry/attempt_round 选择，并为更老记录保留兜底。

## 14. Mobile UI changes

单列顺序：本轮表现 → 优化思路 → 突出的最终优化表达 → 可选表达 → 折叠的 AI 参考答案。复述参考只剩显示/隐藏同一个答案；后续反馈只展示本轮水平和四项检查。

在本地真实组件预览中检查了 390×844 与 320×740 视口。页面滚动宽度等于 clientWidth（扣除浏览器滚动条后分别为 375、305），未发现横向溢出；参考折叠/展开正常。这是组件视觉和交互验证，不是完整录音流程 E2E。

![口语反馈手机预览](screenshots/speaking-feedback-mobile.png)

## 15. Tests

| 检查 | 结果 |
| --- | --- |
| `npx vitest run src/__tests__/SpeakingFeedback.test.tsx` | 19/19，通过；最终 fixture 文案调整后复跑通过 |
| `npx vitest run English english Sentence AlternativeExpressions SpeakingFeedback PracticeLogSchemaContract` | 20 文件，578/578 通过 |
| `npm test` | 32 文件，741/741 通过 |
| `git diff --check` | 通过 |

覆盖 A–G 的输入传递、单次调用、模式/答案 contract、存储回读、唯一主卡和折叠参考；H 的旧字段优先级和不修改旧对象；还包括 malformed 历史对象、可选数组异常、尾部 JSON 截断、主答案损坏、缺失评分、短语筛选与复述目标不变。

fixtures 是人工编写的期望输出，调用用 mock 替代。它们证明程序正确处理这些输入/输出及异常，不证明真实 LLM 一定遵守语义要求。没有执行在线 LLM 请求、生产写入或麦克风→数据库 E2E。

两个指定 mock 案例的人工质量检查：

**大城市案例：structure**

> I prefer living in big cities because there are more job opportunities and the public transport is very convenient. Although I don't like crowded places, these advantages make big cities a better choice for me.

保留机会与交通便利；crowded 成为让步；删除未支持题意的 boyfriend 信息。参考答案改谈文化活动，不再沿用工作机会主线。

**在家办公案例：expand**

> I prefer working from home because it's convenient. Not having to commute can save time and give me more control over my day. A quiet space at home could also make it easier to focus, while a flexible schedule would allow more room for breaks.

补足 commuting、time control、focus/flexibility，以 can/could/would 表达一般或假设性理由，并标注参考性展开。没有添加 “Last year when I worked at...” 等虚构经历。

## 16. TypeScript

`npx tsc --noEmit` 通过。检查中发现过测试读取 JSONB 展开字段的返回类型过窄，已补明确返回类型并通过复检。项目 tsconfig 不包含 Supabase Deno 目录；本机未提供 deno，因此不把前端 TypeScript 通过等同于 Edge Deno 类型检查。

## 17. Build

`npm run build` 通过，包含 `tsc -b`、Vite/PWA 构建和 placeholder 域名校验。构建提示部分 JS chunk 超过 500 kB；本次未扩大范围做代码分包。Build 不是 E2E。

## 18. Modified files

本任务代码：

- `src/lib/ai/prompts.ts`：首次和复述提示词；移除单独参考生成提示词。
- `src/lib/ai/englishCoach.ts`：新契约、容错解析、单次生成与固定复述目标。
- `src/lib/ai/client.ts`：仅口语反馈的请求标记。
- `supabase/functions/english-coach/index.ts`：该标记下的上下文隔离。
- `src/lib/english/speakingFeedback.ts`：新建归一化、旧记录读取、截断恢复和存储映射。
- `src/components/english/SpeakingFeedbackPanel.tsx`：新建共享精简展示。
- `src/pages/EnglishSpeaking.tsx`：首次/历史/复述接入，删除无引用旧组件和状态。
- `src/__tests__/SpeakingFeedback.test.tsx`、`src/__tests__/fixtures/speaking-feedback-cases.ts`：回归测试与期望样例。

产物：本报告、审计文档、`docs/screenshots/speaking-feedback-mobile.png`。构建更新了工作区已有的 `tsconfig.tsbuildinfo` 缓存。

已按导出函数/常量内容比较确认：prompts.ts 与 englishCoach.ts 中非口语反馈功能未改变。没有修改 SRS、Expression Learn、Reading、Expression Import、sentence scoring、Cloze、Chinese Speaking 或相关数据库 schema。工作区原有 package.json、旧迁移文件等改动未由本任务修改或回滚。

## 19. Remaining risks

- 真正的轻改比例、删减判断、事实边界、参考思路差异依赖模型，尚未做在线语义验收；提示词约束和 fixture 不能保证所有真实回答质量。
- 新 frontend 与 Edge 的 speaking_feedback 隔离标记需要配套发布。若仅发布前端、旧 Edge 忽略标记，仍可能注入历史个人资料。
- 数据库兼容依据本地迁移和调用代码审计，未连接生产核验已应用的迁移或写入权限；没有真实保存链路 E2E。
- 完整闭合的主答案可以从截断 JSON 恢复；主答案自身截断则只能显示重试提示，不能可靠恢复。
- 原有大包体积提示仍存在，Edge Deno 检查未执行。

## 20. Production readiness recommendation

本地实现与自动化验证已完成，建议作为待发布候选。正式发布前需在隔离环境核验 Edge 与前端配套工作，并用 A–G 输入检查真实模型质量和一次首次保存→复述保存→历史回读链路。本次按要求停止：不 deploy，不 git push。
