# English Learning Flow Integrity Report

**Date:** 2026-08-10
**Scope:** English Expression Builder V4.1 — Learning Flow Integrity + Adaptive Learning Material（正式学习流程收口修复）
**Commit:** `5d6d5aa`（已推送 master，Cloudflare Pages 自动部署中）
**Migration:** `093_learn_progress.sql`（已应用至 production）
**Edge Function:** `english-coach` 已重新部署

---

## 1. Step 5 点击无反应的真实 root cause

**根因：`expression_reviews` 表存在 `user_id UUID NOT NULL` 约束，但旧 `completeExpression` 插入时没有传 `user_id`。**

production schema 实测（`supabase db query` 验证 `user_id` 为 `NOT NULL`）：

- Postgres 抛 `23502 not_null_violation`
- 旧 `completeExpression` 没有任何 `try/catch`，错误变成 unhandled promise rejection
- `finally { setCompleting(false) }` 仍执行，但 `setCompletedExpressions` / `setCurrentIndex`（推进 1/5→2/5 的代码）永远不执行
- 结果：按钮看似可点、无报错、无推进、无完成

**修复**（[EnglishLearn.tsx:265](src/pages/EnglishLearn.tsx:265)）：

```typescript
const { error: revErr } = await supabase.from("expression_reviews").insert({
  user_id: session.userId, // ← 关键修复：NOT NULL 列
  expression_id: item.expressionId,
  result: rating,
  previous_interval: 0,
  new_interval: srs.interval_days,
  review_mode: "learn",
});
```

同时整个 `completeCurrent` 外包 `try/catch`，任何失败都会 `setError("完成失败：…")` 并显示可见错误条，不再静默失败。

---

## 2. 为什么原来存在大量空页面

原来的 6-step 流程把「用法搭配」「记忆技巧」设为**独立强制步骤**。当表达式的 `common_patterns` / `memory_tip` 字段为 NULL（老数据大量存在），这些步骤整页渲染「暂无额外用法信息」「暂无记忆技巧」，空内容仍占据完整学习步骤。

本质：**可选内容被当成了必选步骤。**

修复：可选字段不再是独立步骤，而是 Stage 2「场景与用法」内部的**内容模块**，有内容才显示，无内容整体隐藏，永不出现「暂无」占位页。

---

## 3. 原 6-step 如何改为 4-stage

| 原 6-step | 新 4-stage | 说明 |
|-----------|-----------|------|
| 1 理解表达 | 1 理解表达（understand） | 不变 |
| 2 场景背景 | 2 场景与用法（contextUsage） | 合并场景/用法/搭配/记忆为可选模块 |
| 3 用法搭配 | ↳（并入 Stage 2，可选模块） | 有资料才显示 |
| 4 记忆技巧 | ↳（并入 Stage 2，可选模块） | 有资料才显示 |
| 5 主动回忆 | 3 主动回忆（recall） | 状态机 idle→checking→result |
| 6 个人造句 | 4 个人造句（production） | 真正的完成按钮唯一所在 |

常量定义：[EnglishLearn.tsx:54](src/pages/EnglishLearn.tsx:54)

```typescript
const STAGE_ORDER: LearnStage[] = ["understand", "contextUsage", "recall", "production"];
```

**FINAL PRODUCT CONTRACT** 对齐：UNDERSTAND → CONTEXT & USAGE → RECALL → PRODUCE → LEARNED。

---

## 4. Optional field 如何处理

`buildLearningMaterial`（[learningMaterial.ts](src/lib/english/learningMaterial.ts)）把所有可选字段归一化：

- 缺失 / 空白 / 纯空格 → `null` 或空数组
- **绝不生成「暂无」占位字符串**
- 返回 `hasEnrichment`、`sparse` 标记

UI 端（[EnglishLearn.tsx:539](src/pages/EnglishLearn.tsx:539)）：

```typescript
const hasAny =
  material.examples.length > 0 || material.contexts.length > 0 ||
  material.patterns.length > 0 || material.usageNotes.length > 0 ||
  material.mistakes.length > 0 || material.memoryTip !== null || material.synonyms !== null;
```

只有 `hasAny` 为 true 才渲染模块区；完全无资料时只显示一行轻量提示「当前资料较精简，先通过例句理解用法即可。」——不再有整页空状态。

**没有资料 ≠ 空页面。**

---

## 5. Learning Material Normalizer 实现在哪里

`src/lib/english/learningMaterial.ts`，单一来源：

- `buildLearningMaterial(expr)` → 归一化 `LearningMaterial`（core + examples/contexts/patterns/usageNotes/mistakes/memoryTip/synonyms + hasEnrichment/sparse）
- `normalizeAnswer(raw)` → trim / 小写 / 折叠空白 / 去标点
- `checkRecallAnswer(userAnswerRaw, correctAnswerRaw)` → `"correct" | "partial" | "incorrect"`（内容词覆盖率 ≥60% 判 partial）

所有学习 UI 消费归一化后的 material，不再对 raw DB 字段做逐段 null 检查。

---

## 6. Recall state machine

类型：[EnglishLearn.tsx:63](src/pages/EnglishLearn.tsx:63)

```typescript
type RecallPhase = "idle" | "checking" | "result";
```

- `idle`：输入框 + 检查按钮，未检查
- `checking`：`checkRecallAnswer` 计算中（同步纯函数，瞬时）
- `result`：显示结果盒（correct / partial / incorrect + 反馈 + score）
  - `correct → score 5`
  - `partial → score 3`
  - `incorrect → score 1`

result 状态下可「重新想一次」回 idle。**只有 `result` 状态允许继续进入 Stage 4 并完成。**

---

## 7. 为什么 Stage 3 不再出现「完成学习」

完成按钮只在 StageNav 的 `stage === "production"` 分支渲染（[EnglishLearn.tsx:884](src/pages/EnglishLearn.tsx:884)）。

Stage 3（recall）的导航是：
- idle：`[上一步]`
- result：`[重新想一次] [继续个人造句]`

没有任何「完成」按钮。完成语义只属于 Stage 4，避免「Step 5 顶部有 Step 6、底部却显示完成学习」的错位。

---

## 8. 真正 Learning completion 发生在哪里

`completeCurrent`（[EnglishLearn.tsx:276](src/pages/EnglishLearn.tsx:276)），且只能在 Stage 4 触达。

入口守卫：
- `if (!currentItem || !session || completing) return;`
- `if (completedSet.has(currentItem.expressionId)) return;`（幂等）
- `if (recallPhase !== "result" || !recallOutcome)` → 提示「请先完成「主动回忆」检查」

完成时按序执行：
1. 保存个人造句（如有）
2. item → `status: "completed"`，写入 recallScore / sentenceScore
3. 记录 `expression_practice_logs`（`mode: "learn"` + metadata）
4. `initializeSrs`（幂等初始化 SRS）
5. 推进到下一表达 或 显示 Summary

---

## 9. 完成 1 条如何从 1/5 进入 2/5

[EnglishLearn.tsx:329](src/pages/EnglishLearn.tsx:329)：

```typescript
if (currentIndex < items.length - 1) {
  const nextIdx = currentIndex + 1;
  setCurrentIndex(nextIdx);          // 2/5
  resetExpressionState();            // 清空 recall/sentence 状态
  setStage("understand");            // 回到 Stage 1
  persistProgress(nextIdx, "understand"); // 持久化 resume 点
} else {
  setShowSummary(true);              // 最后一条 → Summary
}
```

页面顶部 `progress` 显示 `${currentIndex + 1} / ${items.length}`，即 `1 / 5 → 2 / 5`。

---

## 10. Session resume 如何工作

持久化：`review_sessions.learn_progress`（JSONB，migration 093）存 `{ expression_index, stage }`。

- 每次 `goToStage` 调用 `saveProgress.mutate` 写入当前 `(index, stage)`
- 重新进入页面时，resume effect（[EnglishLearn.tsx:123](src/pages/EnglishLearn.tsx:123)）：
  1. 读取 `session.learnProgress.expressionIndex`
  2. `while (idx < items.length && isItemFinished(items[idx])) idx++;` — 跳过已完成 item
  3. 若全部完成 → 直接 `setShowSummary(true)`
  4. 否则 `setCurrentIndex(idx)` + `setStage(saved.stage)`

`isItemFinished` = `item.status === "completed"` 或 `expression.status ∈ {review, mastered}`（说明该表达已进入复习循环）。

**单一 source of truth**：`learn_progress` 是 resume 点；组件 state 只反映当前渲染；React Query 数据是会话内容。三者职责分离，互不重复控制同一个状态。

---

## 11. SRS initialization 是否幂等

**是。** `initializeSrs`（[EnglishLearn.tsx:232](src/pages/EnglishLearn.tsx:232)）开头守卫：

```typescript
if (expression.status !== "collected" && expression.status !== "learning") return;
```

- 只有「从未进入复习循环」的表达（collected / learning）才初始化
- 已处于 review / mastered 的表达直接跳过，**绝不覆盖已有复习历史**
- rating：`score >= 3 → "good"`，否则 `"hard"`；首次 interval ~1 天
- 完成后 `expressions.status → "review"`、设置 `learned_at`、`next_review_date`、`review_count = 1`，并写入一条 `expression_reviews`（`review_mode: "learn"`）

**learned ≠ mastered**：首次学习完成只进入 `review`（repetitions=1，interval~1天），需 SRS 多轮复习才可能升 `mastered`。

---

## 12. AI 失败是否会阻塞 Learning

**不会。** Stage 4 采用 save-before-AI：

1. 先 `updateItem` 把 `user_sentence` 写入 DB（失败才真正报错并允许重试）
2. 再异步 `evaluatePersonalSentence`（`runSentenceAI`，带 `try/catch`）

AI 失败 → `sentencePhase = "aiFailed"`，UI 显示「句子已保存，AI反馈暂时不可用。」+ `[重试AI反馈]` 按钮。

完成按钮 `disabled={busy}` 只在 `sentencePhase === "submitting"` 时禁用；`aiFailed` 状态不阻塞完成，用户可直接点「完成本条学习」。

**AI 失败 ≠ 学习失败。**

---

## 13. 是否修改 schema

是，一处：

- **migration `093_learn_progress.sql`**：`ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS learn_progress JSONB;`
  - 已通过 `supabase migration up --linked` 应用，production 验证列存在（jsonb）

未改动的表/约束：`expressions`、`expression_reviews`、`expression_practice_logs`、`review_sessions`（092 的 UNIQUE 约束上一轮已改）。本次没有新增第二张 Expression 表。

---

## 14. TypeScript

`npx tsc --noEmit` **通过，0 错误**。

修复过程中处理了一处类型问题：`useUpdateSessionItem` 的 `sentenceScore` 字段类型从 `number` 放宽为 `number | null`，因为 DB 列 `sentence_score` 可空。

---

## 15. Build

`npm run build` **通过**（tsc -b + vite build + build:verify）：

```
✓ built in 40.13s
Build verified: no placeholder found.
```

Cloudflare Pages 已由 push 触发自动部署。

---

## 16. Tests

`npx vitest run` → **257 passed / 257**（2 个测试文件，0 失败）。

新增 25 个学习流程回归测试（追加在 `EnglishReviewV3.test.tsx`，Part 27 契约）：

- **MATERIAL 1-5**：富资料全字段 / 稀疏表达无占位 / 缺 memory_tip 不建空模块 / 纯空白字段清洗 / 单可选字段 sparse 标记
- **FLOW 6-12**：4-stage 顺序与中文标签 / Stage3 无「完成学习」/ 完成按钮只在 Stage4 / recall 必须已检查 / 1/5→2/5 / 答案归一化（"Have an opportunity to" == "have an opportunity to"）/ 完成最小值
- **COMPLETION 13-16**：双击不重复推进 / item 标记完成+记录日志 / SRS 初始化幂等 / 错误可见可重试
- **RESUME 17**：restore expressionIndex + stage，跳过已 finished item
- **SRS 18-20**：learn 完成进入 review / learned≠mastered / 已有复习历史不被覆盖
- **AI 21-23**：save-before-AI / AI 失败不阻塞完成 / 重试可用
- **ERROR 24-25**：变异错误可见 / 错误后可重试且不丢输入

---

## 17. Browser E2E

代码已部署，但**本轮未做自动化浏览器 E2E**（环境无 headless 浏览器驱动）。以下为待人工验证的 production-like 流程（Part 28 契约）：

- [ ] 5 个表达（资料完整 / 缺 memory_tip / 缺 common_patterns / 只有 example_sentence / 资料极少）逐个完整学习，确认**无任何空白强制步骤**
- [ ] 完成 1 条 → 自动 2/5 → … → 5/5 → Summary
- [ ] 中途退出 + 刷新 → resume 到正确表达和阶段
- [ ] AI 失败 → 「句子已保存，AI反馈暂时不可用」→ 仍可完成
- [ ] 快速连续点击「完成」→ 不重复推进、不报错

---

## 18. Known limitations

1. **无浏览器自动化 E2E**：生产流程已部署，但需人工按上面清单过一遍 5 类表达。
2. **已完成但本次未重构的部分**（沿用上一轮 V4 成果）：复习三模式、SRS 算法本身未改（符合 PART 30 约束）。
3. **学习强度设置未实现**：`daily_learn_target` / `daily_review_target` 仍在 `fetchOrCreateSession` 侧（沿用固定队列）。「学习新表达 N 条 / 天」的偏好设置属于后续轮次。
4. **learningMaterial 判分阈值**：`≥60% 内容词覆盖率 = partial` 为启发式，短表达或专有名词可能误判；已提供「重新想一次」兜底。
5. **AI 反馈重试依赖 `english-coach` 边函数**：已重新部署；若边缘网络不可用，走 `aiFailed` 降级路径（不阻塞学习）。
6. **sparse 表达的教学体验**：只有 english+chinese 的旧数据可正常学完，但缺少用法内容，学习深度受限（后续可用 `generate_learn_content` 富化，属于可选增强）。

---

## 状态结论

- [x] 根因修复（`user_id` + 错误可见化）
- [x] 4-stage 流程（无「暂无」占位页）
- [x] Optional field 归一化
- [x] Recall 状态机
- [x] 完成按钮唯一化（仅 Stage 4）+ 幂等
- [x] 1/N → 2/N 推进
- [x] Resume（learn_progress JSONB）
- [x] SRS 初始化幂等
- [x] AI 失败不阻塞
- [x] Schema（migration 093 已应用）
- [x] TypeScript / Build / Tests（257 pass）
- [x] 已提交推送部署（commit `5d6d5aa`，edge function `english-coach` 已部署）
- [ ] 浏览器 E2E 人工验证（清单见 Q17）
