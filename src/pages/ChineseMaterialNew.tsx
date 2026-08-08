import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, FileText, Video, BookOpen, Loader2, AlertTriangle,
  Sparkles, ChevronRight, Target, Lightbulb, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateResource } from "@/lib/hooks/useResources";
import {
  useCreateChineseSpeakingSession,
  extractMaterial,
  generateMaterialQuestions,
  TOPIC_TYPE_LABELS,
  type ChineseTopicType,
  type MaterialAnalysis,
  type GeneratedMaterialQuestion,
} from "@/lib/hooks/useChineseSpeaking";

type SourceType = "article" | "video_reflection" | "book_note";

type Step = "input" | "analyzing" | "questions" | "starting";

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

  // Analysis results
  const [materialAnalysis, setMaterialAnalysis] = useState<MaterialAnalysis | null>(null);
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

    // Step 2: Extract material analysis
    const extractResult = await extractMaterial(contentText, sourceType);
    if (!extractResult.success) {
      setError(extractResult.error);
      setStep("input");
      return;
    }
    setMaterialAnalysis(extractResult.data);

    // Step 3: Generate questions
    const questionResult = await generateMaterialQuestions(extractResult.data);
    if (!questionResult.success) {
      setError(questionResult.error);
      setStep("input");
      return;
    }
    setQuestions(questionResult.data.questions);
    setStep("questions");

    // Cache resourceId for session creation
    (window as unknown as Record<string, unknown>)._materialResourceId = resourceId;
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

      {/* Material analysis + questions */}
      {step === "questions" && materialAnalysis && (
        <>
          {/* Material analysis card */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-sage-deep" />
              <span className="text-sm font-medium text-ink">材料分析</span>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-ink-lighter uppercase tracking-wide">核心观点</p>
                <p className="text-sm text-ink leading-relaxed">{materialAnalysis.core_argument}</p>
              </div>

              {materialAnalysis.key_points.length > 0 && (
                <div>
                  <p className="text-[10px] text-ink-lighter uppercase tracking-wide">关键要点</p>
                  <ul className="space-y-1">
                    {materialAnalysis.key_points.map((p, i) => (
                      <li key={i} className="text-xs text-ink-light flex gap-2">
                        <span className="text-sage-deep shrink-0 mt-0.5">•</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {materialAnalysis.expression_angles.length > 0 && (
                <div>
                  <p className="text-[10px] text-ink-lighter uppercase tracking-wide">表达角度</p>
                  <div className="flex flex-wrap gap-1">
                    {materialAnalysis.expression_angles.map((a, i) => (
                      <span key={i} className="text-[10px] bg-sage-light/30 text-sage-deep rounded-full px-2 py-0.5">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Questions */}
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
            onClick={() => { setStep("input"); setError(null); }}
            className="w-full text-center text-sm text-ink-light py-2"
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
