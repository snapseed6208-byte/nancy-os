-- ============================================
-- Nancy OS — 003: Phase 1.6 Data Model Enhancements
-- Life Timeline + AI Memory + Goals Hierarchy + Information Feed
-- ============================================

-- ============================================
-- 1. Goals 增强 — 层级 + 分类
-- ============================================
ALTER TABLE goals ADD COLUMN IF NOT EXISTS goal_level TEXT DEFAULT 'monthly';
-- 'vision' | 'yearly' | 'monthly'
-- vision → yearly → monthly → tasks (层层分解)

ALTER TABLE goals ADD COLUMN IF NOT EXISTS goal_category TEXT DEFAULT 'life';
-- 'career' | 'health' | 'learning' | 'life' | 'finance'

CREATE INDEX IF NOT EXISTS idx_goals_user_level ON goals(user_id, goal_level);
CREATE INDEX IF NOT EXISTS idx_goals_user_category ON goals(user_id, goal_category);

-- ============================================
-- 2. Life Timeline — 人生事件时间线
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  -- 'education' | 'career' | 'health' | 'relationship' | 'travel' | 'personal_growth' | 'milestone' | 'other'

  description TEXT,
  emotion TEXT,
  -- 事件当时/回顾的情绪

  reflection TEXT,
  -- 对这件事的反思和收获，供 AI 理解成长轨迹

  related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_events_user_category ON events(user_id, category);
CREATE INDEX IF NOT EXISTS idx_events_related_goal ON events(related_goal_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own events"
  ON events FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 3. AI Memory Layer — 长期记忆用户画像
-- ============================================
CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  memory_type TEXT NOT NULL,
  -- 'preference'   — 用户偏好 (喜欢互动型工作)
  -- 'personality'  — 性格特点 (内向但善于深度交流)
  -- 'habit'        — 习惯模式 (周一精力最好, 下午容易分心)
  -- 'insight'      — AI 洞察 (你完成率高的任务有清晰的下一步行动)
  -- 'skill'        — 能力标签 (雅思写作 6.5, Python 中级)

  content TEXT NOT NULL,
  -- 记忆内容, 如: "用户偏爱互动型、有即时反馈的工作方式"

  confidence REAL DEFAULT 0.5,
  -- 置信度 0.0 ~ 1.0, 随证据累积上升

  source TEXT,
  -- 推断来源描述, 如: "来自 2026-07 的 3 次 Life Trace 情绪分析"

  source_ids JSONB DEFAULT '[]',
  -- 来源记录 ID 列表: ["event_id_1", "mood_record_id_2"]

  related_event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- 过期或被推翻的记忆可标记为 inactive

  last_reinforced_at TIMESTAMPTZ,
  -- 最近一次被新证据强化的时间

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_memories_user_type ON ai_memories(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_active ON ai_memories(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_memories_confidence ON ai_memories(user_id, confidence DESC);

ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ai_memories"
  ON ai_memories FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 4. Information Feed — 信息流
-- ============================================
CREATE TABLE IF NOT EXISTS information_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  source TEXT NOT NULL,
  -- 来源: '36kr' | 'wechat_mp' | 'bilibili' | 'youtube' | 'rss' | 'manual' | 'ai_curated'

  url TEXT,

  category TEXT NOT NULL DEFAULT 'general',
  -- 'news' | 'english_material' | 'industry' | 'tech' | 'career' | 'lifestyle' | 'general'

  ai_summary TEXT,
  -- AI 自动生成的摘要

  tags TEXT[],

  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_saved BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,

  relevance_score REAL,
  -- AI 评估的相关度 0.0 ~ 1.0

  published_at DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_info_feed_user_category ON information_feed(user_id, category);
CREATE INDEX IF NOT EXISTS idx_info_feed_user_read ON information_feed(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_info_feed_user_saved ON information_feed(user_id, is_saved);
CREATE INDEX IF NOT EXISTS idx_info_feed_published ON information_feed(user_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_info_feed_tags ON information_feed USING GIN(tags);

ALTER TABLE information_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own information_feed"
  ON information_feed FOR ALL USING (auth.uid() = user_id);
