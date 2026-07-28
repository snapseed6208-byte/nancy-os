-- ============================================
-- Nancy OS — 004: Phase 1.7 Architecture Enhancement
-- Skill Growth + Decision Journal + AI Agent Logs
-- ============================================

-- ============================================
-- 1. Skill Growth System — 能力成长追踪
-- ============================================
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  -- 技能名称, 如: "Speaking", "Python", "Communication"

  category TEXT NOT NULL DEFAULT 'general',
  -- 'english' | 'career' | 'health' | 'tech' | 'general'

  parent_skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,
  -- 技能层级: English → {Speaking, Listening, Writing, Reading}

  current_level TEXT NOT NULL DEFAULT 'beginner',
  -- 'beginner' | 'intermediate' | 'advanced' | 'proficient' | 'expert'

  target_level TEXT NOT NULL DEFAULT 'proficient',
  -- 'beginner' | 'intermediate' | 'advanced' | 'proficient' | 'expert'

  description TEXT,
  -- 技能描述, 如: "能用英语流利进行日常对话和职场交流"

  evidence JSONB DEFAULT '[]',
  -- 能力证据链:
  -- [{ date, description, proof, source }]
  -- 如: [{ date:"2026-07", description:"IELTS Speaking 6.5", proof:"成绩单", source:"exam" }]

  related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  -- 关联目标: 这个技能为哪个目标服务

  last_updated DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_user_category ON skills(user_id, category);
CREATE INDEX IF NOT EXISTS idx_skills_parent ON skills(parent_skill_id);
CREATE INDEX IF NOT EXISTS idx_skills_related_goal ON skills(related_goal_id);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own skills"
  ON skills FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 2. Decision Journal — 决策日志
-- ============================================
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  question TEXT NOT NULL,
  -- 决策问题, 如: "接受 A 公司 offer 还是继续面试?"

  context TEXT,
  -- 背景信息, 如: "A 公司给 15K, 通勤 1h; 手上还有 2 个面试在排"

  options JSONB NOT NULL DEFAULT '[]',
  -- 选项列表:
  -- [{ label, description, pros: [], cons: [], confidence: 0.8 }]

  chosen_option TEXT,
  -- 最终选择的选项 label

  reason TEXT,
  -- 选择理由

  expected_outcome TEXT,
  -- 预期结果 (决策时填写)

  actual_outcome TEXT,
  -- 实际结果 (事后填写, 供 AI 学习)

  lesson TEXT,
  -- 反思教训

  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'decided' | 'reviewed'

  date DATE NOT NULL,
  -- 决策日期

  related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  -- 关联目标

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_user_date ON decisions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_decisions_user_status ON decisions(user_id, status);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own decisions"
  ON decisions FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 3. AI Agent Logs — Agent 行为追踪
-- ============================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  agent_type TEXT NOT NULL,
  -- 'reflection' | 'career' | 'health' | 'english' | 'coach'

  action TEXT NOT NULL,
  -- 具体行为:
  -- 'generate_daily_review' | 'generate_weekly_summary'
  -- 'analyze_mood' | 'suggest_task' | 'classify_idea'
  -- 'summarize_resource' | 'speaking_feedback'
  -- 'career_advice' | 'health_plan' | 'coach_checkin'

  input_data JSONB NOT NULL DEFAULT '{}',
  -- 输入数据 (prompt + context)

  output_data JSONB NOT NULL DEFAULT '{}',
  -- 输出数据 (AI 响应)

  model TEXT,
  -- 使用的模型: 'deepseek-v3' | 'claude-opus-4' | 'whisper-1'

  model_version TEXT,
  -- 模型版本号

  tokens_used INTEGER,
  -- Token 消耗量

  related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_user_agent ON agent_logs(user_id, agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user_action ON agent_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user_created ON agent_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_model ON agent_logs(user_id, model);

ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own agent_logs"
  ON agent_logs FOR ALL USING (auth.uid() = user_id);
