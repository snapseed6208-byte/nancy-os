-- ============================================
-- Migration 033: Workout Journal System
-- Tables: workout_sessions, workout_exercises, exercise_library
-- ============================================

-- 1. Exercise Library (standard exercise reference)
CREATE TABLE IF NOT EXISTS exercise_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  target_muscles JSONB DEFAULT '[]',
  equipment TEXT,
  movement_pattern TEXT,
  instruction TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE exercise_library IS '标准动作库 — 用户选择动作时的参考数据';
COMMENT ON COLUMN exercise_library.target_muscles IS 'JSONB 数组: ["臀大肌", "股四头肌"]';

CREATE INDEX idx_exercise_library_category ON exercise_library(category);

-- Seed: common exercises
INSERT INTO exercise_library (name, category, target_muscles, equipment, movement_pattern, instruction) VALUES
  -- 臀腿
  ('深蹲', '臀腿', '["股四头肌","臀大肌","腘绳肌"]', '自重/杠铃/哑铃', '下肢推', '双脚与肩同宽，挺胸收腹，下蹲至大腿与地面平行'),
  ('保加利亚分腿蹲', '臀腿', '["股四头肌","臀大肌"]', '哑铃/自重', '单腿', '后脚置于凳上，前腿下蹲至大腿平行'),
  ('罗马尼亚硬拉', '臀腿', '["腘绳肌","臀大肌","竖脊肌"]', '杠铃/哑铃', '髋铰链', '微屈膝，以髋为轴前倾，保持背部挺直'),
  ('臀推', '臀腿', '["臀大肌","腘绳肌"]', '杠铃/哑铃/自重', '髋伸展', '肩胛靠凳，杠铃置髋部，向上顶髋至身体平直'),
  ('腿举', '臀腿', '["股四头肌","臀大肌","腘绳肌"]', '腿举机', '下肢推', NULL),
  ('腿弯举', '臀腿', '["腘绳肌"]', '腿弯举机', '下肢拉', NULL),
  ('腿屈伸', '臀腿', '["股四头肌"]', '腿屈伸机', '下肢推', NULL),
  ('相扑硬拉', '臀腿', '["臀大肌","股四头肌","腘绳肌"]', '杠铃/哑铃', '髋铰链', '宽站距脚尖外八，杠铃贴近小腿拉起'),

  -- 背部
  ('引体向上', '背部', '["背阔肌","大圆肌","肱二头肌"]', '单杠/引体向上器', '垂直拉', '正握，身体悬垂，拉至下巴过杠'),
  ('高位下拉', '背部', '["背阔肌","大圆肌"]', '高位下拉机', '垂直拉', '正握，下拉横杆至锁骨位置，挺胸沉肩'),
  ('哑铃划船', '背部', '["背阔肌","菱形肌","斜方肌"]', '哑铃', '水平拉', '单侧支撑凳面，将哑铃拉至体侧，肘部贴紧身体'),
  ('坐姿划船', '背部', '["背阔肌","菱形肌"]', '坐姿划船机', '水平拉', '拉至腹部，肩胛后缩，挺胸'),
  ('面拉', '背部', '["三角肌后束","菱形肌","肩袖肌群"]', '龙门架/弹力带', '水平拉', '绳索拉至面部两侧，外旋肩关节'),
  ('直臂下压', '背部', '["背阔肌"]', '龙门架', '直臂拉', '直臂将横杆从高位下压至髋部'),

  -- 肩胸
  ('卧推', '肩胸', '["胸大肌","三角肌前束","肱三头肌"]', '杠铃/哑铃', '水平推', '落在下胸位置，推至手臂伸直锁定'),
  ('上斜卧推', '肩胸', '["胸大肌上部","三角肌前束"]', '杠铃/哑铃', '上斜推', '凳面调至30-45度'),
  ('哑铃飞鸟', '肩胸', '["胸大肌"]', '哑铃', '夹胸', '微屈肘，双臂外展至胸肌拉伸后夹回'),
  ('肩推', '肩胸', '["三角肌前中束","肱三头肌"]', '哑铃/杠铃', '垂直推', '坐姿推举至头顶上方'),
  ('侧平举', '肩胸', '["三角肌中束"]', '哑铃', '外展', '微屈肘，双臂侧平举至肩高，控制下落'),
  ('俯身飞鸟', '肩胸', '["三角肌后束"]', '哑铃', '反向飞鸟', '俯身，双臂后展至肩胛收缩'),
  ('双杠臂屈伸', '肩胸', '["胸大肌下部","肱三头肌"]', '双杠/辅助器', '垂直推', '身体前倾，屈肘下放至肩高，撑起'),

  -- 核心
  ('平板支撑', '核心', '["腹横肌","腹直肌"]', '瑜伽垫', '等长支撑', '前臂撑地，身体成直线，收腹夹臀'),
  ('卷腹', '核心', '["腹直肌"]', '瑜伽垫', '屈曲', '仰卧屈膝，卷起上背至肩胛离地'),
  ('悬垂举腿', '核心', '["腹直肌","髋屈肌"]', '单杠', '屈髋', '悬挂状态，抬腿至平行地面或更高'),
  ('俄罗斯转体', '核心', '["腹斜肌"]', '哑铃/瑜伽垫', '旋转', '坐姿后仰，双脚离地，双手持重物左右旋转'),
  ('死虫式', '核心', '["腹横肌","腹直肌"]', '瑜伽垫', '抗伸展', '仰卧四肢朝天，对侧手脚交替下放'),

  -- 有氧
  ('跑步', '有氧', '["下肢肌群","心肺"]', '跑步机/户外', '有氧', NULL),
  ('跳绳', '有氧', '["小腿","心肺"]', '跳绳', '有氧', NULL),
  ('划船机', '有氧', '["背部","腿部","心肺"]', '划船机', '有氧', NULL),
  ('椭圆机', '有氧', '["下肢","心肺"]', '椭圆机', '有氧', NULL),

  -- 拉伸
  ('猫牛式', '拉伸', '["脊柱","核心"]', '瑜伽垫', '脊柱活动', NULL),
  ('婴儿式', '拉伸', '["背部","肩部"]', '瑜伽垫', '放松', NULL),
  ('下犬式', '拉伸', '["腘绳肌","小腿","肩部"]', '瑜伽垫', '全身拉伸', NULL),
  ('鸽式', '拉伸', '["臀大肌","髋屈肌"]', '瑜伽垫', '髋部拉伸', NULL)
ON CONFLICT DO NOTHING;

-- 2. Workout Sessions
CREATE TABLE IF NOT EXISTS workout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('video_follow', 'free_training')),
  training_type TEXT,
  location TEXT CHECK (location IN ('居家', '健身房', '户外')),
  duration_minutes INTEGER,
  feeling TEXT,
  perceived_effort SMALLINT CHECK (perceived_effort >= 1 AND perceived_effort <= 10),
  notes TEXT,
  source_video_id UUID REFERENCES workout_videos(id) ON DELETE SET NULL,
  ai_summary TEXT,
  ai_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workout_sessions IS '训练会话 — 每次真实的训练记录';
COMMENT ON COLUMN workout_sessions.mode IS 'video_follow: 跟练视频 | free_training: 自由训练';
COMMENT ON COLUMN workout_sessions.source_video_id IS '关联训练库视频，自由训练时为空';
COMMENT ON COLUMN workout_sessions.ai_summary IS 'AI 训练分析摘要';

CREATE INDEX idx_workout_sessions_user_date ON workout_sessions(user_id, date DESC);
CREATE INDEX idx_workout_sessions_source ON workout_sessions(source_video_id);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout_sessions"
  ON workout_sessions FOR ALL USING (auth.uid() = user_id);

-- 3. Workout Exercises
CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercise_library(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  category TEXT,
  equipment TEXT,
  sets_completed INTEGER,
  reps JSONB DEFAULT '[]',
  weight_kg REAL,
  duration_seconds INTEGER,
  rest_seconds INTEGER,
  sort_order SMALLINT DEFAULT 0,
  notes TEXT,
  is_bodyweight BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workout_exercises IS '训练动作 — session 内的每个动作明细';
COMMENT ON COLUMN workout_exercises.reps IS 'JSONB 数组: [{"set":1,"reps":12,"weight":20,"completed":true}, ...]';
COMMENT ON COLUMN workout_exercises.exercise_id IS '关联标准动作库';

CREATE INDEX idx_workout_exercises_session ON workout_exercises(session_id, sort_order);
CREATE INDEX idx_workout_exercises_user ON workout_exercises(user_id);
CREATE INDEX idx_workout_exercises_library ON workout_exercises(exercise_id);

ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout_exercises"
  ON workout_exercises FOR ALL USING (auth.uid() = user_id);
