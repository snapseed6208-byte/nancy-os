import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Mic, MicOff, Square, Plus, ChevronRight, Sparkles,
  Loader2, CheckCircle2, AlertTriangle, Play, Pause, RefreshCw,
  Home, MessageSquare, Coffee, Briefcase, GraduationCap, Heart,
  Target, Clock, BarChart3, Zap, X, Search, Shuffle, Bot, Library,
  Filter, ChevronDown,
} from "lucide-react";
import {
  useSpeakingSessions, useSpeakingSession, useCreateSpeakingSessionV2,
  useCreateSpeakingAttempt, useCreateExpression, uploadAudio, useDueExpressions, useSpeakingStats,
  useSpeakingQuestions, useSpeakingQuestionHistory, useRecordSpeakingQuestionUsage,
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

type Step = "generating" | "record" | "review" | "analyzing" | "results" | "saved" | "empty_expression_practice";
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

// ── Audio Recorder Hook ──

type MicErrorType = "denied" | "not_found" | "busy" | "unsupported" | "unknown";

function useAudioRecorder() {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<MicErrorType | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startTime = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownsStreamRef = useRef(true);

  const _setupRecorder = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    const mr = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
    });
    mediaRecorder.current = mr;
    chunks.current = [];
    startTime.current = Date.now();

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

    mr.onstop = () => {
      const audioBlob = new Blob(chunks.current, { type: mr.mimeType });
      const url = URL.createObjectURL(audioBlob);
      setBlob(audioBlob);
      setAudioUrl(url);
      setDuration(Math.round((Date.now() - startTime.current) / 1000));
      setState("done");
      if (timerRef.current) clearInterval(timerRef.current);
      wakeLockRef.current?.release().catch(() => {});
    };

    mr.start();
    setState("recording");
    timerRef.current = setInterval(() => {
      setDuration(Math.round((Date.now() - startTime.current) / 1000));
    }, 200);
  }, []);

  const start = useCallback(async (existingStream?: MediaStream) => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") return;
    setError(null);
    setErrorType(null);
    try {
      const stream = existingStream || await navigator.mediaDevices.getUserMedia({ audio: true });
      ownsStreamRef.current = !existingStream;
      _setupRecorder(stream);
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch { /* not supported */ }
    } catch (err: unknown) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setError("麦克风权限被拒绝。请在浏览器设置中允许麦克风访问，或切换至文本模式。");
        setErrorType("denied");
      } else if (e.name === "NotFoundError") {
        setError("未检测到麦克风设备。请连接麦克风后重试，或切换至文本模式。");
        setErrorType("not_found");
      } else if (e.name === "NotReadableError") {
        setError("麦克风被其他应用占用。请关闭其他使用麦克风的应用后重试。");
        setErrorType("busy");
      } else {
        setError("无法访问麦克风。请检查浏览器权限设置，或切换至文本模式。");
        setErrorType("unknown");
      }
      setState("idle");
    }
  }, [_setupRecorder]);

  const startWithStream = useCallback((stream: MediaStream) => {
    return start(stream);
  }, [start]);

  const stop = useCallback(() => {
    mediaRecorder.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ownsStreamRef.current = true;
    setAudioUrl(null);
    setBlob(null);
    setDuration(0);
    setError(null);
    setErrorType(null);
    setState("idle");
  }, [audioUrl]);

  return { state, audioUrl, blob, duration, error, errorType, start, startWithStream, stop, reset, streamRef };
}

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
    if (isStarting || recorder.state !== "idle") return;
    setIsStarting(true);
    setAiError(null);
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

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await Promise.all([
        recorder.start(stream),
        asr.start(stream),
      ]);
      setIsStarting(false);
    } catch (err) {
      console.error("[EnglishSpeaking] handleStartRecording failed:", err);
      setAiError("创建练习会话失败，请检查网络或重新登录。");
      setIsStarting(false);
    }
  };

  const handleStopRecording = () => {
    recorder.stop();
    asr.stop();
  };

  useEffect(() => {
    if (recorder.state === "done" && recorder.blob && !asr.transcript && asr.supported && asr.isProcessing === false) {
      asr.stop(recorder.blob);
    }
  }, [recorder.state, recorder.blob]);

  const handleGoToReview = async () => {
    if (asr.isProcessing) {
      await new Promise<void>((r) => {
        const check = setInterval(() => {
          if (!asr.isProcessing) { clearInterval(check); r(); }
        }, 150);
      });
    }
    if (asr.supported && asr.isListening) {
      await new Promise<void>((r) => setTimeout(r, 500));
    }
    setStep("review");
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
      const result = await analyzeSpeaking(question, text, suitableExpressions.map(e => e.english), session.access_token);
      setFeedback(result);
      const raPromise = generateReferenceAnswer(question, session.access_token)
        .then((ra) => setReferenceAnswer(ra))
        .catch(() => {});
      referenceAnswerPromise.current = raPromise;
      setStep("results");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI 分析失败，请稍后重试");
      setStep("review");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!sessionId) {
      console.error("[EnglishSpeaking] handleSave: sessionId is null — was handleStartRecording called?");
      return;
    }
    setUploading(true);

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

    try {
      await createAttempt.mutateAsync({
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
      });
    } catch (err) {
      console.error("[EnglishSpeaking] createAttempt failed:", err);
      setAiError("保存练习记录失败，请稍后重试。你的录音和分析结果仍然保留在当前页面。");
      setUploading(false);
      return;
    }

    // Record question usage if from bank
    if (currentQuestionId) {
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

    // Auto-lower SRS levels for missed expressions
    if (expressionsMissed.length > 0) {
      try {
        await lowerMissedExpressions(expressionsMissed);
      } catch (err) {
        console.error("[EnglishSpeaking] lowerMissedExpressions failed:", err);
      }
    }
    if (expressionsUsed.length > 0) {
      try {
        await boostUsedExpressions(expressionsUsed);
      } catch (err) {
        console.error("[EnglishSpeaking] boostUsedExpressions failed:", err);
      }
    }

    setUploading(false);
    setStep("saved");
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
              const first = attempts[0] as Record<string, unknown> | undefined;
              const avgScore = first
                ? [first.fluency_score, first.grammar_score, first.vocabulary_score, first.naturalness_score]
                    .filter((v): v is number => typeof v === "number" && v > 0)
                : [];
              const scoreVal = avgScore.length > 0
                ? (avgScore.reduce((a, b) => a + b, 0) / avgScore.length).toFixed(1)
                : null;
              const duration = (first?.audio_duration as number) || 0;
              const usedCount = ((first?.expressions_used as unknown[]) || []).length;
              return (
                <button
                  key={s.id as string}
                  onClick={() => handleViewSession(s.id as string)}
                  className="w-full bg-card rounded-2xl border border-border p-4 text-left hover:border-sage-light/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{(s.prompt as string).slice(0, 60)}</p>
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
              );
            })}
          </div>
        </div>
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

          {feedback.mainProblems && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-2">主要问题</p>
              <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                {feedback.mainProblems}
              </div>
            </div>
          )}

          {feedback.usefulCorrections && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-2">纠错建议</p>
              <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                {feedback.usefulCorrections}
              </div>
            </div>
          )}

          {feedback.betterChunks && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-2">推荐表达</p>
              <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                {feedback.betterChunks}
              </div>
            </div>
          )}

          {feedback.expressionUpgrade && feedback.expressionUpgrade.length > 0 && (
            <div className="bg-card rounded-2xl border border-violet-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-violet-500" />
                <p className="text-xs font-semibold text-violet-700">表达升级 Expression Upgrade</p>
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

          {feedback.oneBetterExample && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-2">参考范例</p>
              <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                {feedback.oneBetterExample}
              </div>
            </div>
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
        <div>
          <p className="text-sm text-ink-lighter">English OS</p>
          <h1 className="text-xl font-semibold tracking-tight mt-0.5">练习详情</h1>
        </div>
      </header>

      {/* Question */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs text-ink-lighter mb-1">题目</p>
        <p className="text-sm font-medium text-ink">{(s.prompt as string) || "N/A"}</p>
        {(s.context as string) && (
          <p className="text-xs text-ink-lighter mt-1">{s.context as string}</p>
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
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-violet-500" />
            <p className="text-xs font-semibold text-violet-700">表达升级 Expression Upgrade</p>
          </div>
          <div className="space-y-2">
            {(firstAttempt?.expression_upgrade as unknown[]).map((upgrade: unknown, i: number) => {
              const u = upgrade as Record<string, unknown>;
              return (
                <div key={i} className="bg-violet-50/50 rounded-xl border border-violet-100 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-ink">{u.english as string}</span>
                    <span className="text-[10px] bg-white text-ink-lighter border rounded-full px-1.5 py-px">{u.type as string}</span>
                    <span className="text-[10px] text-ink-lighter">{u.formality as string}</span>
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
