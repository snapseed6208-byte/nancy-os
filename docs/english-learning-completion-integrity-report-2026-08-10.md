# English Learning Completion Integrity Report

**Date:** 2026-08-10
**Scope:** English Learning V4.1 — Learning Completion Transaction Integrity（修复 expression_practice_logs 400 + 完成本条学习失败）
**Migration:** `094_learning_completion_integrity.sql`（已应用至 production 并二次验证）
**RPC:** `complete_expression_learning`（已部署 production）
**Tests:** 286 passed / 286（原 257 + 新增 29）

---

## 1. Root cause PostgREST error

点击「完成本条学习」后，`POST /rest/v1/expression_practice_logs` 返回 **400 Bad Request**。

PostgREST 错误体（生产实测约束推断 + 语法语义）：
- SQLSTATE `23514 check_violation`，constraint = `expression_practice_logs_mode_check`
- 详情：`new row for relation "expression_practice_logs" violates check constraint "expression_practice_logs_mode_check"`

因为旧 `completeCurrent` 的 practice-log INSERT 没有 `try/catch`，错误变成 unhandled promise rejection，`finally { setCompleting(false) }` 仍执行，但「推进到下一表达」的代码永远不执行 → UI 显示「完成失败：未知错误」，1/5 永远不推进到 2/5。

---

## 2. 哪个字段导致 400

**`expression_practice_logs.mode`**。

新学习流程写入 `mode: 'learn'`，但 legacy 内联 CHECK 只允许 `('recall','recognition','cloze','sentence','application')`，**不含 `'learn'`**。新行写入 → 23514 → 400。

二次潜在字段：`expressions.status` 的 legacy CHECK 只允许 `('new','learning','familiar','mastered')`，**不含 `'review'`/`'collected'`**，同样会导致学习完成后的 SRS 初始化 23514 → 400。本次一并修复。

---

## 3. Schema drift（生产实测）

`npx supabase db query --linked` 读取生产 `pg_constraint`，确认两个漂移约束同时存在于 production：

| 约束名 | 定义（生产实测） | 来源 | 是否 enforce 新行 |
|--------|-----------------|------|------------------|
| `expression_practice_logs_mode_check` | `mode IN ('recall','recognition','cloze','sentence','application')` | migration 086 CREATE TABLE 内联 CHECK，Postgres 自动命名 | **是（VALID）** |
| `chk_practice_logs_mode` | `mode IN ('learn','recall','recognition','cloze','sentence','application') NOT VALID` | migration 091 ADD CONSTRAINT | **是（NOT VALID 也 enforce 新行）** |
| `expressions_status_check` | `status IN ('new','learning','familiar','mastered')` | **repo 内无 migration 来源（out-of-band 漂移）** | **是（VALID）** |
| `chk_expressions_status` | `status IN ('collected','learning','review','mastered') NOT VALID` | migration 091 | **是（NOT VALID 也 enforce 新行）** |

**结论**：同一列存在两个 CHECK 时，Postgres 对**新行全部 enforce**。`expression_practice_logs_mode_check` 排除了 `learn`，导致新学习流程必炸。

---

## 4. Migration drift（根因链）

1. **086** 建表时写了内联 `CHECK (mode IN ('recall','recognition','cloze','sentence','application'))` → 自动命名为 `expression_practice_logs_mode_check`。
2. **091** 想「升级」mode 约束，但写的是 `DROP CONSTRAINT IF EXISTS chk_practice_logs_mode` —— 该名字**从未存在过**（正确应 drop `expression_practice_logs_mode_check`），然后 `ADD CONSTRAINT chk_practice_logs_mode`（含 `learn`，NOT VALID）。
3. 结果：`expression_practice_logs_mode_check` 从未被 drop，与 `chk_practice_logs_mode` **同时存在**。新行 `mode='learn'` 被前者拦截 → 23514 → 400。

`expressions.status` 同理：091 加了 `chk_expressions_status`，但 legacy `expressions_status_check` 从未被 drop（且其在 repo 中无来源，属 out-of-band 漂移，`status='review'` 也会 23514 → 400）。

**教训**：不要从 migration 文件猜 schema —— 必须读真实 production。

---

## 5. 最终 practice log contract

`src/lib/english/practiceLogRepository.ts`（唯一契约入口）：

- 字段：`user_id, expression_id, session_id, mode, answer, feedback, score(0-5), metadata JSONB`
- `mode` 类型：`'learn' | 'recall' | 'recognition' | 'cloze' | 'sentence' | 'application'`
- `session_id` FK：`REFERENCES review_sessions(id) ON DELETE SET NULL`（生产实测确认存在）
- **Rule：一句话 = 一条 practice record**。INSERT 一次（提交造句时），AI 反馈与完成都是 UPDATE 同一条。

---

## 6. sentence / AI feedback / completion 存在哪里

| 数据 | 表/字段 | 时机 | 成败 |
|------|---------|------|------|
| 个人造句 | `review_session_items.user_sentence` | 提交造句时（save-before-AI） | **CORE**，失败报错可重试 |
| AI 反馈 | `expression_practice_logs.metadata`（`ai_evaluation`/`ai_feedback`） | AI 返回成功后 UPDATE 同一条 log | ENRICHMENT，软失败 |
| 完成标记 | `review_session_items.status='completed'` + `recall_score`/`sentence_score` | 完成时（RPC 内） | **CORE** |
| SRS 初始化 | `expressions`（status/learned_at/next_review_date/…）+ `expression_reviews` | 完成时（RPC 内） | **CORE** |
| 完成标记 practice log | `expression_practice_logs.metadata.learn_completed=true` | 完成时 UPDATE 同一条 log | ENRICHMENT，软失败 |

---

## 7. 为什么不会重复 INSERT

`practiceLogIdRef`（组件 ref）持有提交造句时 INSERT 返回的 id：

- 提交造句：无 id → `insertPracticeLog`（得 id）；已有 id（修改句子再提交）→ `updatePracticeLog`。
- 完成时：有 id → 只 `updatePracticeLog(该 id, {learn_completed:true})`；**绝不二次 INSERT**。
- 仅当整个流程从未提交过句子（纯回忆学习）时，完成时才 INSERT 一条 `mode:'learn', learn_stage:'recall_only'` 的记录 —— 这是唯一一次「完成时 INSERT」，且一次性。

---

## 8. SRS idempotency

SRS 计算仍在 TypeScript（`src/lib/srs/expressionSrs.ts`，**未修改**），完成时把算好的 schedule 以 JSONB `p_srs` 传给 RPC，由 RPC 在**同一事务**内完成 item-complete + SRS 初始化。

RPC 守卫（生产已部署）：

```sql
IF v_expr.status IN ('collected', 'learning')
   AND (v_expr.next_review_date IS NULL OR v_expr.next_review_date <= v_now::date) THEN
  ...初始化 SRS...
END IF;
```

- 已进入 review 周期（`next_review_date` 在未来）的表达 **跳过**，绝不覆盖已有复习历史。
- 逾期（date <= now）或从未排期的表达，以新 schedule 重新进 cycle —— 这同时解开了「have an opportunity to」这类卡在中间态的表达。
- `review_session_items.status` 幂等：已 `completed` 不重复写。

---

## 9. RPC 是否创建

**是。** `complete_expression_learning(p_session_id UUID, p_item_id UUID, p_recall_score SMALLINT, p_sentence_score SMALLINT, p_srs JSONB)`，`SECURITY DEFINER`，`SET search_path=public`，`GRANT EXECUTE TO authenticated`，`auth.uid()` 校验会话所有权。生产已部署并验证签名/定义。

---

## 10. Schema 是否修改

是，两处（migration 094）：

1. `DROP CONSTRAINT IF EXISTS expression_practice_logs_mode_check;`
2. `DROP CONSTRAINT IF EXISTS expressions_status_check;`

未新增表/列。创建 1 个 RPC 函数。`expression_practice_logs` 的 FK（`session_id → review_sessions(id) ON DELETE SET NULL`）生产实测已存在，无需修改。

---

## 11. Migration 是否应用

**是。** `npx supabase migration up --linked` 应用 094；随后因 SRS 守卫细化，用 `supabase db query --linked -f` 重新执行（`CREATE OR REPLACE` 幂等）更新 production。三次生产验证：

- stale 约束已消失（`rows: []`）
- RPC 存在且签名正确
- `mode='learn'` 真实 INSERT round-trip 成功（id 返回后即删除），证明 400 已修复

> 状态声明（PART 19 要求）：**Migration 文件已存在**（`supabase/migrations/094_learning_completion_integrity.sql`）且 **Production migration 已实测验证**（不是只存在于 repo）。

---

## 12. 生成的 types 是否更新

**是。** `npx supabase gen types typescript --linked > src/lib/database.types.ts`（3722 行，从生产生成）。包含 `complete_expression_learning` RPC 签名与 `expression_practice_logs` Row/Insert/Update。新增 schema-contract 测试用 `expectTypeOf` 对 RPC 签名做编译期约束。

---

## 13. TypeScript

`npx tsc --noEmit` **通过，0 错误**。

修复过程中处理一处类型：`useUpdateSessionItem` 的 `sentenceScore` 从 `number` 放宽为 `number | null`（DB 列可空）；移除未使用的 `useUpdatePracticeLog` hook 及其导入。

---

## 14. Build

`npm run build` **通过**（tsc -b + vite build + build:verify）：

```
✓ built in 19.00s
Build verified: no placeholder found.
```

---

## 15. Tests

`npx vitest run` → **286 passed / 286**（4 个测试文件，0 失败）。

新增 29 个测试：

**PART 17-18 Schema contract（11）** — `PracticeLogSchemaContract.test.ts`：
- repo payload 契约：insert 字段全量匹配 / 可选字段置 null / update 只发已定义字段 / mode 覆盖全量
- **migration replay**：按序回放 ADD/DROP CONSTRAINT，断言最终生效的 mode CHECK 接受全部 canonical 值、legacy 约束已被 drop —— **直接防止本 bug 复发**；status CHECK 同样验证
- RPC 签名编译期契约（database.types.ts）

**PART 20 Completion regression（18）** — `EnglishLearnCompletion.test.ts`：
- `classifyCompletionError` 真实代码：23514→可重试 / 网络→网络提示 / 未知→不泄漏 SQL / 不再出现「完成失败：未知错误」
- coordinator 模型（忠实转写 `completeCurrent`）：1/5→2/5 恰好一次 / 最后一条→Summary / 无句子时 INSERT 一条 recall-only / **有 id 时只 UPDATE 不二次 INSERT** / 缺 AI 反馈仍可完成 / 核心失败不推进 / 失败后重试恰好推进一次 / 双击不重复 / 已完成表达跳过（幂等）/ recall 未检查被拦截 / query invalidation 触发 / 失败后 sentence+log id 存活可重试

---

## 16. E2E（浏览器）

本轮无 headless 浏览器驱动，未做自动化 E2E（与上一轮一致）。部署后待人工验证：

- [ ] 完成 1 条学习 → 无报错、自动 1/5→2/5（此前必炸的路径）
- [ ] 故意制造网络断开 → 显示分类错误 + [重试] → 重试成功且不重复推进
- [ ] 快速连续点击「完成本条学习」→ 不重复、不报错
- [ ] 只做回忆不造句直接完成 → 生成一条 recall_only 记录
- [ ] 造句 + AI 反馈后完成 → 只产生 1 条 practice log（metadata 含 ai_feedback + learn_completed）
- [ ] 「have an opportunity to」重新学完 → 进入复习队列、learned_at 有值

---

## 17. Production 数据审计（PART 21）

针对 `have an opportunity to`（id `520a6f61-8a97-496f-97c7-2dd73fc2635b`）：

| 项 | 实测 | 结论 |
|----|------|------|
| `expressions.status` | `'learning'`，`learned_at=NULL` | 学习完成事务中断，未毕业 |
| `next_review_date` | `2026-08-07`（已逾期），reps=0，review_count=1 | 旧 SRS 遗留 |
| `expression_practice_logs` | **0 行** | 正是被 400 拦下的那条，从未写入 |
| `expression_reviews` | 1 行（08-06，`result='good'`，`review_mode=null`） | 旧方案历史，早于 08-09 失败 |
| `review_session_items` | `3eb4fc8b`（session `ab734bc8`）`completed`，recall=3/sentence=5，user_sentence 已存 | 失败运行中 sentence+scores 已落库，但 practice-log 炸了、SRS 未初始化 |
| | `8d9b4f79`（session `5e7618eb`）`pending` | 用户重新进入学习，同表达再次入队 |

**处置：不删除、不补数据**。用户在新 session 中完成该 pending item 时，新 RPC 幂等地：标记 item completed；因 `next_review_date (08-07) <= now`，重新初始化 SRS（status→review、learned_at、+1 review_count、写入一条 `review_mode='learn'`）。旧的 08-06 review 保留为历史。无重复 practice log、无丢失。

顺带确认生产 status 分布：`learning`×86（其中 84 带 `next_review_date` —— 旧语义「已复习过」，**不是**新语义「学习中」）、`new`×24（`new→collected` DML 从未跑过，migration 角色无法执行 DML）。这是既有数据模型错位，**不属于本次「只修 completion transaction」范围**，已记录为 Known limitation。

---

## 18. Known limitations

1. **无浏览器自动化 E2E**：核心修复已部署，需人工按 Q16 清单验证。
2. **生产 status 语义漂移**：`learning` 仍承载旧语义（已复习过/带 next_review_date）。学习队列因此可能把已复习表达当作「待学习」再次入队。本次 RPC 守卫已兼容（不覆盖未来排期），但「清理 legacy status / 运行 new→collected DML」属于后续轮次。
3. **RPC 只能由真实 JWT 触发**：`SECURITY DEFINER` + `auth.uid()` 校验，无法用管理 API 直接端到端调用；RPC 正确性由 schema round-trip + vitest coordinator + 生产定义验证覆盖。
4. **learn 完成 `review_count` 可能 +1 于旧历史之上**：如「have an opportunity to」完成时 review_count 1→2，属如实计数两次事件，非删除性损坏。
5. **participation `mode='learn'` 是唯一新增的合法 mode**：复习三模式（recall/cloze/sentence）与 SRS 算法、AI prompt、4-stage UI、English Home 均未修改（符合 PART 30 约束）。

---

## 状态结论

- [x] Root cause：`expression_practice_logs_mode_check`（legacy 内联 CHECK 排除 `learn`）→ 23514 → 400
- [x] 二次隐患：`expressions_status_check` 排除 `review`/`collected`
- [x] Migration 094 应用 + 生产三连验证（约束消失 / RPC 存在 / round-trip INSERT）
- [x] RPC `complete_expression_learning`：原子 + 幂等 + SRS 守卫（不覆盖未来排期）
- [x] One sentence = one practice record：INSERT@submit / UPDATE@AI / UPDATE@complete，无重复 INSERT
- [x] 错误语义：分类消息 + [重试]，不再出现「完成失败：未知错误」
- [x] `database.types.ts` 已从生产重新生成
- [x] TS / Build / Tests（286 pass）
- [ ] 浏览器 E2E 人工验证（清单见 Q16）
