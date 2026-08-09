# English SRS V3.1 — Adaptive Learning Loop Report

**Date:** 2026-08-09
**Commits:** e511a06 → d6c2c51 (5 commits)
**Status:** 已部署到生产环境

---

## 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| `supabase/migrations/087_adaptive_learning.sql` | NEW | 4 个新字段 |
| `supabase/functions/diagnose-difficulty-agent/index.ts` | NEW | AI 困难诊断 |
| `supabase/functions/personal-practice-agent/index.ts` | NEW | 个性化练习场景生成 |
| `src/lib/hooks/useReviewSession.ts` | MODIFIED | +379 行：诊断/上下文/强化/历史 hooks |
| `src/pages/EnglishReviewV3.tsx` | MODIFIED | +552 行：诊断卡片/填空/场景/深度练习 |
| `src/pages/EnglishLearningHistory.tsx` | NEW | 学习历史看板 |
| `src/App.tsx` | MODIFIED | `/english/history` 路由 |

---

## 新增数据库字段 (migration 087)

| 字段 | 类型 | 说明 |
|------|------|------|
| `difficulty_diagnosis` | JSONB | AI 诊断：problem_type, sub_problems, suggestion, confidence |
| `reinforcement_status` | TEXT | 强化管线：none→queued→round1_recall→round2_cloze→round3_context→mastered/max_rounds |
| `personal_context` | JSONB | 个性化场景：asset_id, scenario, prompt, matched_assets |
| `result_classification` | TEXT | 结果分类：mastered / needs_reinforcement / needs_context |

---

## V3 → V3.1 变化

| V3 | V3.1 |
|----|------|
| 无失败原因分析 | AI 诊断问题类型 + 可操作建议 |
| 通用造句提示 | 基于真实个人素材的个性化场景 |
| 原始 3 轮相同强化 | 3 轮递进强化（回忆→填空→场景） |
| 15 个全部造句 | 15 个回忆 + 5 个深度练习 |
| 无历史数据 | 30 天趋势 + 困难表达排行 |

---

## 实现的功能

### Stage 1: AI 困难诊断
- `diagnose-difficulty-agent` Edge Function 分析为何记不住表达
- 4 种问题类型：memory / application / context / fluency
- 失败后自动触发，可折叠诊断卡片显示子问题 + 建议

### Stage 2: 个性化语境激活
- `personal-practice-agent` Edge Function 匹配用户 expression_assets
- 利用用户的真实故事/案例/观点生成造句场景
- 进入深度练习阶段自动预加载个性化提示

### Stage 3: 自适应强化循环
- A/B/C 分类：mastered / needs_reinforcement / needs_context
- 3 轮递进强化：Round1 回忆 → Round2 填空 → Round3 场景造句
- 强化池上限 5 个（按最低分优先）
- reinforcement_status 追踪完整管线

### Stage 4: 学习历史看板
- 今日复习摘要（总数/掌握/需强化/强化中）
- 连续练习天数 + 7 天统计
- 30 天迷你柱状图（绿色=通过，红色=失败）
- 困难表达 Top 8（含 AI 诊断类型标签）

### Stage 5: 练习流程优化
- 15 个回忆 + 5 个深度练习（非全部 15 个造句）
- 高分项自动完成，节省时间
- 深度练习项按 recall_score 从低到高排序

---

## 新增 Hooks

| Hook | 说明 |
|------|------|
| `useDiagnoseItem()` | 调用 diagnose-difficulty-agent，更新 difficulty_diagnosis |
| `usePersonalPracticePrompt()` | 调用 personal-practice-agent，生成个性化场景 |
| `useUpdateReinforcementStatus()` | 更新 reinforcement_status + result_classification |
| `useBatchUpdateReinforcement()` | 批量更新强化状态 |
| `useLearningHistory()` | 聚合 30 天学习历史数据 |

---

## 测试结果

| 检查项 | 结果 |
|--------|------|
| TypeScript (`tsc --noEmit`) | 通过 |
| Build (`npm run build`) | 通过 |
| placeholder.supabase 检测 | 未检出 |
| Migration 087 部署 | 4 字段确认存在 |
| Edge Functions 部署 | diagnose-difficulty-agent + personal-practice-agent 均 ACTIVE |

---

## 未修改模块

- English.tsx / EnglishExpressions / EnglishSpeaking — 未修改
- EnglishImport / EnglishProgress — 未修改
- useEnglish.ts / expressionSrs.ts — 未修改
- expressions / expression_reviews 表 — 未 ALTER
