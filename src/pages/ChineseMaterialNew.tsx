import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, FileText, Video, BookOpen, Loader2, AlertTriangle,
  Sparkles, ChevronRight, Target, Lightbulb, Send, Compass,
  Bookmark, Layers, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateResource } from "@/lib/hooks/useResources";
import {
  useCreateChineseSpeakingSession,
  extractMaterial,
  generateMaterialQuestions,
  saveMaterialCard,
  TOPIC_TYPE_LABELS,
  type ChineseTopicType,
  type MaterialCard,
  type KeyArgument,
  type KeyExample,
  type ExpressionAngle,
  type GeneratedMaterialQuestion,
} from "@/lib/hooks/useChineseSpeaking";

type SourceType = "article" | "video_reflection" | "book_note";

type Step = "input" | "analyzing" | "card" | "questions" | "starting";

const SOURCE_TABS: { key: SourceType; label: string; icon: typeof FileText; description: string }[] = [
  { key: "article", label: "粘贴文章", icon: FileText, description: "粘贴一篇文章，AI帮你提炼表达素材" },
  { key: "video_reflection", label: "视频感悟", icon: Video, description: "记录你观看视频后的反思和想法" },
  { key: "book_note", label: "读书笔记", icon: BookOpen, description: "整理你的读书笔记和关键摘录" },
];

const SOURCE_TYPE_TO_RESOURCE_TYPE: Record<SourceType, string> = {
  article: "article",
  video_reflection: "reflection",
  book_note: "book",
};

export default function ChineseMaterialNew() {
  const [, navigate] = useLocation();
  const createResource = useCreateResource();
  const createSession = useCreateChineseSpeakingSession();

  const [step, setStep] = useState<Step>("input");
  const [sourceType, setSourceType] = useState<SourceType>("article");
  const [error, setError] = useState<string | null>(null);

  // Article fields
  const [articleTitle, setArticleTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");

  // Video reflection fields
  const [videoTitle, setVideoTitle] = useState("");
  const [videoSource, setVideoSource] = useState("");
  const [videoReflection, setVideoReflection] = useState("");

  // Book note fields
  const [bookName, setBookName] = useState("");
  const [bookChapter, setBookChapter] = useState("");
  const [bookNotes, setBookNotes] = useState("");

  // Material Card (Phase 3.1)
  const [materialCard, setMaterialCard] = useState<MaterialCard | null>(null);
  const [selectedAngleIndex, setSelectedAngleIndex] = useState<number | null>(null);
  const [showFullArguments, setShowFullArguments] = useState(false);
  const [showFullExamples, setShowFullExamples] = useState(false);
  const [questions, setQuestions] = useState<GeneratedMaterialQuestion[]>([]);

  const charLimit = 8000;

  function getContentText(): string {
    switch (sourceType) {
      case "article":
        return `标题：${articleTitle}\n\n${articleContent}`;
      case "video_reflection":
        return `视频：${videoTitle}${videoSource ? `（来源：${videoSource}）` : ""}\n\n我的感悟：${videoReflection}`;
      case "book_note":
        return `书名：${bookName}${bookChapter ? `\n章节：${bookChapter}` : ""}\n\n笔记：${bookNotes}`;
    }
  }

  function getTitle(): string {
    switch (sourceType) {
      case "article": return articleTitle;
      case "video_reflection": return `视频感悟：${videoTitle}`;
      case "book_note": return `读书笔记：${bookName}`;
    }
  }

  function getContentLength(): number {
    return getContentText().length;
  }

  function isValid(): boolean {
    const len = getContentLength();
    if (len < 20) return false;
    if (len > charLimit) return false;
    switch (sourceType) {
      case "article": return articleTitle.trim().length > 0 && articleContent.trim().length > 0;
      case "video_reflection": return videoTitle.trim().length > 0 && videoReflection.trim().length > 0;
      case "book_note": return bookName.trim().length > 0 && bookNotes.trim().length > 0;
    }
  }

  async function handleAnalyze() {
    if (!isValid()) return;
    setError(null);
    setStep("analyzing");

    const contentText = getContentText();
    const title = getTitle();

    // Step 1: Save material to resources
    let resourceId = "";
    try {
      const resource = await createResource.mutateAsync({
        title,
        resource_type: SOURCE_TYPE_TO_RESOURCE_TYPE[sourceType],
        module: "chinese_speaking",
        raw_content: contentText,
        source_title: title,
        status: "saved",
      });
      resourceId = resource.id;
    } catch {
      setError("保存材料失败，请重试");
      setStep("input");
      return;
    }

    // Step 2: Generate Material Card (single AI call)
    const extractResult = await extractMaterial(contentText, sourceType);
    if (!extractResult.success) {
      setError(extractResult.error);
      setStep("input");
      return;
    }
    const card = extractResult.data.material_card;
    setMaterialCard(card);

    // Step 3: Persist Material Card to resources.ai_analysis
    try {
      await saveMaterialCard(resourceId, card);
    } catch {
      // Non-fatal: card is still in state, user can proceed
    }

    // Cache resourceId for session creation
    (window as unknown as Record<string, unknown>)._materialResourceId = resourceId;

    setStep("card");
  }

  async function handleGenerateQuestions(angleIndex: number | null) {
    if (!materialCard) return;
    setError(null);
    setStep("analyzing");

    const result = await generateMaterialQuestions(materialCard, angleIndex ?? undefined);
    if (!result.success) {
      setError(result.error);
      setStep("card");
      return;
    }
    setQuestions(result.data.questions);
    setStep("questions");
  }

  async function handleStartSession(question: GeneratedMaterialQuestion) {
    setStep("starting");
    setError(null);

    const resourceId = (window as unknown as Record<string, unknown>)._materialResourceId as string;

    try {
      const session = await createSession.mutateAsync({
        topic: question.question,
        topic_type: question.recommended_skill,
        mode: "material_retelling",
        time_limit_seconds: 60,
        material_resource_id: resourceId,
      });
      delete (window as unknown as Record<string, unknown>)._materialResourceId;
      navigate(`/chinese/session/${session.id}`);
    } catch {
      setError("创建训练失败，请重试");
      setStep("questions");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/chinese")} className="p-1 -ml-1 rounded-lg hover:bg-ink/5">
          <ArrowLeft size={18} className="text-ink-light" />
        </button>
        <div>
          <p className="text-sm text-ink-lighter">材料训练</p>
          <h1 className="text-xl font-semibold tracking-tight mt-0.5">新材料</h1>
        </div>
      </header>

      {/* Source type tabs */}
      {step === "input" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {SOURCE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isSelected = sourceType === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSourceType(tab.key)}
                  className={cn(
                    "rounded-xl border p-3 text-center transition-all",
                    isSelected
                      ? "border-sage-deep/50 bg-sage-light/20 ring-1 ring-sage-deep/20"
                      : "border-border bg-card hover:border-sage-light/50",
                  )}
                >
                  <Icon size={18} className={cn("mx-auto mb-1", isSelected ? "text-sage-deep" : "text-ink-light")} />
                  <p className="text-xs font-medium text-ink">{tab.label}</p>
                </button>
              );
            })}
          </div>

          {/* Input form */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            {sourceType === "article" && (
              <>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-border pb-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50"
                  placeholder="文章标题"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                />
                <textarea
                  className="w-full bg-transparent border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50 resize-none"
                  rows={10}
                  placeholder="粘贴文章正文内容（最多8000字）..."
                  value={articleContent}
                  onChange={(e) => setArticleContent(e.target.value)}
                />
              </>
            )}

            {sourceType === "video_reflection" && (
              <>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-border pb-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50"
                  placeholder="视频标题"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                />
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-border pb-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50"
                  placeholder="视频来源（可选，如：B站/B站up主名称）"
                  value={videoSource}
                  onChange={(e) => setVideoSource(e.target.value)}
                />
                <textarea
                  className="w-full bg-transparent border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50 resize-none"
                  rows={8}
                  placeholder="记录你对视频内容的感悟和思考..."
                  value={videoReflection}
                  onChange={(e) => setVideoReflection(e.target.value)}
                />
              </>
            )}

            {sourceType === "book_note" && (
              <>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-border pb-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50"
                  placeholder="书名"
                  value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                />
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-border pb-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50"
                  placeholder="章节（可选）"
                  value={bookChapter}
                  onChange={(e) => setBookChapter(e.target.value)}
                />
                <textarea
                  className="w-full bg-transparent border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50 resize-none"
                  rows={8}
                  placeholder="记录你的读书笔记和关键摘录..."
                  value={bookNotes}
                  onChange={(e) => setBookNotes(e.target.value)}
                />
              </>
            )}

            {/* Char count */}
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-[10px]",
                getContentLength() > charLimit ? "text-accent-rose" : "text-ink-lighter",
              )}>
                {getContentLength()} / {charLimit} 字
                {getContentLength() > charLimit && " — 请精简内容"}
              </span>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!isValid()}
              className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Sparkles size={14} />
              AI 分析材料
            </button>
          </div>
        </>
      )}

      {/* Analyzing state */}
      {step === "analyzing" && (
        <div className="bg-card rounded-2xl border border-border p-8 flex flex-col items-center space-y-4">
          <Loader2 size={32} className="animate-spin text-sage-deep" />
          <p className="text-sm text-ink-light">AI 正在分析材料...</p>
          <p className="text-[11px] text-ink-lighter">提炼核心观点、寻找表达角度、生成训练问题</p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 text-xs text-accent-rose flex items-center gap-2">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      {/* Phase 3.1: Material Card — cognitive buffer layer */}
      {step === "card" && materialCard && (
        <>
          {/* Card header */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="bg-sage-light/20 px-4 py-3 flex items-center gap-2">
              <Bookmark size={16} className="text-sage-deep" />
              <span className="text-sm font-semibold text-ink">我理解这份材料</span>
              <span className="text-[10px] text-ink-lighter ml-auto">{materialCard.source_type}</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Title + Summary */}
              <div>
                <h2 className="text-base font-semibold text-ink">{materialCard.title}</h2>
                <p className="text-xs text-ink-light mt-1 leading-relaxed">{materialCard.source_summary}</p>
              </div>

              {/* Core Argument */}
              <div className="bg-ink/3 rounded-xl p-3">
                <p className="text-[10px] text-ink-lighter uppercase tracking-wide mb-1">核心观点</p>
                <p className="text-sm text-ink leading-relaxed">{materialCard.core_argument}</p>
              </div>

              {/* Key Arguments */}
              {materialCard.key_arguments.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowFullArguments(!showFullArguments)}
                    className="flex items-center gap-1.5 text-[10px] text-ink-lighter uppercase tracking-wide mb-2"
                  >
                    <Layers size={12} />
                    核心论点 ({materialCard.key_arguments.length})
                    {showFullArguments ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <div className={cn("space-y-2", !showFullArguments && "line-clamp-2")}>
                    {materialCard.key_arguments.map((arg, i) => (
                      <div key={i} className="bg-card border border-border rounded-xl p-3">
                        <p className="text-sm font-medium text-ink">{arg.point}</p>
                        <p className="text-xs text-ink-light mt-1">{arg.explanation}</p>
                        {arg.example && (
                          <p className="text-[11px] text-sage-deep mt-1.5 bg-sage-light/20 rounded-lg px-2 py-1">
                            例：{arg.example}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Examples */}
              {materialCard.key_examples.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowFullExamples(!showFullExamples)}
                    className="flex items-center gap-1.5 text-[10px] text-ink-lighter uppercase tracking-wide mb-2"
                  >
                    <Bookmark size={12} />
                    关键案例 ({materialCard.key_examples.length})
                    {showFullExamples ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <div className={cn("space-y-2", !showFullExamples && "line-clamp-1")}>
                    {materialCard.key_examples.map((ex, i) => (
                      <div key={i} className="bg-card border border-border rounded-xl p-3">
                        <p className="text-sm font-medium text-ink">{ex.case}</p>
                        <p className="text-xs text-ink-light mt-1">{ex.meaning}</p>
                        <p className="text-[11px] text-purple-600 mt-1.5 bg-purple-50 rounded-lg px-2 py-1">
                          可用于：{ex.can_use_in_expression}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expression Angles — user selects one */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Compass size={16} className="text-sage-deep" />
              <span className="text-sm font-medium text-ink">选择表达方向</span>
              <span className="text-[10px] text-ink-lighter ml-auto">选一个方向开始训练</span>
            </div>
            <div className="space-y-2">
              {materialCard.expression_angles.map((angle, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedAngleIndex(i);
                    handleGenerateQuestions(i);
                  }}
                  className={cn(
                    "w-full bg-card rounded-xl border p-4 text-left transition-all hover:border-sage-light/50",
                    selectedAngleIndex === i
                      ? "border-sage-deep/50 bg-sage-light/10 ring-1 ring-sage-deep/20"
                      : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-ink">{angle.angle}</p>
                      <p className="text-xs text-ink-lighter">{angle.possible_question}</p>
                    </div>
                    <span className="text-[10px] bg-sage-light/30 text-sage-deep rounded-full px-2 py-0.5 shrink-0">
                      {TOPIC_TYPE_LABELS[angle.recommended_skill] || angle.recommended_skill}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recommended skill badge */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-3">
            <Target size={16} className="text-purple-600 shrink-0" />
            <div>
              <p className="text-xs font-medium text-purple-700">
                推荐：{TOPIC_TYPE_LABELS[materialCard.recommended_skill] || materialCard.recommended_skill}
              </p>
              <p className="text-[11px] text-purple-600/70">{materialCard.training_reason}</p>
            </div>
          </div>

          {/* Quick start: skip angle selection, use recommended */}
          <button
            onClick={() => handleGenerateQuestions(null)}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Sparkles size={14} />
            直接开始训练（使用推荐方向）
          </button>

          <button
            onClick={() => { setStep("input"); setError(null); }}
            className="w-full text-center text-sm text-ink-light py-2"
          >
            重新输入材料
          </button>
        </>
      )}

      {/* Questions — generated after angle selection */}
      {step === "questions" && (
        <>
          <div>
            <p className="text-sm font-medium text-ink mb-3">选择训练问题</p>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleStartSession(q)}
                  className="w-full bg-card rounded-xl border border-border p-4 text-left hover:border-sage-light/50 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-ink">{q.question}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-ink/5 rounded-full px-2 py-0.5 text-ink-lighter">
                          {q.question_type === "opinion" ? "观点" : q.question_type === "explanation" ? "解释" : "应用"}
                        </span>
                        <span className="text-[10px] text-ink-lighter">
                          {TOPIC_TYPE_LABELS[q.recommended_skill]}
                        </span>
                      </div>
                    </div>
                    <div className="h-7 w-7 rounded-full bg-sage-light/30 flex items-center justify-center shrink-0 group-hover:bg-sage-light/50 transition-colors">
                      <Send size={12} className="text-sage-deep" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => { setStep("card"); setError(null); }}
            className="w-full text-center text-sm text-ink-light py-2"
          >
            返回选择其他方向
          </button>

          <button
            onClick={() => { setStep("input"); setError(null); }}
            className="w-full text-center text-sm text-ink-lighter py-1"
          >
            重新输入材料
          </button>
        </>
      )}

      {/* Starting session */}
      {step === "starting" && (
        <div className="bg-card rounded-2xl border border-border p-8 flex flex-col items-center space-y-4">
          <Loader2 size={32} className="animate-spin text-sage-deep" />
          <p className="text-sm text-ink-light">正在创建训练...</p>
        </div>
      )}
    </div>
  );
}
