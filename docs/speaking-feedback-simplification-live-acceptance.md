# Speaking Feedback Simplification — Live Acceptance & Deploy Evidence Report

实现已自动部署上线。本报告记录真实模型语义验收（A–G + retry）、录音→数据库 E2E、Edge v20 上下文隔离验证、以及前端线上包验证。原始证据 JSON 见 `docs/speaking-live-acceptance/*.json`，验收脚本见 `scripts/speaking-live-acceptance.ts`。

上线时间：2026-09-08。提交 `3059d16`（13 files, +743/−1560）。Edge function `english-coach` **version 20**（ACTIVE）。Cloudflare Pages 线上 bundle `index-BTmaxTd4.js`。

## 1. 结论

- 7 个语义用例全部返回新契约：**唯一 final_upgraded_answer + 独立 reference_answer**，无任何 legacy 多答案字段（`natural_version` / `optimized_version` / `high_score_version` / `finalHighScoreAnswer` / `structuredBetterAnswer` / `oneBetterExample` 均为 0）。
- revision_mode 匹配预期 **5/7**；C、G-city 实际返回 `expand`（预期 `structure`）。mode 是存储值，不直接展示在 UI，属于非阻塞观察。
- 复述（retry）仅返回 4 条检查，**不重新生成**最终答案/参考答案 —— 学习目标保持不可变。
- 录音→DB E2E 在**生产环境**全链路通过：真实 Aliyun 实时 ASR → feedback 生成 → `speaking_sessions` + `speaking_attempts` 写入新契约（`content_analysis.feedback_v2`）→ DB 读回比对 + 音频字节比对均一致。
- Edge v20 的 `speaking_feedback` 上下文隔离已在生产验证：NORMAL 调用注入个人记忆并泄漏特征物，SPEAKING 调用不注入、不泄漏。
- Go-live gate：**741/741 测试通过**（32 文件），`npm run build`（tsc -b + Vite）绿色，无 placeholder 泄漏。

## 2. 真实模型语义验收 A–G

对 `src/__tests__/fixtures/speaking-feedback-cases.ts` 的 A–G 用例，调用生产 Edge `english-coach`（DeepSeek，temperature 0.3，maxTokens 4096，`speaking_feedback:true, inject_context:false`）。

| 用例 | 题目 | 预期 mode | 实际 mode | overall | target | 最终答案 | 参考 | takeaway | 耗时(ms) |
|---|---|---|---|---|---|---|---|---|---|
| A | Do you enjoy cooking? | light | **light** | 6 | 7 | ✓ | ✓ | 3 | 8,910 |
| B | Do you prefer working from home? | expand | **expand** | 5.5 | 7 | ✓ | ✓ | 4 | 8,443 |
| C | Why do you like cycling? | structure | expand ⚠️ | 6 | 7 | ✓ | ✓ | 3 | 7,636 |
| D | Why do you like cooking? | trim | **trim** | 4.5 | 6 | ✓ | ✓ | 3 | 7,753 |
| E | Do you prefer big cities? | rewrite | **rewrite** | 5 | 7 | ✓ | ✓ | 3 | 9,393 |
| F | Why is teamwork useful? | expand | **expand** | 5.5 | 7 | ✓ | ✓ | 3 | 9,453 |
| G-city | Do you prefer living in big cities? | structure | expand ⚠️ | 5.5 | 6.5 | ✓ | ✓ | 3 | 10,513 |

契约核验（全部用例）：

- 每个输出恰好 1 个 `final_upgraded_answer`、1 个 `reference_answer`；`revision_mode` 合法枚举。
- `takeaway_expressions` 2–4 条，且都来自最终答案原文（前端 `normalizeSpeakingFeedback` 会再过滤/去重）。
- `expansion_notice` 在补充假设性理由时正确声明「参考性展开」（B、F 等）。
- D（trim）按预期删除与做饭无关的学校/住址/天气内容 —— 与提示词「For cooking, remove unrelated school/address/weather details」一致。
- 分数诚实、无发音/音频声称；未发现任何禁止的 legacy 答案字段。

⚠️ 观察：C、G-city 内容逻辑已经足够，模型判为「观点清楚但展开不足/顺序偏散」而选了 `expand`，未按预期输出 `structure`。`revision_mode` 仅入库不渲染，且用例本身就是人工预期的语义期望而非模型行为回放，因此判定为**非阻塞偏差**。若产品后续要展示「结构调整/展开」类型徽标，可再校准提示词。

## 3. 复述（retry）验收

对 G-city 首轮已生成的 `final_upgraded_answer` 进行复述评测（`buildRetryFeedbackPrompt`，脚本中固定 `speakingCases[6]`）。

- `retry_checks`: 4 条（completeness / core_expressions / language / naturalness 覆盖）。
- `final_upgraded_answer` / `reference_answer` / `revision_mode`: **未重新生成 / 为空**（学习目标保持不可变 ✓）。
- overall 9（复述内容与首轮目标高度一致），无新答案产出。

结果写入 `docs/speaking-live-acceptance/retry.json`。

## 4. 录音 → 数据库 E2E（生产）

`mode=audio` 使用预置合成的真实语音 WAV（Zira TTS，16kHz/16-bit/mono PCM，474,766 bytes，14.8s），走**真实 Aliyun 实时 ASR**（WebSocket `nls-gateway-cn-shanghai`，`aliyun-token` 鉴权）。

- ASR 转写（问题「Do you prefer living in big cities?」）：

  > "i like living in big cities because there are more jobs. actually, i do not like crowded places. my boyfriend also lives here. the transport is very convenient. so i think big cities are better."

- 转写 → `english-coach` 生成 feedback（含 final answer）。
- 插入 `speaking_sessions`（`is_test:true, mode:free_speaking`）→ session `67e4b336-2b8f-4f26-a7d5-393b589a7180`。
- 上传 `speaking-audio` → `{session}/acceptance.wav`，取 public URL。
- 插入 `speaking_attempts`（attempt `4b9b5e95-c637-483b-9043-703469d883b3`），含 `...speakingFeedbackStorage(feedback)`：新契约写入 `content_analysis.feedback_v2`；`structured_better_answer`/`reference_answer`/`diagnosis` 映射到既有列；`combined_feedback`=optimization_summary；`natural_version=''`。
- 校验：
  - DB 读回 → `normalizeSpeakingFeedback(read).final_upgraded_answer` 与写入值一致；`transcribed_text` 一致（roundtrip ✓）。
  - 下载 public audio URL → 字节数与原始 WAV 完全一致（roundtrip ✓）。

结果写入 `docs/speaking-live-acceptance/audio-e2e.json`。

## 5. Edge v20 上下文隔离（生产验证）

对零上下文 QA 用户插入一条**高度特征化**记忆（"collects antique teapots and keeps a pet iguana named Pico"），随后调用同一 story-scenario 场景：

| 调用 | `speaking_feedback` | `personal_story_injected` | 是否泄漏特征物 |
|---|---|---|---|
| NORMAL（普通故事/学习场景） | false | `true` | **是**（回复出现 teapots） |
| SPEAKING（口语反馈） | true | `false` | **否**（无特征物） |

结论：`english-coach/index.ts` 中 `if (xContext && !speakingFeedback)` 四处守卫在生产生效 —— 口语反馈不再注入个人记忆/故事/画像上下文，避免「模型以为学生养鬣蜥」这类跨域污染。测试后已删除临时记忆（`83d97cc7…`）。

## 6. 自动部署上线

- 前端：commit `3059d16` push → Cloudflare Pages 自动构建 → 线上 asset `index-BTmaxTd4.js`。
- 线上包 marker 验证（`grep` 压缩后 bundle）：
  - 旧重复答案 UI 已消失：`最终高分答案`、`更自然的表达`、`参考范例`、`重点学习 Key Upgrades`、`问题诊断` → **absent**。
  - 新单一答案 UI 已上线：`本轮表现`、`优化思路`、`最终优化表达`、`可带走的表达`、`AI 参考答案`、`复述反馈`、`参考性展开` → **present**。
  - `四维评分` 保留（by design）。
- Edge：`supabase functions deploy english-coach` → **version 20**（ACTIVE，updated_at 与本次一致）。

## 7. Go-live gate

- `npm test`: **741 passed / 741**（32 files）。
- `npm run build`: `tsc -b` 类型检查通过 + Vite build 成功；`build:verify` 确认无 `placeholder.supabase` 泄漏。
- 工作区仅剩既有无关未提交改动（migrations 098/099、audit 脚本、`tsconfig.tsbuildinfo`、config.toml 等），未混入本次提交。

## 8. 残余风险 / 说明

- **真实模型语义方差**：C、G-city 的 `revision_mode` 偏差说明 LLM 对 mode 的判定存在语义重叠；因 UI 不展示 mode，风险低。若未来展示「结构优化」徽标需校准提示词并加回归用例。
- **验收覆盖**：ASR/DB E2E 用的是合成语音 + 真实 Aliyun ASR 与鉴权 Supabase API，非「物理麦克风 → 浏览器录音」全链路；浏览器端录音 UI 仍由前端单测覆盖。
- **历史数据**：旧 `speaking_attempts` 中的 legacy 答案字段由 `normalizeSpeakingFeedback` 读取层兼容，未做迁移回填（by design，见 implementation report）。
