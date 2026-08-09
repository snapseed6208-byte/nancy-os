# English SRS V3 — Daily Learning Session System Report

**Date:** 2026-08-09
**Commit:** cb147c5
**Status:** 已部署到生产环境

---

## 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| `supabase/migrations/086_review_sessions.sql` | NEW | 3 个新表 |
| `src/lib/hooks/useReviewSession.ts` | NEW | Session hook (query + mutations + helpers) |
| `src/pages/EnglishReviewV3.tsx` | NEW | Session-based review page (Recall + Sentence) |
| `src/App.tsx` | MODIFIED | `/english/review` 路由指向 V3 |

---

## V2 → V3 变化

| V2 问题 | V3 解决方案 |
|---------|-------------|
| 每个模式重新 `shuffle()` | 每日 session 固定 15 个 expression |
| 进入 Sentence 后无法回到同一批 | 所有模式读取 `review_session_items` |
| 失败不进入强化循环 | 失败→ `status='failed'` → 强化轮次 |
| 无学习历史 | `expression_practice_logs` 记录每次练习 |

---

## 数据模型

### review_sessions
```
id, user_id, session_date (UNIQUE), target_count,
status (active/completed/abandoned),
current_stage (recall/sentence/application)
```

### review_session_items
```
session_id + expression_id (UNIQUE),
recall_score, sentence_score, application_score,
user_sentence, ai_feedback,
status (pending/in_progress/passed/failed/reinforcement/completed),
attempt_count, reinforcement_round (0-3)
```

### expression_practice_logs
```
user_id, expression_id, session_id,
mode (recall/recognition/cloze/sentence/application),
answer, feedback, score, metadata (JSONB)
```

---

## Multi-stage Flow

```
进入 /english/review
  → 创建/加载今日 session (15 个 due expression)
  → Stage 1: Recall (中文提示 → 显示答案 → 自评 1-5)
    → passed: recall_score ≥ 3, status='passed'
    → failed: recall_score < 3, status='failed' → 进入强化池
  → 本轮完成 → 显示失败数量 → "强化 N 个" 按钮
    → Round 2: 只训练失败项 (reinforcement_round=1)
    → Round 3: 仍然失败的继续 (max 3 rounds)
  → "进入造句" 按钮 → Stage 2: Sentence
    → 显示 expression → 用户输入句子 → 提交 → 评分
  → 全部完成 → "完成" → 返回 English OS
```

---

## 强化规则

- 最大 3 轮强化
- 每轮只训练上一轮失败的项
- 失败项 `status='reinforcement'`, `reinforcement_round++`
- 全部通过后自动结束

---

## 测试结果

| 检查项 | 结果 |
|--------|------|
| TypeScript (`tsc --noEmit`) | 通过 |
| Build (`npm run build`) | 通过 |
| placeholder.supabase 检测 | 未检出 |
| 数据库表创建 | review_sessions + review_session_items + expression_practice_logs |
| production deploy | 已推送 |

---

## 未修改模块

- EnglishReview.tsx — 保留（可后续移除）
- English.tsx — 未修改
- EnglishSpeaking / EnglishExpressions / EnglishProgress — 未修改
- useEnglish.ts — 未修改
- expressionSrs.ts — 未修改
- expressions / expression_reviews 表 — 未 ALTER
