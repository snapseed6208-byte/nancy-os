import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Mic, Clock, Lightbulb, BookOpen, Briefcase,
  Heart, Footprints, MessageSquare, Sparkles, Edit3,
  Loader2, AlertTriangle, BarChart3, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChineseSpeakingStats, useCreateChineseSpeakingSession, generateChineseTopics, TOPIC_TYPE_LABELS, type ChineseTopicType, type GeneratedTopic } from "@/lib/hooks/useChineseSpeaking";

const TIME_OPTIONS = [60, 90, 120] as const;

const DEFAULT_TIME_LIMITS: Record<ChineseTopicType, number> = {
  opinion: 60,
  experience: 90,
  concept: 90,
  reflection: 90,
  interview: 90,
  story: 120,
};

const TOPIC_CARDS: { type: ChineseTopicType; icon: typeof MessageSquare; description: string }[] = [
  { type: "opinion", icon: MessageSquare, description: "对热点话题表达你的观点和立场" },
  { type: "experience", icon: Footprints, description: "讲述一段你的真实经历" },
  { type: "concept", icon: Lightbulb, description: "解释一个概念或原理" },
  { type: "reflection", icon: BookOpen, description: "分享你看过的书或视频的感受" },
  { type: "interview", icon: Briefcase, description: "模拟面试场景回答" },
  { type: "story", icon: Heart, description: "讲一个生动的故事" },
];

export default function ChineseSpeaking() {
  const [, navigate] = useLocation();
  const { data: stats } = useChineseSpeakingStats();
  const createSession = useCreateChineseSpeakingSession();

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customTopic, setCustomTopic] = useState("");
  const [selectedType, setSelectedType] = useState<ChineseTopicType>("opinion");
  const [timeLimit, setTimeLimit] = useState<number>(DEFAULT_TIME_LIMITS.opinion);
  const [aiTopics, setAiTopics] = useState<GeneratedTopic[]>([]);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  // Update time limit when type changes
  const handleSelectType = (type: ChineseTopicType) => {
    setSelectedType(type);
    setAiTopics([]);
    setTopicError(null);
    setTimeLimit(DEFAULT_TIME_LIMITS[type]);
  };

  const handleGenerateTopics = async () => {
    setGeneratingTopics(true);
    setTopicError(null);
    setAiTopics([]);
    const result = await generateChineseTopics(selectedType, 3);
    if (result.success) {
      setAiTopics(result.data.topics);
    } else {
      setTopicError(result.error);
    }
    setGeneratingTopics(false);
  };

  const handleStartSession = async (topic: string, topicType?: ChineseTopicType, prompt?: string) => {
    try {
      const session = await createSession.mutateAsync({
        topic,
        topic_type: topicType || selectedType,
        prompt,
        mode: "one_minute_topic",
        time_limit_seconds: timeLimit,
      });
      navigate(`/chinese/session/${session.id}`);
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <header>
        <p className="text-sm text-ink-lighter">中文表达</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">表达训练</h1>
      </header>

      {/* Stats row */}
      {stats && (stats.total_sessions > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <p className="text-lg font-semibold text-ink">{stats.total_sessions}</p>
            <p className="text-[10px] text-ink-lighter">训练次数</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <p className="text-lg font-semibold text-ink">
              {stats.avg_score != null ? `${stats.avg_score}分` : "-"}
            </p>
            <p className="text-[10px] text-ink-lighter">综合均分</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <p className="text-lg font-semibold text-ink">{stats.total_retries}</p>
            <p className="text-[10px] text-ink-lighter">重新表达</p>
          </div>
        </div>
      )}

      {/* Per-type averages */}
      {stats?.per_type_avg && Object.keys(stats.per_type_avg).length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(stats.per_type_avg).map(([tt, avg]) => (
            <span key={tt} className="text-[10px] bg-ink/5 text-ink-light rounded-full px-2 py-0.5">
              {TOPIC_TYPE_LABELS[tt as ChineseTopicType] || tt}均分 {avg}
            </span>
          ))}
        </div>
      )}

      {/* Time selector */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-ink/5 flex items-center justify-center">
            <Clock size={14} className="text-ink-light" />
          </div>
          <span className="text-sm font-medium text-ink">训练时长</span>
          <span className="text-[10px] text-ink-lighter ml-auto">
            {selectedType && TOPIC_TYPE_LABELS[selectedType]}推荐 {DEFAULT_TIME_LIMITS[selectedType]} 秒
          </span>
        </div>
        <div className="flex gap-2">
          {TIME_OPTIONS.map((sec) => (
            <button
              key={sec}
              onClick={() => setTimeLimit(sec)}
              className={cn(
                "flex-1 rounded-xl py-2 text-sm font-medium transition-colors",
                timeLimit === sec
                  ? "bg-sage-light text-sage-deep"
                  : "bg-ink/5 text-ink-light hover:bg-ink/10",
              )}
            >
              {sec}秒
            </button>
          ))}
        </div>
        <p className="text-[10px] text-ink-lighter/70">
          时间到后不会立即切断，有15秒缓冲完成最后一句
        </p>
      </div>

      {/* Topic type cards */}
      <div>
        <p className="text-sm font-medium text-ink mb-3">选择话题类型</p>
        <div className="grid grid-cols-2 gap-2">
          {TOPIC_CARDS.map((card) => {
            const Icon = card.icon;
            const isSelected = selectedType === card.type;
            return (
              <button
                key={card.type}
                onClick={() => handleSelectType(card.type)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all",
                  isSelected
                    ? "border-sage-deep/50 bg-sage-light/20 ring-1 ring-sage-deep/20"
                    : "border-border bg-card hover:border-sage-light/50",
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center mb-2",
                  isSelected ? "bg-sage-deep/10 text-sage-deep" : "bg-ink/5 text-ink-light",
                )}>
                  <Icon size={16} />
                </div>
                <p className="text-sm font-medium text-ink">{TOPIC_TYPE_LABELS[card.type]}</p>
                <p className="text-[11px] text-ink-lighter mt-0.5 leading-tight">{card.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI topic generation */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles size={14} className="text-purple-600" />
            </div>
            <span className="text-sm font-medium text-ink">AI 推荐话题</span>
          </div>
          <button
            onClick={handleGenerateTopics}
            disabled={generatingTopics}
            className="text-xs text-sage-deep font-medium flex items-center gap-1 disabled:opacity-50"
          >
            {generatingTopics ? (
              <><Loader2 size={12} className="animate-spin" /> 生成中</>
            ) : (
              <>生成话题</>
            )}
          </button>
        </div>

        {topicError && (
          <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-2 text-xs text-accent-rose flex items-center gap-2">
            <AlertTriangle size={12} />
            {topicError}
          </div>
        )}

        {aiTopics.length > 0 && (
          <div className="space-y-2">
            {aiTopics.map((t, i) => (
              <button
                key={i}
                onClick={() => handleStartSession(t.topic, t.topic_type)}
                className="w-full rounded-xl border border-border p-3 text-left hover:border-sage-light/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{t.topic}</p>
                    <p className="text-[11px] text-ink-lighter mt-0.5">{t.description}</p>
                  </div>
                  <ChevronRight size={14} className="text-ink-lighter shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}

        {!aiTopics.length && !generatingTopics && !topicError && (
          <p className="text-xs text-ink-lighter">点击"生成话题"，AI 为你推荐 3 个{TOPIC_TYPE_LABELS[selectedType]}题目</p>
        )}
      </div>

      {/* Custom topic */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-ink/5 flex items-center justify-center">
            <Edit3 size={14} className="text-ink-light" />
          </div>
          <span className="text-sm font-medium text-ink">自定义话题</span>
        </div>

        {showCustomInput ? (
          <>
            <textarea
              className="w-full bg-transparent border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50 resize-none"
              rows={3}
              placeholder="输入你想练习的话题..."
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (customTopic.trim()) {
                    handleStartSession(customTopic.trim(), selectedType, customTopic.trim());
                  }
                }}
                disabled={!customTopic.trim() || createSession.isPending}
                className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createSession.isPending ? <><Loader2 size={14} className="animate-spin" /> 创建中</> : "开始练习"}
              </button>
              <button
                onClick={() => { setShowCustomInput(false); setCustomTopic(""); }}
                className="text-sm text-ink-light px-3"
              >
                取消
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setShowCustomInput(true)}
            className="w-full rounded-xl border-2 border-dashed border-sage-light/40 p-3 text-sm text-ink-light hover:border-sage-light/60 transition-colors"
          >
            输入你自己的话题...
          </button>
        )}
      </div>

      {/* History link */}
      {stats && stats.total_sessions > 0 && (
        <button
          onClick={() => navigate("/chinese/history")}
          className="w-full bg-card rounded-xl border border-border p-3 flex items-center justify-between hover:border-sage-light/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center">
              <BarChart3 size={16} className="text-ink-light" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-ink">历史记录</p>
              <p className="text-[11px] text-ink-lighter">查看过往练习记录</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-ink-lighter" />
        </button>
      )}
    </div>
  );
}
