import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Mic, MicOff, Square, Plus, ChevronRight, Sparkles,
  Loader2, CheckCircle2, AlertTriangle, Play, Pause, RefreshCw,
  Home, MessageSquare, Coffee, Briefcase, GraduationCap, Heart,
  Target, Clock, BarChart3, Zap, X, Search, Shuffle, Bot, Library,
  Filter, ChevronDown, MoreHorizontal, Edit3, Trash2, Flag,
} from "lucide-react";
import {
  useSpeakingSessions, useSpeakingSession, useCreateSpeakingSessionV2,
  useCreateSpeakingAttempt, useCreateExpression, uploadAudio, useDueExpressions, useSpeakingStats,
  useSpeakingQuestions, useSpeakingQuestionHistory, useRecordSpeakingQuestionUsage,
  useUpdateSpeakingSession, useSoftDeleteSpeakingSession,
} from "@/lib/hooks/useEnglish";
import type { SpeakingQuestion, SpeakingQuestionHistoryEntry } from "@/lib/hooks/useEnglish";
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";
import {
  analyzeSpeaking, buildCombinedFeedback,
  generateCategoryQuestion, generateExpressionPracticeQuestion,
  generateReferenceAnswer,
} from "@/lib/ai/englishCoach";
import type { SpeakingFeedback, ExpressionUpgrade } from "@/lib/ai/englishCoach";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ── Types ──

type Step = "generating" | "record" | "review" | "analyzing" | "results" | "saved" | "retry_record" | "retry_review" | "retry_analyzing" | "retry_results" | "empty_expression_practice";
type ViewState = "home" | "mode_detail" | "browse" | "new" | "detail";

interface ModeDef {
  key: string;
  label: string;
  labelEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  desc: string;
}

const MODE_DEFS: ModeDef[] = [
  {
    key: "ielts", label: "雅思口语", labelEn: "IELTS Speaking",
    icon: GraduationCap,
    desc: "Part 1, 2, 3 结构化练习，涵盖常见雅思话题",
  },
  {
    key: "daily", label: "日常对话", labelEn: "Daily Conversation",
    icon: Coffee,
    desc: "日常场景对话，提升生活英语的自然度和流利度",
  },
  {
    key: "professional", label: "专业英语", labelEn: "Professional English",
    icon: Briefcase,
    desc: "职场沟通、会议、演讲等商务场景演练",
  },
  {
    key: "personal_growth", label: "个人成长", labelEn: "Personal Growth",
    icon: Heart,
    desc: "深度自我表达，探讨人生、情感与价值观话题",
  },
];

const MODE_COLORS: Record<string, string> = {
  ielts: "bg-purple-50 text-purple-600",
  daily: "bg-amber-50 text-amber-600",
  professional: "bg-blue-50 text-blue-600",
  personal_growth: "bg-emerald-50 text-emerald-600",
};

const TOPIC_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "全部话题" },
  { value: "life_routine", label: "日常生活" },
  { value: "food_health", label: "饮食健康" },
  { value: "travel_culture", label: "旅行文化" },
  { value: "people_relationships", label: "人际社交" },
  { value: "study_learning", label: "学习学术" },
  { value: "work_career", label: "工作职场" },
  { value: "technology", label: "科技" },
  { value: "entertainment", label: "娱乐" },
  { value: "emotions", label: "情绪心理" },
  { value: "goals_future", label: "目标未来" },
  { value: "experiences", label: "经历体验" },
  { value: "opinions", label: "观点看法" },
];

const IELTS_PARTS: { value: string; label: string }[] = [
  { value: "", label: "全部 Part" },
  { value: "part1", label: "Part 1" },
  { value: "part2", label: "Part 2" },
  { value: "part3", label: "Part 3" },
];

const TOPIC_LABEL_MAP: Record<string, string> = Object.fromEntries(
  TOPIC_OPTIONS.filter(t => t.value).map(t => [t.value, t.label])
);

// ── Question Selection Algorithm ──

function selectQuestionFromBank(
  questions: SpeakingQuestion[],
  history: SpeakingQuestionHistoryEntry[],
  excludeIds: Set<string>,
): SpeakingQuestion | null {
  const recentlyPracticedIds = new Set(history.map(h => h.question_id));

  // First pass: filter out recently practiced and excluded questions
  const freshCandidates = questions
    .filter(q => q.is_active && !excludeIds.has(q.id) && !recentlyPracticedIds.has(q.id))
    .sort((a, b) => {
      if (a.usage_count !== b.usage_count) return a.usage_count - b.usage_count;
      if (!a.last_used_at && !b.last_used_at) return 0;
      if (!a.last_used_at) return -1;
      if (!b.last_used_at) return 1;
      return new Date(a.last_used_at).getTime() - new Date(b.last_used_at).getTime();
    });

  if (freshCandidates.length > 0) {
    const pool = freshCandidates.slice(0, 15);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // All practiced in this round: pick LRU from all active
  const allCandidates = questions
    .filter(q => q.is_active && !excludeIds.has(q.id))
    .sort((a, b) => {
      if (!a.last_used_at && !b.last_used_at) return 0;
      if (!a.last_used_at) return -1;
      if (!b.last_used_at) return 1;
      return new Date(a.last_used_at).getTime() - new Date(b.last_used_at).getTime();
    });

  return allCandidates[0] || null;
}

import { useAudioRecorder } from "@/lib/hooks/useAudioRecorder";

// ── Score Bar ──

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.min((score / 9) * 100, 100);
  const color = score >= 7 ? "bg-emerald-400" : score >= 5.5 ? "bg-amber-400" : "bg-accent-rose/60";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-light w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-ink/10 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-medium text-ink w-7 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

// ── Format duration ──

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ── Phase 6: Comparison Score Bar ──

function ComparisonScoreBar({ label, before, after }: { label: string; before: number; after: number }) {
  const delta = after - before;
  const improved = delta > 0;
  const barBefore = Math.min((before / 9) * 100, 100);
  const barAfter = Math.min((after / 9) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ink-light">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-ink-lighter">{before.toFixed(1)}</span>
          <span className="text-ink-lighter">→</span>
          <span className={cn("font-medium", improved ? "text-emerald-600" : "text-accent-rose")}>
            {after.toFixed(1)}
          </span>
          {delta !== 0 && (
            <span className={cn(
              "text-[10px] font-medium",
              improved ? "text-emerald-500" : "text-accent-rose"
            )}>
              {improved ? "+" : ""}{delta.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="flex-1 h-1.5 bg-ink/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all bg-ink/20"
            style={{ width: `${barBefore}%` }}
          />
        </div>
        <div className="flex-1 h-1.5 bg-ink/5 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", improved ? "bg-emerald-400" : "bg-accent-rose/60")}
            style={{ width: `${barAfter}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── SRS auto-lowering for missed expressions ──

async function lowerMissedExpressions(missedExpressions: string[]) {
  const now = new Date().toISOString();
  for (const expr of missedExpressions) {
    const { data: matches } = await supabase
      .from("expressions")
      .select("id, ease_factor")
      .eq("archived", false)
      .eq("english", expr.trim())
      .limit(5);

    if (!matches || matches.length === 0) continue;

    for (const row of matches) {
      const currentEF = (row.ease_factor as number) || 2.5;
      const newEF = Math.max(1.3, currentEF * 0.8);
      await supabase
        .from("expressions")
        .update({
          ease_factor: newEF,
          next_review_date: now,
          updated_at: now,
        })
        .eq("id", row.id);
    }
  }
}

async function boostUsedExpressions(usedExpressions: string[]) {
  const future = new Date();
  future.setDate(future.getDate() + 3);
  const futureStr = future.toISOString();
  for (const expr of usedExpressions) {
    const { data: matches } = await supabase
      .from("expressions")
      .select("id, ease_factor, review_count")
      .eq("archived", false)
      .eq("english", expr.trim())
      .limit(5);

    if (!matches || matches.length === 0) continue;

    for (const row of matches) {
      const currentEF = (row.ease_factor as number) || 2.5;
      const newEF = Math.min(3.0, currentEF + 0.1);
      await supabase
        .from("expressions")
        .update({
          ease_factor: newEF,
          review_count: ((row.review_count as number) || 0) + 1,
          next_review_date: futureStr,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }
}

// ── Main Page ──

export default function EnglishSpeaking() {
  const [, navigate] = useLocation();

  // View management
  const [view, setView] = useState<ViewState>("home");
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  // Mode-based entry state
  const [selectedMode, setSelectedMode] = useState<string>("");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedPart, setSelectedPart] = useState<string>("");

  // Question tracking
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  // Track questions used in this session to avoid repeats
  const [usedQuestionIds, setUsedQuestionIds] = useState<Set<string>>(new Set());

  // New session state
  const [step, setStep] = useState<Step>("generating");
  const [mode, setMode] = useState<"free_speaking" | "expression_practice">("free_speaking");
  const [question, setQuestion] = useState("");
  const [questionContext, setQuestionContext] = useState("");
  const [suitableExpressions, setSuitableExpressions] = useState<{ english: string; chinese: string }[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Guards & locks
  const isStartingRef = useRef(false); // sync lock prevents double-session

  // AI analysis state
  const [isStarting, setIsStarting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [referenceAnswer, setReferenceAnswer] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [addedUpgrades, setAddedUpgrades] = useState<Set<number>>(new Set());
  const [textMode, setTextMode] = useState(false);
  const [duplicateUpgrades, setDuplicateUpgrades] = useState<Set<number>>(new Set());
  const [addBankError, setAddBankError] = useState<string | null>(null);
  const referenceAnswerPromise = useRef<Promise<void> | null>(null);

  // Phase 6: Retry flow state
  const [firstFeedback, setFirstFeedback] = useState<SpeakingFeedback | null>(null);
  const [firstAttemptId, setFirstAttemptId] = useState<string | null>(null);
  const [firstTranscript, setFirstTranscript] = useState<string>("");
  const [firstAudioUrl, setFirstAudioUrl] = useState<string>("");
  const [firstDuration, setFirstDuration] = useState<number>(0);
  const [retryFeedback, setRetryFeedback] = useState<SpeakingFeedback | null>(null);
  const [retryAudioBlob, setRetryAudioBlob] = useState<Blob | null>(null);
  const [retryAudioUrl, setRetryAudioUrl] = useState<string>("");
  const [retryTranscript, setRetryTranscript] = useState<string>("");
  const [retryDuration, setRetryDuration] = useState<number>(0);

  // History management state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<{ id: string; title: string; notes: string; prompt: string } | null>(null);
  const [deletingSession, setDeletingSession] = useState<{ id: string; prompt: string } | null>(null);

  // Phase 6: Collapsible language analysis
  const [showLanguageAnalysis, setShowLanguageAnalysis] = useState(true);

  // Browse state
  const [browseMode, setBrowseMode] = useState<string>("");
  const [browseTopic, setBrowseTopic] = useState<string>("");
  const [browsePart, setBrowsePart] = useState<string>("");
  const [browseSearch, setBrowseSearch] = useState("");
  const [browsePage, setBrowsePage] = useState(0);
  const BROWSE_PAGE_SIZE = 15;

  // Data
  const { data: sessions, isLoading: sessionsLoading } = useSpeakingSessions();
  const { data: stats } = useSpeakingStats();
  const { data: dueExpressions } = useDueExpressions();
  const createSession = useCreateSpeakingSessionV2();
  const createAttempt = useCreateSpeakingAttempt();
  const updateSession = useUpdateSpeakingSession();
  const deleteSession = useSoftDeleteSpeakingSession();
  const createExpression = useCreateExpression();
  const recordUsage = useRecordSpeakingQuestionUsage();

  // Bank queries
  const { data: bankQuestions } = useSpeakingQuestions({
    mode: selectedMode || undefined,
    topic: selectedTopic || undefined,
    part: selectedPart || undefined,
    is_active: true,
  });
  const { data: questionHistory } = useSpeakingQuestionHistory(30);

  // Browse query
  const { data: browseQuestions } = useSpeakingQuestions({
    mode: browseMode || undefined,
    topic: browseTopic || undefined,
    part: browsePart || undefined,
    search: browseSearch || undefined,
    is_active: true,
    limit: 200,
  });

  const recorder = useAudioRecorder();
  const asr = useSpeechRecognition();

  // ── Mode Entry Handlers ──

  const handlePickMode = (modeKey: string) => {
    setSelectedMode(modeKey);
    setSelectedTopic("");
    setSelectedPart("");
    setView("mode_detail");
  };

  const handleRecommend = () => {
    if (!bankQuestions || bankQuestions.length === 0) {
      // No bank questions — AI fallback
      handleAiGenerate();
      return;
    }

    const selected = selectQuestionFromBank(
      bankQuestions,
      questionHistory || [],
      usedQuestionIds,
    );

    if (!selected) {
      handleAiGenerate();
      return;
    }

    setCurrentQuestionId(selected.id);
    setIsAiGenerated(false);
    setUsedQuestionIds(prev => new Set(prev).add(selected.id));
    setQuestion(selected.question);
    setQuestionContext(selected.context || "");
    setSuitableExpressions([]);
    setMode("free_speaking");
    setView("new");
    setStep("record");
  };

  const handleAiGenerate = () => {
    setCurrentQuestionId(null);
    setIsAiGenerated(true);
    setMode("free_speaking");
    setView("new");
    setStep("generating");
  };

  const handleBrowsePickQuestion = (q: SpeakingQuestion) => {
    setCurrentQuestionId(q.id);
    setIsAiGenerated(false);
    setUsedQuestionIds(prev => new Set(prev).add(q.id));
    setQuestion(q.question);
    setQuestionContext(q.context || "");
    setSuitableExpressions([]);
    setMode("free_speaking");
    setView("new");
    setStep("record");
  };

  const handleStartExpressionPractice = () => {
    if (!dueExpressions || dueExpressions.length === 0) {
      setView("new");
      setMode("expression_practice");
      setSelectedMode("");
      setCurrentQuestionId(null);
      setIsAiGenerated(false);
      setStep("empty_expression_practice");
      return;
    }
    setView("new");
    setMode("expression_practice");
    setSelectedMode("");
    setCurrentQuestionId(null);
    setIsAiGenerated(false);
    setStep("generating");
  };

  // ── Recording Handlers ──

  const handleStartRecording = async () => {
    // Sync guard prevents double-click creating multiple sessions
    if (isStartingRef.current || recorder.state !== "idle") return;
    isStartingRef.current = true;
    setIsStarting(true);
    setAiError(null);

    // Persist question context in case of page refresh
    if (currentQuestionId) {
      try { sessionStorage.setItem("speaking_current_question_id", currentQuestionId); } catch {}
    }

    try {
      console.log("[EnglishSpeaking] Creating session", { mode, question_id: currentQuestionId, question_preview: question.substring(0, 60) });
      const result = await createSession.mutateAsync({
        prompt: question,
        context: questionContext,
        category: selectedMode || undefined,
        mode,
        recommended_expressions: suitableExpressions.length > 0 ? suitableExpressions : undefined,
        question_id: currentQuestionId || undefined,
      });
      setSessionId(result.id as string);
      asr.setSessionId(result.id as string);
      console.log("[EnglishSpeaking] Session created", { session_id: result.id });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await Promise.all([
        recorder.start(stream),
        asr.start(stream),
      ]);
      console.log("[EnglishSpeaking] Recording started");
      setIsStarting(false);
      isStartingRef.current = false;
    } catch (err) {
      console.error("[EnglishSpeaking] handleStartRecording failed:", err);
      setAiError("创建练习会话失败，请检查网络或重新登录。");
      setIsStarting(false);
      isStartingRef.current = false;
    }
  };

  const handleStopRecording = async () => {
    recorder.stop();
    await asr.stop();
  };

  // Batch fallback — only for non-realtime providers.
  // Realtime providers (aliyun-realtime) stream via WebSocket; they never
  // need a batch fallback. Only trigger when the active provider is a
  // batch provider AND no transcript was produced.
  useEffect(() => {
    if (
      recorder.state === "done" &&
      recorder.blob &&
      !asr.transcript &&
      asr.supported &&
      !asr.isProcessing
    ) {
      // Only skip batch fallback if realtime provider produced a transcript.
      // If transcript is empty, the realtime WebSocket may have failed silently
      // (e.g. missing appkey in StopTranscription), so allow batch fallback.
      if (asr.isRealtimeProvider && asr.transcript) {
        console.log(
          "[EnglishSpeaking] Realtime provider has transcript — skipping batch fallback. provider=%s len=%d",
          asr.providerName, asr.transcript.length,
        );
        return;
      }
      if (asr.isRealtimeProvider && !asr.transcript) {
        console.warn(
          "[EnglishSpeaking] Realtime provider active but no transcript — " +
          "WebSocket may have failed silently. Allowing batch fallback. provider=%s",
          asr.providerName,
        );
      }
      console.log(
        "[EnglishSpeaking] Batch provider fallback triggered — provider=%s mode=%s",
        asr.providerName, asr.recognitionMode,
      );
      asr.markFallback();
      asr.stop(recorder.blob);
    }
  }, [recorder.state, recorder.blob, asr.transcript, asr.supported, asr.isProcessing, asr.isRealtimeProvider, asr.providerName, asr.recognitionMode, asr.stop, asr.markFallback]);

  // Warn before leaving mid-practice (mobile back button / browser back)
  useEffect(() => {
    if (view !== "new") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [view]);

  const handleGoToReview = async () => {
    if (asr.isProcessing) {
      await new Promise<void>((r) => {
        const started = Date.now();
        const MAX_WAIT = 30_000;
        const check = setInterval(() => {
          if (!asr.isProcessing || Date.now() - started > MAX_WAIT) {
            clearInterval(check);
            r();
          }
        }, 150);
      });
    }
    if (asr.supported && asr.isListening) {
      await new Promise<void>((r) => setTimeout(r, 500));
    }
    console.log("[EnglishSpeaking] Entering review", { has_transcript: !!asr.transcript.trim(), duration: recorder.duration });
    setStep("review");
  };

  // ── Phase 6: Retry flow handlers ──

  const [retryReferenceMode, setRetryReferenceMode] = useState<"structure" | "full" | "hidden">("structure");

  const handleRetryStartRecording = async () => {
    if (isStartingRef.current || recorder.state !== "idle") return;
    isStartingRef.current = true;
    setIsStarting(true);
    setAiError(null);

    try {
      console.log("[EnglishSpeaking] Starting retry recording", { session_id: sessionId });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await Promise.all([
        recorder.start(stream),
        asr.start(stream),
      ]);
      console.log("[EnglishSpeaking] Retry recording started");
      setIsStarting(false);
      isStartingRef.current = false;
    } catch (err) {
      console.error("[EnglishSpeaking] handleRetryStartRecording failed:", err);
      setAiError("启动录音失败，请检查麦克风权限。");
      setIsStarting(false);
      isStartingRef.current = false;
    }
  };

  const handleRetryGoToReview = async () => {
    if (asr.isProcessing) {
      await new Promise<void>((r) => {
        const started = Date.now();
        const MAX_WAIT = 30_000;
        const check = setInterval(() => {
          if (!asr.isProcessing || Date.now() - started > MAX_WAIT) {
            clearInterval(check);
            r();
          }
        }, 150);
      });
    }
    if (asr.supported && asr.isListening) {
      await new Promise<void>((r) => setTimeout(r, 500));
    }
    // Save retry transcript and audio for later comparison
    setRetryTranscript(asr.transcript);
    setRetryDuration(recorder.duration);
    if (recorder.blob) {
      setRetryAudioBlob(recorder.blob);
      setRetryAudioUrl(recorder.audioUrl || "");
    }
    console.log("[EnglishSpeaking] Entering retry review", { has_transcript: !!asr.transcript.trim(), duration: recorder.duration });
    setStep("retry_review");
  };

  const handleRetryAnalyze = async () => {
    const text = asr.transcript.trim();
    if (!text) {
      setAiError("请先输入或确认你说的话，AI 无法分析空白内容。");
      return;
    }
    setAnalyzing(true);
    setAiError(null);
    setStep("retry_analyzing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("请先登录");
      console.log("[EnglishSpeaking] Starting retry AI analysis", { transcript_len: text.length, session_id: sessionId });

      const result = await analyzeSpeaking(
        question,
        text,
        suitableExpressions.map(e => e.english),
        session.access_token,
        {
          questionContext: { mode: selectedMode, topic: selectedTopic, part: selectedPart },
          retryContext: {
            answerStructure: firstFeedback?.answerStructure,
            finalHighScoreAnswer: firstFeedback?.finalHighScoreAnswer,
            keyUpgrades: firstFeedback?.keyUpgrades,
          },
        },
      );

      setRetryFeedback(result);
      console.log("[EnglishSpeaking] Retry AI analysis complete", {
        fluency: result.fluencyScore, grammar: result.grammarScore,
        vocab: result.vocabularyScore, naturalness: result.naturalnessScore,
        relevance: result.contentAnalysis?.relevanceScore,
        coherence: result.contentAnalysis?.coherenceScore,
        development: result.contentAnalysis?.developmentScore,
      });
      setStep("retry_results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI 分析失败，请稍后重试";
      console.error("[EnglishSpeaking] Retry AI analysis failed:", msg);
      setAiError(msg);
      setStep("retry_review");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRetrySave = async () => {
    if (!sessionId) return;
    if (!firstAttemptId) {
      console.error("[EnglishSpeaking] handleRetrySave: firstAttemptId is null — cannot link retry");
      setAiError("无法关联第一次练习记录，请返回重新开始。");
      return;
    }
    console.log(
      "[EnglishSpeaking] RETRY attempt save — STT Provider: %s | STT Mode: %s | Fallback: %s | Transcript Length: %d | Audio Duration: %ds",
      asr.providerName,
      asr.recognitionMode,
      asr.fallbackTriggered ? "YES" : "NO",
      (asr.transcript || "").length,
      recorder.duration,
    );
    setUploading(true);

    // Upload retry audio
    let retryAudioUrlUploaded = "";
    if (retryAudioBlob) {
      try {
        retryAudioUrlUploaded = await uploadAudio(sessionId, retryAudioBlob);
      } catch (err) {
        console.error("[EnglishSpeaking] Retry audio upload failed:", err);
      }
    }

    const combined = retryFeedback
      ? buildCombinedFeedback(retryFeedback)
      : "Retry practice saved.";

    try {
      const retryData: Record<string, unknown> = {
        session_id: sessionId,
        answer: retryTranscript || `[Voice recording on: ${question}]`,
        transcribed_text: retryTranscript || null,
        natural_version: retryFeedback?.naturalVersion || "",
        combined_feedback: combined,
        fluency_score: retryFeedback?.fluencyScore ?? null,
        grammar_score: retryFeedback?.grammarScore ?? null,
        vocabulary_score: retryFeedback?.vocabularyScore ?? null,
        naturalness_score: retryFeedback?.naturalnessScore ?? null,
        main_problems: retryFeedback?.mainProblems || null,
        useful_corrections: retryFeedback?.usefulCorrections || null,
        better_chunks: retryFeedback?.betterChunks || null,
        one_better_example: retryFeedback?.oneBetterExample || null,
        audio_url: retryAudioUrlUploaded || null,
        audio_duration: retryDuration,
        expressions_used: retryFeedback?.expressionsUsed || [],
        expressions_missed: retryFeedback?.expressionsMissed || [],
        reference_answer: null,
        expression_upgrade: retryFeedback?.expressionUpgrade || [],
        retry_of_attempt_id: firstAttemptId,
        attempt_round: 2,
        is_retry: true,
        stt_provider: asr.providerName,
        stt_mode: asr.recognitionMode,
        fallback_used: asr.fallbackTriggered,
      };

      if (retryFeedback?.contentAnalysis) {
        retryData.content_analysis = retryFeedback.contentAnalysis;
      }
      if (retryFeedback?.answerStructure && retryFeedback.answerStructure.length > 0) {
        retryData.answer_structure = retryFeedback.answerStructure;
      }
      if (retryFeedback?.finalHighScoreAnswer) {
        retryData.structured_better_answer = retryFeedback.finalHighScoreAnswer;
      }
      if (retryFeedback?.diagnosis) {
        retryData.diagnosis = retryFeedback.diagnosis;
      }
      if (retryFeedback?.keyImprovements && retryFeedback.keyImprovements.length > 0) {
        retryData.key_improvements = JSON.stringify(retryFeedback.keyImprovements);
      }
      if (retryFeedback?.keyUpgrades && retryFeedback.keyUpgrades.length > 0) {
        retryData.key_upgrades = retryFeedback.keyUpgrades;
      }

      await createAttempt.mutateAsync(retryData);
      console.log("[EnglishSpeaking] Retry attempt saved", { session_id: sessionId, retry_of: firstAttemptId });
    } catch (err) {
      const pgCode = (err as Record<string, unknown>)?.code as string | undefined;
      if (pgCode === "23505") {
        console.warn("[EnglishSpeaking] Duplicate retry detected — attempt already saved");
        setAiError("该轮次练习记录已保存，无需重复提交。");
      } else {
        console.error("[EnglishSpeaking] Retry createAttempt failed:", err);
        setAiError("保存重新复述记录失败，请稍后重试。");
      }
      setUploading(false);
      return;
    }

    // Don't increment question usage_count for retry
    // Don't run SRS adjustments for retry (same expressions)

    setUploading(false);
    setStep("saved");
    console.log("[EnglishSpeaking] Retry practice saved", {
      session_id: sessionId,
      question_id: currentQuestionId,
      is_retry: true,
    });
  };

  const handleAnalyze = async () => {
    const text = asr.transcript.trim();
    if (!text) {
      setAiError("请先输入或确认你说的话，AI 无法分析空白内容。");
      return;
    }
    setAnalyzing(true);
    setAiError(null);
    setStep("analyzing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("请先登录");
      console.log("[EnglishSpeaking] Starting AI analysis", { transcript_len: text.length, session_id: sessionId });
      const result = await analyzeSpeaking(
        question, text, suitableExpressions.map(e => e.english), session.access_token,
        { questionContext: { mode: selectedMode, topic: selectedTopic, part: selectedPart } },
      );
      setFeedback(result);
      console.log("[EnglishSpeaking] AI analysis complete", {
        fluency: result.fluencyScore, grammar: result.grammarScore,
        vocab: result.vocabularyScore, naturalness: result.naturalnessScore,
        upgrades: result.expressionUpgrade?.length || 0,
        relevance: result.contentAnalysis?.relevanceScore,
        coherence: result.contentAnalysis?.coherenceScore,
        development: result.contentAnalysis?.developmentScore,
      });
      const raPromise = generateReferenceAnswer(question, session.access_token)
        .then((ra) => setReferenceAnswer(ra))
        .catch(() => {});
      referenceAnswerPromise.current = raPromise;
      setStep("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI 分析失败，请稍后重试";
      console.error("[EnglishSpeaking] AI analysis failed:", msg);
      setAiError(msg);
      setStep("review");
    } finally {
      setAnalyzing(false);
    }
  };

  // Saves the first attempt to DB. Returns the saved attempt ID, or null on failure.
  // Does NOT change step — callers decide what to do next.
  const saveFirstAttempt = async (): Promise<string | null> => {
    if (!sessionId) {
      console.error("[EnglishSpeaking] saveFirstAttempt: sessionId is null");
      return null;
    }
    console.log(
      "[EnglishSpeaking] FIRST attempt save — STT Provider: %s | STT Mode: %s | Fallback: %s | Transcript Length: %d | Audio Duration: %ds",
      asr.providerName,
      asr.recognitionMode,
      asr.fallbackTriggered ? "YES" : "NO",
      (asr.transcript || "").length,
      recorder.duration,
    );

    // Wait for reference answer if still generating (race with 3s timeout)
    if (referenceAnswerPromise.current) {
      try {
        await Promise.race([
          referenceAnswerPromise.current,
          new Promise<void>((r) => setTimeout(r, 3000)),
        ]);
      } catch { /* already caught in handleAnalyze */ }
    }

    let audioUrl = "";
    if (recorder.blob) {
      try {
        audioUrl = await uploadAudio(sessionId, recorder.blob);
      } catch (err) {
        console.error("[EnglishSpeaking] Audio upload failed:", err);
        setAiError("录音上传失败，但练习记录已保存。Storage bucket 可能未配置正确。");
      }
    }

    const combined = feedback
      ? buildCombinedFeedback(feedback)
      : "Practice saved.";

    const expressionsUsed = feedback?.expressionsUsed || [];
    const expressionsMissed = feedback?.expressionsMissed || [];

    let savedId: string | null = null;
    try {
      const attemptData: Record<string, unknown> = {
        session_id: sessionId,
        answer: asr.transcript || `[Voice recording on: ${question}]`,
        transcribed_text: asr.transcript || null,
        natural_version: feedback?.naturalVersion || "",
        combined_feedback: combined,
        fluency_score: feedback?.fluencyScore ?? null,
        grammar_score: feedback?.grammarScore ?? null,
        vocabulary_score: feedback?.vocabularyScore ?? null,
        naturalness_score: feedback?.naturalnessScore ?? null,
        main_problems: feedback?.mainProblems || null,
        useful_corrections: feedback?.usefulCorrections || null,
        better_chunks: feedback?.betterChunks || null,
        one_better_example: feedback?.oneBetterExample || null,
        audio_url: audioUrl || null,
        audio_duration: recorder.duration,
        expressions_used: expressionsUsed,
        expressions_missed: expressionsMissed,
        reference_answer: referenceAnswer || null,
        expression_upgrade: feedback?.expressionUpgrade || [],
        stt_provider: asr.providerName,
        stt_mode: asr.recognitionMode,
        fallback_used: asr.fallbackTriggered,
        attempt_round: 1,
        is_retry: false,
      };

      if (feedback?.contentAnalysis) {
        attemptData.content_analysis = feedback.contentAnalysis;
      }
      if (feedback?.answerStructure && feedback.answerStructure.length > 0) {
        attemptData.answer_structure = feedback.answerStructure;
      }
      if (feedback?.finalHighScoreAnswer) {
        attemptData.structured_better_answer = feedback.finalHighScoreAnswer;
      }
      if (feedback?.diagnosis) {
        attemptData.diagnosis = feedback.diagnosis;
      }
      if (feedback?.keyImprovements && feedback.keyImprovements.length > 0) {
        attemptData.key_improvements = JSON.stringify(feedback.keyImprovements);
      }
      if (feedback?.keyUpgrades && feedback.keyUpgrades.length > 0) {
        attemptData.key_upgrades = feedback.keyUpgrades;
      }

      const savedAttempt = await createAttempt.mutateAsync(attemptData);
      savedId = (savedAttempt as Record<string, unknown>).id as string;
      if (!firstAttemptId && savedId) {
        setFirstAttemptId(savedId);
      }
    } catch (err) {
      const pgCode = (err as Record<string, unknown>)?.code as string | undefined;
      if (pgCode === "23505") {
        console.warn("[EnglishSpeaking] Duplicate first attempt detected — already saved");
        setAiError("练习记录已保存，无需重复提交。");
        // Return the existing firstAttemptId if available, so callers can continue
        return firstAttemptId;
      }
      console.error("[EnglishSpeaking] createAttempt failed:", err);
      setAiError("保存练习记录失败，请稍后重试。你的录音和分析结果仍然保留在当前页面。");
      return null;
    }

    // Record question usage (fire-and-forget — non-blocking)
    const hadRecording = recorder.duration > 0 || (asr.transcript && asr.transcript.trim().length > 0);
    if (currentQuestionId && hadRecording) {
      try {
        await recordUsage.mutateAsync({
          question_id: currentQuestionId,
          session_id: sessionId,
          fluency_score: feedback?.fluencyScore ?? undefined,
          grammar_score: feedback?.grammarScore ?? undefined,
          vocabulary_score: feedback?.vocabularyScore ?? undefined,
          naturalness_score: feedback?.naturalnessScore ?? undefined,
        });
      } catch (err) {
        console.error("[EnglishSpeaking] recordUsage failed:", err);
      }
    }

    // SRS adjustments (fire-and-forget)
    if (expressionsMissed.length > 0) {
      try { await lowerMissedExpressions(expressionsMissed); } catch { /* ignore */ }
    }
    if (expressionsUsed.length > 0) {
      try { await boostUsedExpressions(expressionsUsed); } catch { /* ignore */ }
    }

    return savedId;
  };

  const handleSave = async () => {
    setUploading(true);
    const savedId = await saveFirstAttempt();
    setUploading(false);
    if (savedId) {
      setStep("saved");
      try { sessionStorage.removeItem("speaking_current_question_id"); } catch {}
      console.log("[EnglishSpeaking] Practice saved", {
        session_id: sessionId,
        question_id: currentQuestionId,
        duration: recorder.duration,
        has_audio: !!recorder.blob,
        has_feedback: !!feedback,
      });
    }
  };

  const handleAddToBank = async (upgrade: ExpressionUpgrade, index: number) => {
    setAddBankError(null);
    try {
      const { data: existing } = await supabase
        .from("expressions")
        .select("id")
        .ilike("english", upgrade.english.trim())
        .eq("archived", false)
        .limit(1);

      if (existing && existing.length > 0) {
        setDuplicateUpgrades((prev) => new Set(prev).add(index));
        return;
      }

      await createExpression.mutateAsync({
        english: upgrade.english,
        chinese: upgrade.chinese,
        type: upgrade.type,
        scene: upgrade.scene,
        example_sentence: upgrade.exampleSentence || null,
        formality: upgrade.formality || null,
        notes: upgrade.usageNote || null,
        source_text: upgrade.sourceChunk || null,
        source: "speaking-upgrade",
        usefulness_level: 3,
      });
      setAddedUpgrades((prev) => new Set(prev).add(index));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[EnglishSpeaking] handleAddToBank failed:", msg);
      setAddBankError(`加入表达库失败：${msg}`);
    }
  };

  const handleNew = () => {
    setView("new");
    setStep("generating");
    setSelectedMode("");
    setSelectedTopic("");
    setSelectedPart("");
    setCurrentQuestionId(null);
    setIsAiGenerated(false);
    setMode("free_speaking");
    setQuestion("");
    setQuestionContext("");
    setSuitableExpressions([]);
    setSessionId(null);
    setFeedback(null);
    setReferenceAnswer("");
    setAiError(null);
    setAddedUpgrades(new Set());
    setDuplicateUpgrades(new Set());
    setAddBankError(null);
    setTextMode(false);
    referenceAnswerPromise.current = null;
    recorder.reset();
    asr.reset();
  };

  const handleContinueFromSaved = () => {
    // Start another round with same mode settings
    setStep("generating");
    setQuestion("");
    setQuestionContext("");
    setSuitableExpressions([]);
    setSessionId(null);
    setFeedback(null);
    setReferenceAnswer("");
    setAiError(null);
    setAddedUpgrades(new Set());
    setDuplicateUpgrades(new Set());
    setAddBankError(null);
    setTextMode(false);
    referenceAnswerPromise.current = null;
    recorder.reset();
    asr.reset();
    // If bank mode, recommend another question
    if (selectedMode && !isAiGenerated) {
      handleRecommend();
    } else if (selectedMode && isAiGenerated) {
      handleAiGenerate();
    }
  };

  const handleViewSession = (id: string) => {
    setViewingSessionId(id);
    setView("detail");
  };

  const handleBack = () => {
    if (view === "new") {
      // Save practice state to sessionStorage for mobile back-button resilience
      try {
        sessionStorage.setItem("speaking_practice_state", JSON.stringify({
          currentQuestionId,
          sessionId,
          step,
          mode,
          question,
          questionContext,
          selectedMode,
          selectedTopic,
          selectedPart,
          isAiGenerated,
          textMode,
        }));
      } catch { /* sessionStorage quota exceeded - non-critical */ }
      setView("home");
      recorder.reset();
      asr.reset();
      setFeedback(null);
      setAiError(null);
      setSelectedMode("");
    } else if (view === "detail") {
      setView("home");
      setViewingSessionId(null);
    } else if (view === "mode_detail") {
      setView("home");
      setSelectedMode("");
      setSelectedTopic("");
      setSelectedPart("");
    } else if (view === "browse") {
      setView("home");
    } else {
      navigate("/english");
    }
  };

  // ── HOME VIEW ──

  if (view === "home") {
    return (
      <div className="space-y-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/english")}
              className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0"
            >
              <ArrowLeft size={16} className="text-ink-light" />
            </button>
            <div>
              <p className="text-sm text-ink-lighter">English OS</p>
              <h1 className="text-2xl font-semibold tracking-tight mt-0.5">口语练习</h1>
            </div>
          </div>
        </header>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-2xl border border-border p-3 text-center">
              <p className="text-xl font-bold text-ink">{stats.totalSessions}</p>
              <p className="text-[10px] text-ink-lighter mt-0.5">练习次数</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-3 text-center">
              <p className="text-xl font-bold text-sage-deep">{stats.avgScore || "-"}</p>
              <p className="text-[10px] text-ink-lighter mt-0.5">平均评分</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-3 text-center">
              <p className="text-xl font-bold text-ink">{stats.practiceDays}</p>
              <p className="text-[10px] text-ink-lighter mt-0.5">练习天数</p>
            </div>
          </div>
        )}

        {/* Mode cards */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-light">选择练习模式</p>
          <div className="grid grid-cols-2 gap-2">
            {MODE_DEFS.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => handlePickMode(m.key)}
                  className="bg-card rounded-2xl border border-border p-4 text-left hover:border-sage-light/50 transition-colors"
                >
                  <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center mb-2", MODE_COLORS[m.key] || "bg-ink/5 text-ink-light")}>
                    <Icon size={18} />
                  </div>
                  <p className="text-sm font-semibold text-ink">{m.label}</p>
                  <p className="text-[10px] text-ink-lighter mt-0.5">{m.labelEn}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-2">
          <button
            onClick={() => { setBrowseMode(""); setBrowseTopic(""); setBrowsePart(""); setBrowseSearch(""); setBrowsePage(0); setView("browse"); }}
            className="w-full bg-card rounded-2xl border border-border p-4 text-left hover:border-sage-light/50 transition-colors flex items-center gap-3"
          >
            <div className="h-10 w-10 rounded-xl bg-ink/5 flex items-center justify-center shrink-0">
              <Library size={20} className="text-ink-light" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">浏览题库</p>
              <p className="text-xs text-ink-lighter mt-0.5">按模式/话题筛选，选择题目开始练习</p>
            </div>
            <ChevronRight size={16} className="text-ink-lighter shrink-0" />
          </button>

          <button
            onClick={handleStartExpressionPractice}
            className="w-full bg-card rounded-2xl border-2 border-dashed border-sage-light/50 p-4 text-left hover:border-sage-light transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sage-light flex items-center justify-center shrink-0">
                <Target size={20} className="text-sage-deep" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">表达练习 Expression Practice</p>
                <p className="text-xs text-ink-lighter mt-0.5">
                  练习使用你最近学的表达 · {dueExpressions?.length || 0} 条待复习表达
                </p>
              </div>
              <ChevronRight size={16} className="text-ink-lighter shrink-0" />
            </div>
          </button>
        </div>

        {/* Recent sessions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-light">最近练习</p>

          {sessionsLoading && (
            <div className="text-center py-8 text-sm text-ink-lighter">加载中...</div>
          )}

          {!sessionsLoading && (!sessions || sessions.length === 0) && (
            <div className="text-center py-8">
              <Mic size={32} className="text-ink-lighter mx-auto mb-2" />
              <p className="text-sm text-ink-light">还没有口语练习记录</p>
              <p className="text-xs text-ink-lighter mt-1">选择一个模式开始你的第一次口语训练</p>
            </div>
          )}

          <div className="space-y-2">
            {sessions?.map((s) => {
              const attempts = (s.speaking_attempts as Record<string, unknown>[]) || [];
              // Prefer the first-round (non-retry) attempt for card preview.
              // Sorted by created_at ASC so the earliest is always the first attempt.
              const sorted = [...attempts].sort((a, b) => {
                const aTime = new Date((a.created_at as string) || 0).getTime();
                const bTime = new Date((b.created_at as string) || 0).getTime();
                return aTime - bTime;
              });
              const first = sorted.find((a) => !(a.is_retry as boolean)) || sorted[0] as Record<string, unknown> | undefined;
              const avgScore = first
                ? [first.fluency_score, first.grammar_score, first.vocabulary_score, first.naturalness_score]
                    .filter((v): v is number => typeof v === "number" && v > 0)
                : [];
              const scoreVal = avgScore.length > 0
                ? (avgScore.reduce((a, b) => a + b, 0) / avgScore.length).toFixed(1)
                : null;
              const duration = (first?.audio_duration as number) || 0;
              const usedCount = ((first?.expressions_used as unknown[]) || []).length;
              const sid = s.id as string;
              const isTest = (s.is_test as boolean) || false;
              const displayTitle = ((s.title as string) || (s.prompt as string)).slice(0, 60);
              return (
                <div
                  key={sid}
                  className="w-full bg-card rounded-2xl border border-border p-4 hover:border-sage-light/50 transition-colors relative"
                >
                  <button
                    onClick={() => handleViewSession(sid)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2 pr-8">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-ink truncate">{displayTitle}</p>
                          {isTest && (
                            <span className="text-[9px] bg-amber-50 text-amber-500 rounded-full px-1.5 py-px shrink-0">测试</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <p className="text-[10px] text-ink-lighter">
                            {new Date(s.created_at as string).toLocaleDateString("zh-CN")}
                          </p>
                          {(s.mode as string) && (
                            <span className={cn(
                              "text-[10px] rounded-full px-2 py-0.5",
                              (s.mode as string) === "expression_practice"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-ink/5 text-ink-lighter",
                            )}>
                              {(s.mode as string) === "expression_practice" ? "表达练习" : "自由口语"}
                            </span>
                          )}
                          {duration > 0 && (
                            <span className="text-[10px] text-ink-lighter">{formatDuration(duration)}</span>
                          )}
                          {usedCount > 0 && (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                              +{usedCount} 表达
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {scoreVal && (
                          <span className={cn(
                            "text-xs font-bold font-mono rounded-full px-2 py-1",
                            parseFloat(scoreVal) >= 6.5 ? "bg-sage-light text-sage-deep" : "bg-amber-50 text-amber-600",
                          )}>
                            {scoreVal}
                          </span>
                        )}
                        <ChevronRight size={14} className="text-ink-lighter shrink-0" />
                      </div>
                    </div>
                  </button>

                  {/* More menu button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === sid ? null : sid); }}
                    className="absolute top-3 right-3 h-7 w-7 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors"
                  >
                    <MoreHorizontal size={14} className="text-ink-lighter" />
                  </button>

                  {/* Dropdown menu */}
                  {openMenuId === sid && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-3 top-10 z-20 bg-card rounded-xl border border-border shadow-lg py-1 min-w-[140px]">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); handleViewSession(sid); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-ink/5 transition-colors"
                        >
                          <ChevronRight size={12} className="text-ink-lighter" />
                          查看详情
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); setOpenMenuId(null);
                            setEditingSession({ id: sid, title: (s.title as string) || "", notes: (s.learning_notes as string) || "", prompt: (s.prompt as string) || "" });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-ink/5 transition-colors"
                        >
                          <Edit3 size={12} className="text-ink-lighter" />
                          编辑
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); setOpenMenuId(null);
                            updateSession.mutate({ sessionId: sid, isTest: !isTest });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-ink/5 transition-colors"
                        >
                          <Flag size={12} className={isTest ? "text-amber-500" : "text-ink-lighter"} />
                          {isTest ? "取消测试标记" : "标记为测试"}
                        </button>
                        <div className="border-t border-border my-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); setOpenMenuId(null);
                            setDeletingSession({ id: sid, prompt: (s.prompt as string) || "" });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 size={12} />
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Edit Session Dialog ── */}
        {editingSession && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => setEditingSession(null)} />
            <div className="relative bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 z-10 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-ink mb-4">编辑练习记录</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-ink-light mb-1.5 block">练习标题</label>
                  <input
                    type="text"
                    value={editingSession.title}
                    onChange={(e) => setEditingSession({ ...editingSession, title: e.target.value })}
                    placeholder={editingSession.prompt.slice(0, 60)}
                    className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-background text-ink focus:outline-none focus:border-sage-light"
                  />
                  <p className="text-[10px] text-ink-lighter mt-1">留空则使用题目原文作为标题</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-light mb-1.5 block">学习笔记</label>
                  <textarea
                    value={editingSession.notes}
                    onChange={(e) => setEditingSession({ ...editingSession, notes: e.target.value })}
                    placeholder="记录学习心得、遇到的困难、改进方向..."
                    rows={4}
                    className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-background text-ink focus:outline-none focus:border-sage-light resize-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => setEditingSession(null)}
                  className="flex-1 h-10 rounded-xl border border-border text-sm text-ink-light hover:bg-ink/5 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    try {
                      await updateSession.mutateAsync({
                        sessionId: editingSession.id,
                        title: editingSession.title || undefined,
                        learningNotes: editingSession.notes || undefined,
                      });
                    } catch { /* ignore */ }
                    setEditingSession(null);
                  }}
                  disabled={updateSession.isPending}
                  className="flex-1 h-10 rounded-xl bg-sage-light text-sage-deep text-sm font-semibold hover:bg-sage-light/80 transition-colors disabled:opacity-50"
                >
                  {updateSession.isPending ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirmation Dialog ── */}
        {deletingSession && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => setDeletingSession(null)} />
            <div className="relative bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 z-10">
              <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-3">
                <Trash2 size={18} className="text-rose-600" />
              </div>
              <h2 className="text-base font-semibold text-ink text-center mb-1">确定删除？</h2>
              <p className="text-xs text-ink-lighter text-center mb-1">
                "{deletingSession.prompt.slice(0, 50)}"
              </p>
              <p className="text-[11px] text-ink-lighter text-center mb-5">
                删除后数据保留，不会丢失音频和AI分析结果。
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeletingSession(null)}
                  className="flex-1 h-10 rounded-xl border border-border text-sm text-ink-light hover:bg-ink/5 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    try {
                      await deleteSession.mutateAsync(deletingSession.id);
                    } catch { /* ignore */ }
                    setDeletingSession(null);
                  }}
                  disabled={deleteSession.isPending}
                  className="flex-1 h-10 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {deleteSession.isPending ? "删除中..." : "删除"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── MODE DETAIL VIEW ──

  if (view === "mode_detail") {
    const modeDef = MODE_DEFS.find(m => m.key === selectedMode);
    if (!modeDef) return null;
    const Icon = modeDef.icon;
    const bankCount = bankQuestions?.length || 0;

    return (
      <div className="space-y-4">
        <header className="flex items-center gap-3">
          <button onClick={handleBack} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <p className="text-sm text-ink-lighter">English OS</p>
            <h1 className="text-xl font-semibold tracking-tight mt-0.5">{modeDef.label}</h1>
          </div>
        </header>

        {/* Mode intro */}
        <div className={cn("rounded-2xl p-4", MODE_COLORS[selectedMode] || "bg-ink/5")}>
          <div className="flex items-center gap-2 mb-2">
            <Icon size={18} />
            <span className="text-sm font-semibold">{modeDef.labelEn}</span>
          </div>
          <p className="text-xs opacity-70">{modeDef.desc}</p>
          <p className="text-xs mt-2 opacity-60">题库中 {bankCount} 道可用题目</p>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="text-xs font-medium text-ink-light">筛选条件（可选）</p>

          {/* Topic filter */}
          <div>
            <label className="text-[10px] text-ink-lighter mb-1 block">话题 Topic</label>
            <div className="flex flex-wrap gap-1.5">
              {TOPIC_OPTIONS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setSelectedTopic(t.value)}
                  className={cn(
                    "text-[11px] rounded-full px-3 py-1.5 transition-colors",
                    selectedTopic === t.value
                      ? "bg-sage-light text-sage-deep font-medium"
                      : "bg-ink/5 text-ink-lighter hover:bg-ink/10",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Part filter (IELTS only) */}
          {selectedMode === "ielts" && (
            <div>
              <label className="text-[10px] text-ink-lighter mb-1 block">Part</label>
              <div className="flex gap-1.5">
                {IELTS_PARTS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setSelectedPart(p.value)}
                    className={cn(
                      "text-[11px] rounded-full px-3 py-1.5 transition-colors",
                      selectedPart === p.value
                        ? "bg-purple-100 text-purple-600 font-medium"
                        : "bg-ink/5 text-ink-lighter hover:bg-ink/10",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={handleRecommend}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Shuffle size={16} />
            {bankCount > 0 ? "推荐一题" : "AI 生成题目"}
          </button>

          <button
            onClick={() => {
              setBrowseMode(selectedMode);
              setBrowseTopic(selectedTopic);
              setBrowsePart(selectedPart);
              setBrowseSearch("");
              setBrowsePage(0);
              setView("browse");
            }}
            className="w-full bg-card border border-border rounded-xl py-3 text-sm font-medium text-ink flex items-center justify-center gap-2"
          >
            <Library size={16} />
            浏览题库{bankCount > 0 ? ` (${bankCount} 题)` : ""}
          </button>

          <button
            onClick={handleAiGenerate}
            className="w-full bg-card border border-border rounded-xl py-3 text-sm font-medium text-ink-light flex items-center justify-center gap-2"
          >
            <Bot size={16} />
            AI 临时生成
          </button>
        </div>
      </div>
    );
  }

  // ── BROWSE VIEW ──

  if (view === "browse") {
    const browseList = browseQuestions || [];
    const totalPages = Math.ceil(browseList.length / BROWSE_PAGE_SIZE);
    const pagedQuestions = browseList.slice(
      browsePage * BROWSE_PAGE_SIZE,
      (browsePage + 1) * BROWSE_PAGE_SIZE,
    );

    return (
      <div className="space-y-4">
        <header className="flex items-center gap-3">
          <button onClick={handleBack} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <p className="text-sm text-ink-lighter">English OS</p>
            <h1 className="text-xl font-semibold tracking-tight mt-0.5">浏览题库</h1>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-card rounded-2xl border border-border p-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-lighter" />
            <input
              type="text"
              placeholder="搜索题目..."
              value={browseSearch}
              onChange={(e) => { setBrowseSearch(e.target.value); setBrowsePage(0); }}
              className="w-full bg-ink/5 rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none"
            />
          </div>

          {/* Mode filter */}
          <div className="flex gap-1.5 flex-wrap">
            {[{ value: "", label: "全部模式" }, ...MODE_DEFS.map(m => ({ value: m.key, label: m.label }))].map(opt => (
              <button
                key={opt.value}
                onClick={() => { setBrowseMode(opt.value); setBrowsePage(0); }}
                className={cn(
                  "text-[11px] rounded-full px-3 py-1 transition-colors",
                  browseMode === opt.value
                    ? "bg-sage-light text-sage-deep font-medium"
                    : "bg-ink/5 text-ink-lighter hover:bg-ink/10",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Topic + Part row */}
          <div className="flex gap-2">
            <select
              value={browseTopic}
              onChange={(e) => { setBrowseTopic(e.target.value); setBrowsePage(0); }}
              className="flex-1 bg-ink/5 rounded-lg px-2 py-1.5 text-xs text-ink outline-none"
            >
              {TOPIC_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {(browseMode === "ielts" || !browseMode) && (
              <select
                value={browsePart}
                onChange={(e) => { setBrowsePart(e.target.value); setBrowsePage(0); }}
                className="w-28 bg-ink/5 rounded-lg px-2 py-1.5 text-xs text-ink outline-none"
              >
                {IELTS_PARTS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Results */}
        {browseList.length === 0 ? (
          <div className="text-center py-12">
            <Library size={32} className="text-ink-lighter mx-auto mb-2" />
            <p className="text-sm text-ink-light">题库中暂无匹配题目</p>
            <p className="text-xs text-ink-lighter mt-1">尝试调整筛选条件，或通过导入功能添加题目</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-ink-lighter">
              共 {browseList.length} 题 · 第 {browsePage + 1}/{Math.max(totalPages, 1)} 页
            </p>
            <div className="space-y-2">
              {pagedQuestions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => handleBrowsePickQuestion(q)}
                  className="w-full bg-card rounded-xl border border-border p-3 text-left hover:border-sage-light/50 transition-colors"
                >
                  <p className="text-sm font-medium text-ink leading-relaxed">{q.question}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={cn("text-[10px] rounded-full px-2 py-0.5", MODE_COLORS[q.mode] || "bg-ink/5 text-ink-lighter")}>
                      {MODE_DEFS.find(m => m.key === q.mode)?.label || q.mode}
                    </span>
                    {q.topic && (
                      <span className="text-[10px] bg-ink/5 rounded-full px-2 py-0.5 text-ink-lighter">
                        {TOPIC_LABEL_MAP[q.topic] || q.topic}
                      </span>
                    )}
                    {q.part && (
                      <span className="text-[10px] bg-purple-50 text-purple-600 rounded-full px-2 py-0.5">
                        {q.part}
                      </span>
                    )}
                    <span className="text-[10px] text-ink-lighter ml-auto">
                      已练 {q.usage_count} 次
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setBrowsePage(p => Math.max(0, p - 1))}
                  disabled={browsePage === 0}
                  className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center disabled:opacity-30"
                >
                  <ChevronRight size={14} className="text-ink-light rotate-180" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setBrowsePage(i)}
                    className={cn(
                      "h-8 w-8 rounded-lg text-xs font-medium",
                      i === browsePage ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-lighter",
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setBrowsePage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={browsePage === totalPages - 1}
                  className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center disabled:opacity-30"
                >
                  <ChevronRight size={14} className="text-ink-light" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ──

  if (view === "detail" && viewingSessionId) {
    return (
      <SessionDetail
        sessionId={viewingSessionId}
        onBack={handleBack}
      />
    );
  }

  // ── NEW SESSION FLOW ──

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={handleBack} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div>
          <p className="text-sm text-ink-lighter">English OS</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
            {step === "saved" ? "练习完成" : mode === "expression_practice" ? "表达练习" : "新练习"}
          </h1>
        </div>
      </header>

      {/* Dev Debug Panel */}
      {import.meta.env.DEV && (
        <DebugPanel
          step={step}
          recorderState={recorder.state}
          isListening={asr.isListening}
          isProcessing={asr.isProcessing}
          transcript={asr.transcript}
          interim={asr.interim}
          audioBlob={recorder.blob}
          audioUrl={recorder.audioUrl}
          sessionId={sessionId}
          question={question}
          feedback={feedback}
          canAnalyze={!!asr.transcript.trim()}
          canSave={!!sessionId}
        />
      )}

      {/* Step: Empty Expression Practice */}
      {step === "empty_expression_practice" && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-amber-100 p-6 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
              <Target size={28} className="text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">没有待复习的表达</p>
              <p className="text-xs text-ink-lighter mt-2 leading-relaxed">
                表达练习模式需要表达库中有到期复习（due）的表达。<br />
                请先通过以下方式添加表达：
              </p>
            </div>
            <div className="text-xs text-ink-lighter text-left space-y-1.5 max-w-xs mx-auto">
              <p className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                自由口语练习后，将 AI 推荐的表达升级加入表达库
              </p>
              <p className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                通过导入功能批量导入表达
              </p>
              <p className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                手动创建新表达
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setView("home"); }}
                className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold"
              >
                先去自由口语练习
              </button>
              <button
                onClick={() => { setView("home"); }}
                className="flex-1 bg-ink/5 text-ink-light rounded-xl py-2.5 text-sm font-medium"
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Generating question */}
      {(step === "generating") && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-6 text-center">
            <Loader2 size={28} className="animate-spin text-sage-deep mx-auto mb-3" />
            <p className="text-sm font-medium text-ink">AI 正在生成题目...</p>
            <p className="text-xs text-ink-lighter mt-1">
              {mode === "expression_practice"
                ? "基于你的表达库生成练习题目"
                : isAiGenerated
                  ? `模式: ${MODE_DEFS.find(m => m.key === selectedMode)?.label || selectedMode} — AI 临时生成`
                  : `模式: ${MODE_DEFS.find(m => m.key === selectedMode)?.label || selectedMode}`}
            </p>
          </div>

          <GenerateQuestion
            mode={mode}
            selectedMode={selectedMode}
            selectedTopic={selectedTopic}
            selectedPart={selectedPart}
            isAiGenerated={isAiGenerated}
            currentQuestionId={currentQuestionId}
            dueExpressions={dueExpressions as Record<string, unknown>[] | undefined}
            onGenerated={(q, ctx, exprs) => {
              setQuestion(q);
              setQuestionContext(ctx);
              setSuitableExpressions(exprs);
            }}
            onReady={() => setStep("record")}
          />
        </div>
      )}

      {/* Show expressions for expression practice mode */}
      {mode === "expression_practice" && (step === "generating" || step === "record") && dueExpressions && dueExpressions.length > 0 && (
        <div className="bg-card rounded-2xl border border-sage-light/30 p-4">
          <p className="text-xs font-medium text-sage-deep mb-2.5 flex items-center gap-1.5">
            <Sparkles size={12} />
            Recommended expressions — Try to use:
          </p>
          <div className="flex flex-wrap gap-2">
            {(dueExpressions as Record<string, unknown>[]).slice(0, 8).map((e, i) => (
              <span key={i} className="text-[12px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1.5 flex items-center gap-1.5 font-medium">
                <span className="text-amber-400">⭐</span>
                {e.english as string}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Show AI-recommended expressions for free_speaking mode */}
      {mode === "free_speaking" && step === "record" && suitableExpressions.length > 0 && (
        <div className="bg-card rounded-2xl border border-amber-100 p-4">
          <p className="text-xs font-medium text-ink-light mb-2.5 flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-500" />
            Recommended expressions — Try to use:
          </p>
          <div className="flex flex-wrap gap-2">
            {suitableExpressions.map((e, i) => (
              <span key={i} className="text-[12px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1.5 flex items-center gap-1.5 font-medium">
                <span className="text-amber-400">⭐</span>
                {e.english}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Step: Record */}
      {(step === "record" || step === "generating") && question && (
        <>
          {/* Question card */}
          <div className="bg-card rounded-2xl border border-sage-light/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={14} className="text-sage-deep" />
              <span className="text-[10px] font-medium text-sage-deep bg-sage-light px-2 py-0.5 rounded-full">Question</span>
              {isAiGenerated && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">AI 临时生成</span>
              )}
            </div>
            <p className="text-sm font-semibold text-ink leading-relaxed">{question}</p>
            {questionContext && (
              <p className="text-xs text-ink-lighter mt-1.5">{questionContext}</p>
            )}
          </div>

          {/* Recording UI */}
          {step === "record" && (
            <div className="space-y-4">
              {/* Text mode: direct text input instead of recording */}
              {textMode ? (
                <div className="bg-card rounded-2xl border border-amber-100 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-amber-500" />
                    <p className="text-xs font-medium text-amber-700">文本回答模式</p>
                    <button
                      onClick={() => { setTextMode(false); recorder.reset(); }}
                      className="ml-auto text-[10px] text-ink-lighter hover:text-ink underline"
                    >
                      切换回录音模式
                    </button>
                  </div>
                  <textarea
                    className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-amber-300 resize-none"
                    rows={5}
                    placeholder="在这里输入你的英语回答..."
                    value={asr.transcript}
                    onChange={(e) => asr.setTranscript(e.target.value)}
                  />
                </div>
              ) : (
                <div className="bg-card rounded-2xl border border-border p-6 text-center space-y-4">
                  {/* Record button */}
                  <div className="relative inline-flex items-center justify-center">
                    {recorder.state === "recording" && (
                      <div className="absolute inset-0 rounded-full bg-accent-rose/20 animate-ping pointer-events-none" style={{ width: 80, height: 80, margin: "auto" }} />
                    )}
                    <button
                      disabled={isStarting}
                      onClick={recorder.state === "recording" ? handleStopRecording : recorder.state === "done" ? recorder.reset : handleStartRecording}
                      className={cn(
                        "rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:scale-95",
                        recorder.state === "recording"
                          ? "h-20 w-20 bg-accent-rose text-white shadow-lg"
                          : recorder.state === "done"
                            ? "h-16 w-16 bg-sage-light text-sage-deep"
                            : "h-20 w-20 bg-accent-rose/10 text-accent-rose",
                      )}
                    >
                      {recorder.state === "recording" ? (
                        <Square size={28} />
                      ) : recorder.state === "done" ? (
                        <RefreshCw size={24} />
                      ) : (
                        <Mic size={32} />
                      )}
                    </button>
                  </div>

                  <div>
                    {recorder.state === "idle" && !recorder.error && (
                      <p className="text-sm text-ink-light">点击麦克风开始录音</p>
                    )}
                    {recorder.state === "recording" && (
                      <div className="space-y-1">
                        <p className="text-lg font-bold text-accent-rose font-mono">{formatDuration(recorder.duration)}</p>
                        <p className="text-xs text-ink-lighter">点击停止按钮结束录音</p>
                      </div>
                    )}
                    {recorder.state === "done" && (
                      <p className="text-sm text-sage-deep font-medium">录音完成 ({formatDuration(recorder.duration)})</p>
                    )}
                  </div>

                  {/* Mic error with fallback options */}
                  {recorder.error && (
                    <div className="space-y-3">
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-left">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">{recorder.error}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {recorder.errorType === "denied" && (
                          <button
                            onClick={() => recorder.start()}
                            className="flex-1 bg-ink/5 text-ink-light rounded-xl py-2.5 text-sm font-medium hover:bg-ink/10 transition-colors"
                          >
                            重新授权
                          </button>
                        )}
                        <button
                          onClick={() => { setTextMode(true); recorder.reset(); }}
                          className="flex-1 bg-amber-50 text-amber-700 rounded-xl py-2.5 text-sm font-semibold hover:bg-amber-100 transition-colors border border-amber-200"
                        >
                          切换到文本模式
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ASR error */}
                  {asr.supported && asr.error && (
                    <p className="text-xs text-accent-rose mt-1">语音识别错误: {asr.error}</p>
                  )}

                  {/* ASR status */}
                  {asr.supported && recorder.state === "recording" && (
                    <div className="text-xs text-ink-lighter">
                      {asr.isListening && <span className="text-sage-deep">语音识别中...</span>}
                      {asr.interim && (
                        <p className="text-ink-light mt-1 italic">"{asr.interim}"</p>
                      )}
                    </div>
                  )}

                  {/* Audio playback after recording */}
                  {recorder.state === "done" && recorder.audioUrl && (
                    <audio controls src={recorder.audioUrl} className="w-full h-10" />
                  )}
                </div>
              )}

              {/* Next step button: recording done */}
              {recorder.state === "done" && (
                <button
                  onClick={handleGoToReview}
                  className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold"
                >
                  下一步：查看转录
                </button>
              )}

              {/* Text mode: confirm and create session */}
              {textMode && asr.transcript.trim() && !sessionId && (
                <button
                  onClick={async () => {
                    if (isStarting) return;
                    setIsStarting(true);
                    try {
                      const result = await createSession.mutateAsync({
                        prompt: question,
                        context: questionContext,
                        category: selectedMode || undefined,
                        mode,
                        recommended_expressions: suitableExpressions.length > 0 ? suitableExpressions : undefined,
                        question_id: currentQuestionId || undefined,
                      });
                      setSessionId(result.id as string);
                      asr.setSessionId(result.id as string);
                      setStep("review");
                    } catch (err) {
                      console.error("[EnglishSpeaking] textMode createSession failed:", err);
                      setAiError("创建练习会话失败，请检查网络或重新登录。");
                    } finally {
                      setIsStarting(false);
                    }
                  }}
                  disabled={isStarting}
                  className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isStarting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {isStarting ? "创建会话中..." : "确认回答，开始分析"}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Step: Review transcript */}
      {step === "review" && (
        <div className="space-y-4">
          {recorder.audioUrl && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-ink-lighter mb-2">你的录音 ({formatDuration(recorder.duration)})</p>
              <audio controls src={recorder.audioUrl} className="w-full h-10" />
            </div>
          )}

          {asr.supported && (
            <div className="bg-card rounded-2xl border border-sage-light/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-sage-deep" />
                <p className="text-xs font-medium text-sage-deep">语音识别转录</p>
              </div>
              <p className="text-sm text-ink leading-relaxed">
                {asr.transcript || "(未检测到语音，请手动输入)"}
              </p>
              {asr.transcript && (
                <p className="text-[10px] text-ink-lighter mt-2">转录可能有误，请检查并修改</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-ink-light mb-1 block">
              {asr.supported ? "修改转录内容" : "输入你说的话（AI 将据此给出反馈）"}
            </label>
            <textarea
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light resize-none"
              rows={4}
              placeholder="输入或修改你说的话..."
              value={asr.transcript}
              onChange={(e) => asr.setTranscript(e.target.value)}
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                AI 分析中...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                AI 分析
              </>
            )}
          </button>

          <button
            onClick={handleSave}
            disabled={uploading}
            className="w-full bg-ink/5 text-ink-light rounded-xl py-2 text-sm font-medium disabled:opacity-50"
          >
            {uploading ? "保存中..." : "跳过分析，直接保存"}
          </button>
        </div>
      )}

      {/* Step: Analyzing */}
      {step === "analyzing" && (
        <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-sage-deep mx-auto" />
          <p className="text-sm font-medium text-ink">AI 正在分析你的回答...</p>
          <p className="text-xs text-ink-lighter">四维评分 + 纠错 + 推荐表达</p>
        </div>
      )}

      {/* Step: Results */}
      {step === "results" && feedback && (
        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
            <p className="text-xs font-medium text-ink-light mb-1">四维评分</p>
            <ScoreBar label="流利度 Fluency" score={feedback.fluencyScore} />
            <ScoreBar label="语法 Grammar" score={feedback.grammarScore} />
            <ScoreBar label="词汇 Vocabulary" score={feedback.vocabularyScore} />
            <ScoreBar label="自然度 Naturalness" score={feedback.naturalnessScore} />
          </div>

          <div className="bg-card rounded-2xl border border-sage-light/50 p-4">
            <p className="text-xs font-medium text-sage-deep mb-1">更自然的表达</p>
            <p className="text-sm text-ink leading-relaxed">{feedback.naturalVersion}</p>
          </div>

          {(feedback.expressionsUsed.length > 0 || feedback.expressionsMissed.length > 0) && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-3">表达使用 Expression Usage</p>
              <div className="space-y-3">
                {feedback.expressionsUsed.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-emerald-600 mb-1.5">Used</p>
                    <div className="flex flex-wrap gap-1.5">
                      {feedback.expressionsUsed.map((e, i) => (
                        <span key={i} className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-1 flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {feedback.expressionsMissed.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-amber-600 mb-1.5">Missed</p>
                    <div className="flex flex-wrap gap-1.5">
                      {feedback.expressionsMissed.map((e, i) => (
                        <span key={i} className="text-[11px] bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2.5 py-1 flex items-center gap-1">
                          <X size={11} />
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Language Analysis (collapsible) */}
          {(feedback.mainProblems || feedback.usefulCorrections || feedback.betterChunks) && (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <button
                onClick={() => setShowLanguageAnalysis(!showLanguageAnalysis)}
                className="w-full p-4 flex items-center justify-between"
              >
                <p className="text-xs font-medium text-ink-light">语言分析 Language Analysis</p>
                <ChevronDown
                  size={14}
                  className={cn("text-ink-lighter transition-transform", !showLanguageAnalysis && "-rotate-90")}
                />
              </button>
              {showLanguageAnalysis && (
                <div className="px-4 pb-4 space-y-3">
                  {feedback.mainProblems && (
                    <div>
                      <p className="text-[11px] font-medium text-ink-light mb-1.5">主要问题</p>
                      <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                        {feedback.mainProblems}
                      </div>
                    </div>
                  )}
                  {feedback.usefulCorrections && (
                    <div>
                      <p className="text-[11px] font-medium text-ink-light mb-1.5">纠错建议</p>
                      <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                        {feedback.usefulCorrections}
                      </div>
                    </div>
                  )}
                  {feedback.betterChunks && (
                    <div>
                      <p className="text-[11px] font-medium text-ink-light mb-1.5">推荐表达</p>
                      <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                        {feedback.betterChunks}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {feedback.expressionUpgrade && feedback.expressionUpgrade.length > 0 && (
            <div className="bg-card rounded-2xl border border-violet-100 p-4 space-y-3">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-violet-500" />
                  <p className="text-xs font-semibold text-violet-700">表达升级 Expression Upgrade</p>
                </div>
                <button
                  onClick={async () => {
                    for (let i = 0; i < feedback.expressionUpgrade.length; i++) {
                      if (!addedUpgrades.has(i) && !duplicateUpgrades.has(i)) {
                        await handleAddToBank(feedback.expressionUpgrade[i], i);
                      }
                    }
                  }}
                  disabled={
                    feedback.expressionUpgrade.every(
                      (_: ExpressionUpgrade, i: number) => addedUpgrades.has(i) || duplicateUpgrades.has(i)
                    ) || createExpression.isPending
                  }
                  className="text-[11px] text-violet-600 font-medium hover:underline disabled:text-ink-lighter disabled:no-underline"
                >
                  Add All
                </button>
              </div>

              {addBankError && (
                <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-2.5 flex items-start gap-2">
                  <AlertTriangle size={13} className="text-accent-rose shrink-0 mt-0.5" />
                  <p className="text-[11px] text-accent-rose">{addBankError}</p>
                </div>
              )}
              <div className="space-y-2">
                {feedback.expressionUpgrade.map((upgrade: ExpressionUpgrade, i: number) => (
                  <div key={i} className="bg-violet-50/50 rounded-xl border border-violet-100 p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-bold text-ink truncate">{upgrade.english}</span>
                          <span className="text-[10px] bg-white text-ink-lighter border rounded-full px-1.5 py-px shrink-0">{upgrade.type}</span>
                          <span className="text-[10px] text-ink-lighter shrink-0">{upgrade.formality}</span>
                        </div>
                        <p className="text-[11px] text-ink-lighter">{upgrade.chinese}</p>
                        <p className="text-[11px] text-ink-lighter mt-1">
                          <span className="font-medium text-ink-light">Scene: </span>{upgrade.scene}
                        </p>
                        <p className="text-[11px] text-ink-lighter italic mt-0.5">
                          "{upgrade.exampleSentence}"
                        </p>
                        <p className="text-[10px] text-ink-lighter mt-0.5 leading-relaxed">
                          {upgrade.usageNote}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddToBank(upgrade, i)}
                        disabled={addedUpgrades.has(i) || duplicateUpgrades.has(i) || createExpression.isPending}
                        title={duplicateUpgrades.has(i) ? "已存在于表达库" : addedUpgrades.has(i) ? "已加入表达库" : "加入表达库"}
                        className={cn(
                          "shrink-0 rounded-lg p-1.5 transition-colors",
                          addedUpgrades.has(i)
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-500"
                            : duplicateUpgrades.has(i)
                              ? "bg-ink/5 border border-ink/10 text-ink-lighter cursor-not-allowed"
                              : "bg-white border border-violet-200 text-violet-500 hover:bg-violet-50",
                        )}
                      >
                        {duplicateUpgrades.has(i) ? <span className="text-[10px] font-medium">已存在</span> : addedUpgrades.has(i) ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Phase 6: Content & Structure Diagnosis ── */}
          {feedback.contentAnalysis && (
            <div className="bg-card rounded-2xl border border-blue-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-blue-500" />
                <p className="text-xs font-semibold text-blue-700">内容与结构诊断 Content Analysis</p>
              </div>

              {/* Three-dim content scores */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-50/50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-ink-lighter mb-0.5">切题度</p>
                  <p className="text-lg font-bold text-blue-600">{feedback.contentAnalysis.relevanceScore.toFixed(1)}</p>
                  <p className="text-[10px] text-blue-500 mt-0.5">{feedback.contentAnalysis.relevanceLevel}</p>
                </div>
                <div className="bg-blue-50/50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-ink-lighter mb-0.5">连贯性</p>
                  <p className="text-lg font-bold text-blue-600">{feedback.contentAnalysis.coherenceScore.toFixed(1)}</p>
                  <p className="text-[10px] text-blue-500 mt-0.5">{feedback.contentAnalysis.coherenceLevel}</p>
                </div>
                <div className="bg-blue-50/50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-ink-lighter mb-0.5">展开度</p>
                  <p className="text-lg font-bold text-blue-600">{feedback.contentAnalysis.developmentScore.toFixed(1)}</p>
                  <p className="text-[10px] text-blue-500 mt-0.5">{feedback.contentAnalysis.developmentLevel}</p>
                </div>
              </div>

              {/* Summary */}
              {feedback.contentAnalysis.summary && (
                <p className="text-xs text-ink leading-relaxed">{feedback.contentAnalysis.summary}</p>
              )}

              {/* Requirements analysis */}
              {feedback.contentAnalysis.questionRequirements.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-ink-light">题目要求分析</p>
                  <div className="flex flex-wrap gap-1">
                    {feedback.contentAnalysis.questionRequirements.map((r, i) => {
                      const answered = feedback.contentAnalysis!.answeredRequirements.includes(r);
                      const missed = feedback.contentAnalysis!.missedRequirements.includes(r);
                      return (
                        <span key={i} className={cn(
                          "text-[10px] rounded-full px-2 py-0.5",
                          answered ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                          missed ? "bg-amber-50 text-amber-600 border border-amber-100" :
                          "bg-ink/5 text-ink-lighter border border-ink/10"
                        )}>
                          {answered ? "✓ " : missed ? "✗ " : ""}{r}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Content issues summary */}
              {(feedback.contentAnalysis.offTopicParts.length > 0 ||
                feedback.contentAnalysis.repetition.length > 0 ||
                feedback.contentAnalysis.orderProblems.length > 0 ||
                feedback.contentAnalysis.contentGaps.length > 0) && (
                <div className="space-y-1 text-[11px] text-ink-lighter">
                  {feedback.contentAnalysis.offTopicParts.map((p, i) => (
                    <p key={i} className="flex items-start gap-1"><span className="text-amber-500 shrink-0">⚠</span> 偏题: {p}</p>
                  ))}
                  {feedback.contentAnalysis.repetition.map((p, i) => (
                    <p key={i} className="flex items-start gap-1"><span className="text-ink-lighter shrink-0">↻</span> 重复: {p}</p>
                  ))}
                  {feedback.contentAnalysis.orderProblems.map((p, i) => (
                    <p key={i} className="flex items-start gap-1"><span className="text-ink-lighter shrink-0">⇄</span> 顺序: {p}</p>
                  ))}
                  {feedback.contentAnalysis.contentGaps.map((p, i) => (
                    <p key={i} className="flex items-start gap-1"><span className="text-blue-500 shrink-0">+</span> 缺失: {p}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Phase 6: Answer Structure ── */}
          {feedback.answerStructure && feedback.answerStructure.length > 0 && (
            <div className="bg-card rounded-2xl border border-purple-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-purple-100 text-purple-600 rounded-full px-2 py-0.5 font-medium">答案骨架</span>
                <p className="text-xs font-semibold text-purple-700">Answer Structure</p>
              </div>
              <div className="space-y-2">
                {feedback.answerStructure.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      {i < feedback.answerStructure!.length - 1 && (
                        <div className="w-px flex-1 bg-purple-100 my-1" />
                      )}
                    </div>
                    <div className="pb-2 flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-ink">{step.label}</p>
                      <p className="text-[11px] text-ink-lighter leading-relaxed mt-0.5">{step.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Phase 6: Diagnosis ── */}
          {feedback.diagnosis && (
            <div className="bg-card rounded-2xl border border-rose-100 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-rose-100 text-rose-600 rounded-full px-2 py-0.5 font-medium">问题诊断</span>
                <p className="text-xs font-semibold text-rose-700">Diagnosis</p>
              </div>
              <p className="text-xs text-ink-light leading-relaxed">
                {feedback.diagnosis}
              </p>
            </div>
          )}

          {/* ── Phase 6: Final High-score Answer ── */}
          {feedback.finalHighScoreAnswer && (
            <div className="bg-card rounded-2xl border border-emerald-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-emerald-100 text-emerald-600 rounded-full px-2 py-0.5 font-medium">最终高分答案</span>
                <p className="text-xs font-semibold text-emerald-700">Final High-score Answer ⭐</p>
              </div>
              <div className="bg-emerald-50/50 rounded-xl p-3">
                <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
                  {feedback.finalHighScoreAnswer}
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(feedback.finalHighScoreAnswer || "");
                }}
                className="text-[10px] text-emerald-600 hover:underline self-start"
              >
                复制文本
              </button>
            </div>
          )}

          {/* ── Phase 6: Key Improvements ── */}
          {feedback.keyImprovements && feedback.keyImprovements.length > 0 && (
            <div className="bg-card rounded-2xl border border-blue-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 font-medium">改进要点</span>
                <p className="text-xs font-semibold text-blue-700">Key Improvements</p>
              </div>
              <div className="space-y-1.5">
                {feedback.keyImprovements.map((imp, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-ink-light">
                    <span className="text-blue-400 mt-0.5 shrink-0">+</span>
                    <span>{imp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Phase 6: Key Upgrades ── */}
          {feedback.keyUpgrades && feedback.keyUpgrades.length > 0 && (
            <div className="bg-card rounded-2xl border border-amber-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-amber-500" />
                <p className="text-xs font-semibold text-amber-700">重点学习 Key Upgrades</p>
              </div>
              <div className="space-y-2">
                {feedback.keyUpgrades.map((ku, i) => (
                  <div key={i} className="bg-amber-50/50 rounded-xl border border-amber-100 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-ink">{ku.english}</span>
                      <span className="text-[10px] text-ink-lighter">{ku.chinese}</span>
                    </div>
                    <p className="text-[10px] text-ink-lighter leading-relaxed">{ku.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {feedback.oneBetterExample && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-2">参考范例</p>
              <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                {feedback.oneBetterExample}
              </div>
            </div>
          )}

          {/* ── Phase 6: Retry button ── */}
          {feedback.contentAnalysis && (
            <button
              onClick={async () => {
                setFirstFeedback(feedback);
                setAiError(null);

                // Save first attempt if not yet saved
                if (!firstAttemptId) {
                  setUploading(true);
                  const savedId = await saveFirstAttempt();
                  setUploading(false);
                  if (!savedId) {
                    // saveFirstAttempt already sets aiError on failure
                    return;
                  }
                  // firstAttemptId is now set by saveFirstAttempt → setFirstAttemptId
                }

                // Snapshot first-attempt data BEFORE resetting shared state
                setFirstTranscript(asr.transcript);
                setFirstAudioUrl(recorder.audioUrl || "");
                setFirstDuration(recorder.duration);

                setStep("retry_record");
                recorder.reset();
                asr.reset();
                setAiError(null);
              }}
              disabled={uploading}
              className="w-full bg-purple-50 text-purple-600 border border-purple-200 rounded-xl py-2.5 text-sm font-semibold hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {uploading ? "保存中..." : "按这个结构重新复述"}
            </button>
          )}

          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full bg-ink/5 text-ink-light rounded-xl py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {analyzing ? "分析中..." : "重新分析"}
          </button>

          <button
            onClick={handleSave}
            disabled={uploading}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {uploading ? "保存中..." : "保存练习记录"}
          </button>
        </div>
      )}

      {/* AI Error */}
      {aiError && (
        <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-accent-rose shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-accent-rose">出错了</p>
            <p className="text-xs text-ink-lighter mt-1">{aiError}</p>
            <button
              onClick={handleAnalyze}
              className="text-xs text-sage-deep font-medium mt-2 hover:underline"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* Step: Saved */}
      {step === "saved" && (
        <div className="text-center py-8 space-y-4">
          <div className="h-16 w-16 rounded-full bg-sage-light flex items-center justify-center mx-auto">
            {feedback ? (
              <Sparkles size={28} className="text-sage-deep" />
            ) : (
              <Mic size={28} className="text-sage-deep" />
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-ink">练习已保存</p>
            <p className="text-xs text-ink-lighter mt-1">
              {feedback ? "AI 反馈已生成并保存" : "练习记录已保存"}
            </p>
          </div>
          {aiError && (
            <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-2xl p-4 flex items-start gap-3 text-left">
              <AlertTriangle size={16} className="text-accent-rose shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-accent-rose">上传提示</p>
                <p className="text-xs text-ink-lighter mt-1">{aiError}</p>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleContinueFromSaved}
              className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold"
            >
              再练一次
            </button>
            <button
              onClick={() => { setView("home"); }}
              className="flex-1 bg-ink/5 text-ink-light rounded-xl py-2.5 text-sm font-medium"
            >
              返回首页
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 6: Retry Recording Step ── */}
      {step === "retry_record" && (
        <div className="space-y-4">
          {/* Reference materials */}
          <div className="bg-purple-50/50 rounded-2xl border border-purple-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                <RefreshCw size={12} /> 重新复述参考
              </p>
              <div className="flex gap-1">
                {(["structure", "full", "hidden"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setRetryReferenceMode(mode)}
                    className={cn(
                      "text-[10px] rounded-full px-2 py-0.5 transition-colors",
                      retryReferenceMode === mode
                        ? "bg-purple-200 text-purple-700"
                        : "bg-white text-ink-lighter"
                    )}
                  >
                    {mode === "structure" ? "只看骨架" : mode === "full" ? "完整答案" : "隐藏参考"}
                  </button>
                ))}
              </div>
            </div>

            {retryReferenceMode !== "hidden" && firstFeedback?.answerStructure && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-purple-600">Answer Structure</p>
                <div className="space-y-1">
                  {firstFeedback.answerStructure.map((s, i) => (
                    <div key={i} className="flex gap-2 text-[11px]">
                      <span className="text-purple-400 font-bold shrink-0">{i + 1}.</span>
                      <span>
                        <span className="font-medium text-ink">{s.label}</span>
                        {retryReferenceMode === "full" && (
                          <span className="text-ink-lighter"> — {s.content}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {retryReferenceMode === "full" && firstFeedback?.finalHighScoreAnswer && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-purple-600">Final High-score Answer</p>
                <p className="text-xs text-ink leading-relaxed bg-white rounded-xl p-3">
                  {firstFeedback.finalHighScoreAnswer}
                </p>
              </div>
            )}

            {retryReferenceMode !== "hidden" && firstFeedback?.keyUpgrades && firstFeedback.keyUpgrades.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-purple-600">Key Upgrades</p>
                <div className="flex flex-wrap gap-1.5">
                  {firstFeedback.keyUpgrades.map((ku, i) => (
                    <span key={i} className="text-[10px] bg-white text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">
                      {ku.english}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Question reminder */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-xs text-ink-lighter mb-1">题目</p>
            <p className="text-sm font-medium text-ink">{question}</p>
          </div>

          {/* Recording UI */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col items-center gap-4">
            {recorder.state === "idle" && (
              <button
                onClick={handleRetryStartRecording}
                disabled={isStarting}
                className="h-20 w-20 rounded-full bg-purple-100 flex items-center justify-center disabled:opacity-50"
              >
                {isStarting ? (
                  <Loader2 size={32} className="animate-spin text-purple-600" />
                ) : (
                  <Mic size={32} className="text-purple-600" />
                )}
              </button>
            )}
            {recorder.state === "recording" && (
              <button
                onClick={async () => { recorder.stop(); await asr.stop(); }}
                className="h-20 w-20 rounded-full bg-accent-rose/10 flex items-center justify-center animate-pulse"
              >
                <Square size={28} className="text-accent-rose" />
              </button>
            )}
            {recorder.state === "done" && (
              <div className="text-center space-y-3">
                <button
                  onClick={() => { recorder.reset(); asr.reset(); }}
                  className="h-14 w-14 rounded-full bg-ink/5 flex items-center justify-center"
                >
                  <RefreshCw size={24} className="text-ink-light" />
                </button>
                <p className="text-xs text-ink-lighter">点击重新录音</p>
                <button
                  onClick={handleRetryGoToReview}
                  className="bg-purple-100 text-purple-700 rounded-xl px-6 py-2.5 text-sm font-semibold"
                >
                  查看转录 → 分析
                </button>
              </div>
            )}
            <p className="text-xs text-ink-lighter">
              {recorder.state === "idle" ? "点击开始重新复述" :
               recorder.state === "recording" ? `录音中 ${recorder.duration}s — 点击停止` :
               `录音完成 ${recorder.duration}s`}
            </p>
          </div>
        </div>
      )}

      {/* ── Phase 6: Retry Review Step ── */}
      {step === "retry_review" && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-xs text-ink-lighter mb-2">重新复述录音</p>
            {recorder.audioUrl && <audio controls src={recorder.audioUrl} className="w-full h-10" />}
            <p className="text-[10px] text-ink-lighter mt-1">时长: {formatDuration(recorder.duration)}</p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-xs text-ink-lighter mb-2">
              转录文本
              <span className="text-[10px] text-ink-lighter ml-2">转录可能有误，请检查并修改</span>
            </p>
            <textarea
              value={asr.transcript}
              onChange={(e) => asr.setTranscript(e.target.value)}
              rows={5}
              className="w-full text-sm text-ink bg-ink/3 rounded-xl p-3 resize-none outline-none"
              placeholder="修改转录文本..."
            />
          </div>

          <button
            onClick={handleRetryAnalyze}
            disabled={analyzing || !asr.transcript.trim()}
            className="w-full bg-purple-100 text-purple-700 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Sparkles size={14} />
            {analyzing ? "分析中..." : "AI 分析重新复述"}
          </button>
        </div>
      )}

      {/* ── Phase 6: Retry Analyzing Step ── */}
      {step === "retry_analyzing" && (
        <div className="text-center py-12 space-y-4">
          <Loader2 size={32} className="animate-spin text-purple-600 mx-auto" />
          <div>
            <p className="text-sm font-medium text-ink">正在分析重新复述...</p>
            <p className="text-xs text-ink-lighter mt-1">AI 正在评估你的进步</p>
          </div>
        </div>
      )}

      {/* ── Phase 6: Retry Results Step (Comparison) ── */}
      {step === "retry_results" && retryFeedback && firstFeedback && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-purple-600" />
            <p className="text-sm font-semibold text-ink">前后对比 Before & After</p>
          </div>

          {/* Audio comparison */}
          <div className="space-y-2">
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-ink-lighter mb-2">第一次回答 · 录音</p>
              {firstAudioUrl ? (
                <audio controls src={firstAudioUrl} className="w-full h-9" />
              ) : (
                <p className="text-xs text-ink-lighter">录音可在练习详情中播放</p>
              )}
            </div>
            <div className="bg-card rounded-2xl border border-purple-100 p-4">
              <p className="text-xs text-purple-600 mb-2">重新复述 · 录音</p>
              {retryAudioUrl ? (
                <audio controls src={retryAudioUrl} className="w-full h-9" />
              ) : (
                <p className="text-xs text-ink-lighter">录音可在练习详情中播放</p>
              )}
            </div>
          </div>

          {/* Transcript comparison */}
          <div className="space-y-2">
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-ink-lighter mb-1">第一次原文</p>
              <p className="text-xs text-ink leading-relaxed whitespace-pre-line">{firstTranscript}</p>
            </div>
            <div className="bg-card rounded-2xl border border-purple-100 p-4">
              <p className="text-xs text-purple-600 mb-1">重新复述原文</p>
              <p className="text-xs text-ink leading-relaxed whitespace-pre-line">{retryTranscript}</p>
            </div>
          </div>

          {/* Language scores comparison */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
            <p className="text-xs font-medium text-ink-light mb-2">语言表现对比 Language Scores</p>
            <ComparisonScoreBar label="流利度 Fluency" before={firstFeedback.fluencyScore} after={retryFeedback.fluencyScore} />
            <ComparisonScoreBar label="语法 Grammar" before={firstFeedback.grammarScore} after={retryFeedback.grammarScore} />
            <ComparisonScoreBar label="词汇 Vocabulary" before={firstFeedback.vocabularyScore} after={retryFeedback.vocabularyScore} />
            <ComparisonScoreBar label="自然度 Naturalness" before={firstFeedback.naturalnessScore} after={retryFeedback.naturalnessScore} />
          </div>

          {/* Content scores comparison */}
          {firstFeedback.contentAnalysis && retryFeedback.contentAnalysis && (
            <div className="bg-card rounded-2xl border border-blue-100 p-4 space-y-2">
              <p className="text-xs font-medium text-ink-light mb-2">内容结构对比 Content Scores</p>
              <ComparisonScoreBar label="切题度 Relevance" before={firstFeedback.contentAnalysis.relevanceScore} after={retryFeedback.contentAnalysis.relevanceScore} />
              <ComparisonScoreBar label="连贯性 Coherence" before={firstFeedback.contentAnalysis.coherenceScore} after={retryFeedback.contentAnalysis.coherenceScore} />
              <ComparisonScoreBar label="展开度 Development" before={firstFeedback.contentAnalysis.developmentScore} after={retryFeedback.contentAnalysis.developmentScore} />
            </div>
          )}

          {/* AI summary */}
          {retryFeedback.contentAnalysis?.summary && (
            <div className="bg-card rounded-2xl border border-emerald-100 p-4">
              <p className="text-xs font-medium text-emerald-600 mb-2 flex items-center gap-1.5">
                <Sparkles size={12} /> AI 进步总结
              </p>
              <p className="text-xs text-ink leading-relaxed">{retryFeedback.contentAnalysis.summary}</p>
            </div>
          )}

          {/* Save retry */}
          <button
            onClick={handleRetrySave}
            disabled={uploading}
            className="w-full bg-purple-100 text-purple-700 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {uploading ? "保存中..." : "保存重新复述记录"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Generate Question Component (Bank-first + AI fallback) ──

function GenerateQuestion({
  mode, selectedMode, selectedTopic, selectedPart, isAiGenerated, currentQuestionId,
  dueExpressions, onGenerated, onReady,
}: {
  mode: string;
  selectedMode: string;
  selectedTopic: string;
  selectedPart: string;
  isAiGenerated: boolean;
  currentQuestionId: string | null;
  dueExpressions?: Record<string, unknown>[];
  onGenerated: (q: string, ctx: string, exprs: { english: string; chinese: string }[]) => void;
  onReady: () => void;
}) {
  const generatedKey = useRef("");

  useEffect(() => {
    const key = `${mode}|${selectedMode}|${selectedTopic}|${selectedPart}|${isAiGenerated}|${currentQuestionId}`;
    if (generatedKey.current === key) return;
    generatedKey.current = key;

    async function generate() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("No session");

        if (mode === "expression_practice") {
          const exprList = (dueExpressions || []).slice(0, 10).map((e) => ({
            english: (e.english as string) || "",
            chinese: (e.chinese as string) || "",
          }));

          if (exprList.length === 0) {
            onGenerated("", "", []);
            onReady();
            return;
          }

          const result = await generateExpressionPracticeQuestion(exprList, session.access_token);
          onGenerated(result.question, result.context, exprList);
        } else if (isAiGenerated) {
          // AI fallback: generate question via DeepSeek
          const modeDef = MODE_DEFS.find(m => m.key === selectedMode);
          const result = await generateCategoryQuestion(
            modeDef?.label || selectedMode,
            selectedTopic || selectedMode,
            [],
            session.access_token,
          );
          const exprs = (result.suitableExpressions || []).map((e: string) => ({ english: e, chinese: "" }));
          onGenerated(result.question, result.context, exprs);
        } else {
          // Question from bank — already set, just pass through
          onReady();
          return;
        }
      } catch {
        if (mode === "expression_practice") {
          onGenerated(
            "Describe a recent experience using some expressions you've learned.",
            "Try to naturally use expressions from your expression bank.",
            [],
          );
        } else {
          onGenerated(
            `Talk about ${selectedTopic || selectedMode} in English.`,
            `Share your experience and opinions about ${selectedTopic || selectedMode}.`,
            [],
          );
        }
      }
      onReady();
    }

    generate();
  }, [mode, selectedMode, selectedTopic, selectedPart, isAiGenerated, currentQuestionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── Session Detail Component ──

function SessionDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const { data: session, isLoading } = useSpeakingSession(sessionId);
  const s = session as Record<string, unknown> | undefined;
  const attempts = (s?.attempts as Record<string, unknown>[]) || [];

  // Edit state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const updateSession = useUpdateSpeakingSession();

  // Expression Upgrade re-add state
  const [addedUpgrades, setAddedUpgrades] = useState<Set<number>>(new Set());
  const [duplicateUpgrades, setDuplicateUpgrades] = useState<Set<number>>(new Set());
  const [addBankError, setAddBankError] = useState<string | null>(null);
  const createExpression = useCreateExpression();

  const handleAddToBankFromDetail = async (upgrade: Record<string, unknown>, index: number) => {
    setAddBankError(null);
    try {
      const { data: existing } = await supabase
        .from("expressions")
        .select("id")
        .ilike("english", (upgrade.english as string).trim())
        .eq("archived", false)
        .limit(1);

      if (existing && existing.length > 0) {
        setDuplicateUpgrades((prev) => new Set(prev).add(index));
        return;
      }

      await createExpression.mutateAsync({
        english: upgrade.english as string,
        chinese: upgrade.chinese as string,
        type: upgrade.type as string,
        scene: upgrade.scene as string,
        example_sentence: (upgrade.exampleSentence as string) || null,
        formality: (upgrade.formality as string) || null,
        notes: (upgrade.usageNote as string) || null,
        source_text: (upgrade.sourceChunk as string) || null,
        source: "speaking-upgrade",
        usefulness_level: 3,
      });
      setAddedUpgrades((prev) => new Set(prev).add(index));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[SessionDetail] handleAddToBank failed:", msg);
      setAddBankError(`加入表达库失败：${msg}`);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 size={24} className="animate-spin text-ink-lighter mx-auto" />
      </div>
    );
  }

  if (!s) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-ink-lighter">未找到该练习记录</p>
        <button onClick={onBack} className="text-xs text-sage-deep mt-2">返回</button>
      </div>
    );
  }

  const firstAttempt = attempts[0] as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={onBack} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div className="flex-1">
          <p className="text-sm text-ink-lighter">English OS</p>
          <h1 className="text-xl font-semibold tracking-tight mt-0.5">练习详情</h1>
        </div>
        <button
          onClick={() => {
            setEditTitle((s.title as string) || "");
            setEditNotes((s.learning_notes as string) || "");
            setShowEditDialog(true);
          }}
          className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0 hover:bg-ink/10 transition-colors"
        >
          <Edit3 size={14} className="text-ink-light" />
        </button>
      </header>

      {/* Question */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs text-ink-lighter mb-1">题目</p>
        {(s.title as string) && (
          <p className="text-sm font-semibold text-ink mb-0.5">{s.title as string}</p>
        )}
        <p className={cn("text-sm text-ink", (s.title as string) ? "text-ink-lighter font-normal" : "font-medium")}>
          {(s.prompt as string) || "N/A"}
        </p>
        {(s.context as string) && (
          <p className="text-xs text-ink-lighter mt-1">{s.context as string}</p>
        )}
        {(s.learning_notes as string) && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-ink-lighter mb-1">学习笔记</p>
            <p className="text-xs text-ink-light leading-relaxed whitespace-pre-line">{s.learning_notes as string}</p>
          </div>
        )}
        <div className="flex items-center gap-2 mt-2">
          {(s.category as string) && (
            <span className="text-[10px] bg-ink/5 rounded-full px-2 py-0.5 text-ink-lighter">
              {(s.category as string).replace(/_/g, " ")}
            </span>
          )}
          {(s.mode as string) && (
            <span className="text-[10px] bg-sage-light rounded-full px-2 py-0.5 text-sage-deep">
              {(s.mode as string).replace(/_/g, " ")}
            </span>
          )}
          <span className="text-[10px] text-ink-lighter ml-auto">
            {new Date(s.created_at as string).toLocaleDateString("zh-CN")}
          </span>
        </div>
      </div>

      {/* Audio playback */}
      {(firstAttempt?.audio_url as string) && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-ink-lighter mb-2">录音回放</p>
          <audio controls src={firstAttempt?.audio_url as string} className="w-full h-10" />
          {(firstAttempt?.audio_duration as number) ? (
            <p className="text-[10px] text-ink-lighter mt-1">
              时长: {formatDuration(firstAttempt?.audio_duration as number)}
            </p>
          ) : null}
        </div>
      )}

      {/* Transcript */}
      {(firstAttempt?.transcribed_text as string) && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-ink-lighter mb-1">转录文本</p>
          <p className="text-sm text-ink leading-relaxed">{firstAttempt?.transcribed_text as string}</p>
        </div>
      )}

      {/* Scores */}
      {((firstAttempt?.fluency_score as number) || (firstAttempt?.grammar_score as number) || (firstAttempt?.vocabulary_score as number) || (firstAttempt?.naturalness_score as number)) ? (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
          <p className="text-xs font-medium text-ink-light mb-1">四维评分</p>
          <ScoreBar label="流利度 Fluency" score={(firstAttempt?.fluency_score as number) || 0} />
          <ScoreBar label="语法 Grammar" score={(firstAttempt?.grammar_score as number) || 0} />
          <ScoreBar label="词汇 Vocabulary" score={(firstAttempt?.vocabulary_score as number) || 0} />
          <ScoreBar label="自然度 Naturalness" score={(firstAttempt?.naturalness_score as number) || 0} />
        </div>
      ) : null}

      {/* Natural version */}
      {(firstAttempt?.natural_version as string) && (
        <div className="bg-card rounded-2xl border border-sage-light/50 p-4">
          <p className="text-xs font-medium text-sage-deep mb-1">更自然的表达</p>
          <p className="text-sm text-ink leading-relaxed">{firstAttempt?.natural_version as string}</p>
        </div>
      )}

      {/* Expression Usage */}
      {((firstAttempt?.expressions_used as unknown[] | undefined)?.length || (firstAttempt?.expressions_missed as unknown[] | undefined)?.length) ? (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-medium text-ink-light mb-3">表达使用 Expression Usage</p>
          <div className="space-y-3">
            {((firstAttempt?.expressions_used as unknown[] | undefined)?.length ?? 0) > 0 && (
              <div>
                <p className="text-[11px] font-medium text-emerald-600 mb-1.5">Used</p>
                <div className="flex flex-wrap gap-1.5">
                  {(firstAttempt?.expressions_used as unknown[]).map((e, i) => (
                    <span key={i} className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-1 flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      {e as string}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {((firstAttempt?.expressions_missed as unknown[] | undefined)?.length ?? 0) > 0 && (
              <div>
                <p className="text-[11px] font-medium text-amber-600 mb-1.5">Missed</p>
                <div className="flex flex-wrap gap-1.5">
                  {(firstAttempt?.expressions_missed as unknown[]).map((e, i) => (
                    <span key={i} className="text-[11px] bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2.5 py-1 flex items-center gap-1">
                      <X size={11} />
                      {e as string}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Main problems */}
      {(firstAttempt?.main_problems as string) && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-medium text-ink-light mb-2">主要问题</p>
          <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
            {firstAttempt?.main_problems as string}
          </div>
        </div>
      )}

      {/* Useful corrections */}
      {(firstAttempt?.useful_corrections as string) && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-medium text-ink-light mb-2">纠错建议</p>
          <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
            {firstAttempt?.useful_corrections as string}
          </div>
        </div>
      )}

      {/* Better chunks */}
      {(firstAttempt?.better_chunks as string) && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-medium text-ink-light mb-2">推荐表达</p>
          <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
            {firstAttempt?.better_chunks as string}
          </div>
        </div>
      )}

      {/* Expression Upgrade */}
      {((firstAttempt?.expression_upgrade as unknown[] | undefined)?.length ?? 0) > 0 && (
        <div className="bg-card rounded-2xl border border-violet-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-violet-500" />
              <p className="text-xs font-semibold text-violet-700">表达升级 Expression Upgrade</p>
            </div>
            <button
              onClick={async () => {
                const upgrades = firstAttempt?.expression_upgrade as unknown[];
                for (let i = 0; i < upgrades.length; i++) {
                  if (!addedUpgrades.has(i) && !duplicateUpgrades.has(i)) {
                    await handleAddToBankFromDetail(upgrades[i] as Record<string, unknown>, i);
                  }
                }
              }}
              disabled={
                ((firstAttempt?.expression_upgrade as unknown[]).every(
                  (_: unknown, i: number) => addedUpgrades.has(i) || duplicateUpgrades.has(i)
                )) ||
                createExpression.isPending
              }
              className="text-[11px] text-violet-600 font-medium hover:underline disabled:text-ink-lighter disabled:no-underline"
            >
              {createExpression.isPending ? "Adding..." : "Add All"}
            </button>
          </div>
          {addBankError && (
            <p className="text-[11px] text-red-500">{addBankError}</p>
          )}
          <div className="space-y-2">
            {(firstAttempt?.expression_upgrade as unknown[]).map((upgrade: unknown, i: number) => {
              const u = upgrade as Record<string, unknown>;
              const isAdded = addedUpgrades.has(i);
              const isDuplicate = duplicateUpgrades.has(i);
              return (
                <div key={i} className={cn(
                  "rounded-xl border p-3 space-y-1.5 transition-colors",
                  isAdded ? "bg-emerald-50/50 border-emerald-100" : "bg-violet-50/50 border-violet-100"
                )}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-ink">{u.english as string}</span>
                    <span className="text-[10px] bg-white text-ink-lighter border rounded-full px-1.5 py-px">{u.type as string}</span>
                    <span className="text-[10px] text-ink-lighter">{u.formality as string}</span>
                    {isAdded ? (
                      <span className="text-[10px] text-emerald-600 ml-auto flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> Added
                      </span>
                    ) : isDuplicate ? (
                      <span className="text-[10px] text-amber-600 ml-auto">Already in bank</span>
                    ) : (
                      <button
                        onClick={() => handleAddToBankFromDetail(u, i)}
                        disabled={createExpression.isPending}
                        className="text-[10px] text-violet-600 font-medium hover:underline ml-auto disabled:text-ink-lighter"
                      >
                        + Add to Bank
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-lighter">{u.chinese as string}</p>
                  <p className="text-[11px] text-ink-lighter">
                    <span className="font-medium text-ink-light">Scene: </span>{u.scene as string}
                  </p>
                  {(u.exampleSentence as string) && (
                    <p className="text-[11px] text-ink-lighter italic">"{u.exampleSentence as string}"</p>
                  )}
                  {(u.usageNote as string) && (
                    <p className="text-[10px] text-ink-lighter leading-relaxed">{u.usageNote as string}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reference Answer */}
      {(firstAttempt?.reference_answer as string) && (
        <div className="bg-card rounded-2xl border border-purple-100 p-4">
          <p className="text-xs font-medium text-purple-600 mb-2 flex items-center gap-1.5">
            <Sparkles size={12} />
            AI 参考回答
          </p>
          <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
            {firstAttempt?.reference_answer as string}
          </div>
        </div>
      )}

      {/* One better example */}
      {(firstAttempt?.one_better_example as string) && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-medium text-ink-light mb-2">参考范例</p>
          <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
            {firstAttempt?.one_better_example as string}
          </div>
        </div>
      )}

      {/* Phase 6: Content & Structure (from saved attempt) */}
      {((firstAttempt?.content_analysis as Record<string, unknown> | undefined) ||
        (firstAttempt?.structured_better_answer as string) ||
        (firstAttempt?.diagnosis as string) ||
        (firstAttempt?.key_improvements as string)) ? (
        <>
          {/* Content Analysis */}
          {(firstAttempt?.content_analysis as Record<string, unknown> | undefined) && (
            (() => {
              const ca = firstAttempt?.content_analysis as Record<string, unknown>;
              return (
                <div className="bg-card rounded-2xl border border-blue-100 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-blue-500" />
                    <p className="text-xs font-semibold text-blue-700">内容与结构诊断 Content Analysis</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-50/50 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-ink-lighter mb-0.5">切题度</p>
                      <p className="text-lg font-bold text-blue-600">{typeof ca.relevanceScore === "number" ? ca.relevanceScore.toFixed(1) : "-"}</p>
                      <p className="text-[10px] text-blue-500 mt-0.5">{(ca.relevanceLevel as string) || "-"}</p>
                    </div>
                    <div className="bg-blue-50/50 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-ink-lighter mb-0.5">连贯性</p>
                      <p className="text-lg font-bold text-blue-600">{typeof ca.coherenceScore === "number" ? ca.coherenceScore.toFixed(1) : "-"}</p>
                      <p className="text-[10px] text-blue-500 mt-0.5">{(ca.coherenceLevel as string) || "-"}</p>
                    </div>
                    <div className="bg-blue-50/50 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-ink-lighter mb-0.5">展开度</p>
                      <p className="text-lg font-bold text-blue-600">{typeof ca.developmentScore === "number" ? ca.developmentScore.toFixed(1) : "-"}</p>
                      <p className="text-[10px] text-blue-500 mt-0.5">{(ca.developmentLevel as string) || "-"}</p>
                    </div>
                  </div>
                  {(ca.summary as string) && (
                    <p className="text-xs text-ink leading-relaxed">{ca.summary as string}</p>
                  )}
                </div>
              );
            })()
          )}

          {/* Answer Structure */}
          {(firstAttempt?.answer_structure as unknown[] | undefined)?.length ? (
            <div className="bg-card rounded-2xl border border-purple-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-purple-700">Answer Structure</p>
              <div className="space-y-2">
                {(firstAttempt?.answer_structure as unknown[]).map((step: unknown, i: number) => {
                  const s = step as Record<string, unknown>;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-ink">{s.label as string}</p>
                        <p className="text-[11px] text-ink-lighter leading-relaxed mt-0.5">{s.content as string}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Diagnosis (saved replay) */}
          {(firstAttempt?.diagnosis as string) && (
            <div className="bg-card rounded-2xl border border-rose-100 p-4 space-y-2">
              <p className="text-xs font-semibold text-rose-700">问题诊断 Diagnosis</p>
              <p className="text-xs text-ink-light leading-relaxed">
                {firstAttempt?.diagnosis as string}
              </p>
            </div>
          )}

          {/* Final High-score Answer (saved replay) */}
          {(firstAttempt?.structured_better_answer as string) && (
            <div className="bg-card rounded-2xl border border-emerald-200 p-4 space-y-2">
              <p className="text-xs font-semibold text-emerald-700">最终高分答案 Final High-score Answer ⭐</p>
              <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
                {firstAttempt?.structured_better_answer as string}
              </p>
            </div>
          )}

          {/* Key Improvements (saved replay) */}
          {(firstAttempt?.key_improvements as string) && (
            (() => {
              try {
                const improvements = JSON.parse(firstAttempt?.key_improvements as string) as string[];
                if (!Array.isArray(improvements) || improvements.length === 0) return null;
                return (
                  <div className="bg-card rounded-2xl border border-blue-100 p-4 space-y-2">
                    <p className="text-xs font-semibold text-blue-700">改进要点 Key Improvements</p>
                    <div className="space-y-1.5">
                      {improvements.map((imp, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-ink-light">
                          <span className="text-blue-400 mt-0.5 shrink-0">+</span>
                          <span>{imp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              } catch { return null; }
            })()
          )}

          {/* Key Upgrades */}
          {(firstAttempt?.key_upgrades as unknown[] | undefined)?.length ? (
            <div className="bg-card rounded-2xl border border-amber-100 p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-700">重点学习 Key Upgrades</p>
              <div className="space-y-2">
                {(firstAttempt?.key_upgrades as unknown[]).map((ku: unknown, i: number) => {
                  const k = ku as Record<string, unknown>;
                  return (
                    <div key={i} className="bg-amber-50/50 rounded-xl border border-amber-100 p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-ink">{k.english as string}</span>
                        <span className="text-[10px] text-ink-lighter">{k.chinese as string}</span>
                      </div>
                      <p className="text-[10px] text-ink-lighter leading-relaxed">{k.reason as string}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        /* Old attempt without content analysis */
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-ink-lighter text-center">
            该历史记录尚未进行内容结构分析。
          </p>
        </div>
      )}

      {/* Retry attempt comparison — shown when a retry (Round 2+) exists */}
      {(() => {
        const retryAttempt = attempts.find(
          (a) => (a as Record<string, unknown>).is_retry === true || ((a as Record<string, unknown>).attempt_round as number) > 1,
        ) as Record<string, unknown> | undefined;

        if (!retryAttempt || retryAttempt === firstAttempt) return null;

        return (
          <div className="space-y-4 mt-6 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-purple-600" />
              <p className="text-sm font-semibold text-ink">重新复述对比 (Round {(retryAttempt.attempt_round as number) || 2})</p>
            </div>

            {/* Retry audio */}
            {(retryAttempt.audio_url as string) && (
              <div className="bg-purple-50/50 rounded-2xl border border-purple-100 p-4">
                <p className="text-xs text-purple-600 mb-2">重新复述录音</p>
                <audio controls src={retryAttempt.audio_url as string} className="w-full h-10" />
                {(retryAttempt.audio_duration as number) ? (
                  <p className="text-[10px] text-ink-lighter mt-1">
                    时长: {formatDuration(retryAttempt.audio_duration as number)}
                  </p>
                ) : null}
              </div>
            )}

            {/* Retry transcript */}
            {(retryAttempt.transcribed_text as string) && (
              <div className="bg-card rounded-2xl border border-purple-100 p-4">
                <p className="text-xs text-purple-600 mb-1">重新复述文本</p>
                <p className="text-sm text-ink leading-relaxed">{retryAttempt.transcribed_text as string}</p>
              </div>
            )}

            {/* Score comparison */}
            {((retryAttempt.fluency_score as number) || (firstAttempt?.fluency_score as number)) ? (
              <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
                <p className="text-xs font-medium text-ink-light mb-1">语言表现对比</p>
                <ComparisonScoreBar
                  label="流利度 Fluency"
                  before={(firstAttempt?.fluency_score as number) || 0}
                  after={(retryAttempt.fluency_score as number) || 0}
                />
                <ComparisonScoreBar
                  label="语法 Grammar"
                  before={(firstAttempt?.grammar_score as number) || 0}
                  after={(retryAttempt.grammar_score as number) || 0}
                />
                <ComparisonScoreBar
                  label="词汇 Vocabulary"
                  before={(firstAttempt?.vocabulary_score as number) || 0}
                  after={(retryAttempt.vocabulary_score as number) || 0}
                />
                <ComparisonScoreBar
                  label="自然度 Naturalness"
                  before={(firstAttempt?.naturalness_score as number) || 0}
                  after={(retryAttempt.naturalness_score as number) || 0}
                />
              </div>
            ) : null}

            {/* Retry natural version */}
            {(retryAttempt.natural_version as string) && (
              <div className="bg-card rounded-2xl border border-purple-100 p-4">
                <p className="text-xs font-medium text-purple-600 mb-1">重新复述 · 更自然的表达</p>
                <p className="text-sm text-ink leading-relaxed">{retryAttempt.natural_version as string}</p>
              </div>
            )}

            {/* Retry main problems */}
            {(retryAttempt.main_problems as string) && (
              <div className="bg-card rounded-2xl border border-purple-100 p-4">
                <p className="text-xs font-medium text-purple-600 mb-2">重新复述 · 存在的问题</p>
                <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                  {retryAttempt.main_problems as string}
                </div>
              </div>
            )}

            {/* Retry diagnosis */}
            {(retryAttempt.diagnosis as string) && (
              <div className="bg-card rounded-2xl border border-rose-100 p-4 space-y-2">
                <p className="text-xs font-semibold text-rose-700">重新复述诊断 Diagnosis</p>
                <p className="text-xs text-ink-light leading-relaxed">
                  {retryAttempt.diagnosis as string}
                </p>
              </div>
            )}

            {/* Retry structured better answer */}
            {(retryAttempt.structured_better_answer as string) && (
              <div className="bg-card rounded-2xl border border-emerald-200 p-4 space-y-2">
                <p className="text-xs font-semibold text-emerald-700">重新复述高分答案</p>
                <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
                  {retryAttempt.structured_better_answer as string}
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Edit Dialog ── */}
      {showEditDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowEditDialog(false)} />
          <div className="relative bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 z-10 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-ink mb-4">编辑练习记录</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ink-light mb-1.5 block">练习标题</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={(s.prompt as string)?.slice(0, 60) || ""}
                  className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-background text-ink focus:outline-none focus:border-sage-light"
                />
                <p className="text-[10px] text-ink-lighter mt-1">留空则使用题目原文作为标题</p>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-light mb-1.5 block">学习笔记</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="记录学习心得、遇到的困难、改进方向..."
                  rows={4}
                  className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-background text-ink focus:outline-none focus:border-sage-light resize-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowEditDialog(false)}
                className="flex-1 h-10 rounded-xl border border-border text-sm text-ink-light hover:bg-ink/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  try {
                    await updateSession.mutateAsync({
                      sessionId,
                      title: editTitle || undefined,
                      learningNotes: editNotes || undefined,
                    });
                  } catch { /* ignore */ }
                  setShowEditDialog(false);
                }}
                disabled={updateSession.isPending}
                className="flex-1 h-10 rounded-xl bg-sage-light text-sage-deep text-sm font-semibold hover:bg-sage-light/80 transition-colors disabled:opacity-50"
              >
                {updateSession.isPending ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dev Debug Panel ──

function DebugPanel({
  step, recorderState, isListening, isProcessing, transcript, interim, audioBlob, audioUrl, sessionId, question, feedback, canAnalyze, canSave,
}: {
  step: string;
  recorderState: string;
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  interim: string;
  audioBlob: Blob | null;
  audioUrl: string | null;
  sessionId: string | null;
  question: string;
  feedback: SpeakingFeedback | null;
  canAnalyze: boolean;
  canSave: boolean;
}) {
  const boolIcon = (v: boolean) => v ? "✅" : "❌";
  return (
    <div className="bg-gray-900 text-green-400 rounded-xl p-3 text-[11px] font-mono leading-relaxed space-y-0.5 border border-gray-700">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Speaking Debug</p>
      <p>Step: <span className="text-yellow-300">{step}</span></p>
      <p>Recording state: <span className={recorderState === "recording" ? "text-red-400" : recorderState === "done" ? "text-green-400" : "text-gray-300"}>{recorderState}</span></p>
      <p>MediaRecorder: <span className="text-gray-300">(via recorder.state)</span></p>
      <p>SpeechRecognition: <span className={isListening ? "text-green-400" : "text-gray-500"}>{isListening ? "listening" : "stopped"}</span></p>
      <p>ASR Processing: <span className={isProcessing ? "text-yellow-400" : "text-gray-500"}>{isProcessing ? "uploading + transcribing..." : "idle"}</span></p>
      <p>AudioBlob: {boolIcon(!!audioBlob)} {audioBlob ? <span className="text-gray-500">({(audioBlob.size / 1024).toFixed(1)} KB)</span> : <span className="text-red-400">no</span>}</p>
      <p>AudioURL: {boolIcon(!!audioUrl)} {audioUrl ? "yes" : <span className="text-red-400">no</span>}</p>
      <p>Transcript: <span className={transcript.length > 0 ? "text-green-400" : "text-red-400"}>{transcript.length > 0 ? `${transcript.length} chars` : "0 chars"}</span></p>
      <p>Interim: {interim ? <span className="text-yellow-300">"{interim}"</span> : <span className="text-gray-500">none</span>}</p>
      <p>SessionId: {boolIcon(!!sessionId)} {sessionId ? "exists" : <span className="text-red-400">不存在</span>}</p>
      <p>CanAnalyze: {boolIcon(canAnalyze)} {canAnalyze ? <span className="text-green-400">true</span> : <span className="text-red-400">false</span>}</p>
      <p>CanSave: {boolIcon(canSave)} {canSave ? <span className="text-green-400">true</span> : <span className="text-red-400">false</span>}</p>
      {feedback && (
        <>
          <p className="text-gray-500 mt-1">--- Feedback ---</p>
          <p>Scores: F{feedback.fluencyScore} G{feedback.grammarScore} V{feedback.vocabularyScore} N{feedback.naturalnessScore}</p>
          <p>Used: [{feedback.expressionsUsed.join(", ")}]</p>
          <p>Missed: [{feedback.expressionsMissed.join(", ")}]</p>
        </>
      )}
    </div>
  );
}
