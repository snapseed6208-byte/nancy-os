import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Mic, MicOff, Square, Plus, ChevronRight, Sparkles,
  Loader2, CheckCircle2, AlertTriangle, Play, Pause, RefreshCw,
  Home, MessageSquare, Coffee, Briefcase, GraduationCap, Heart,
  Target, Clock, BarChart3, Zap, X,
} from "lucide-react";
import {
  useSpeakingSessions, useSpeakingSession, useCreateSpeakingSession,
  useCreateSpeakingAttempt, useCreateExpression, uploadAudio, useDueExpressions, useSpeakingStats,
} from "@/lib/hooks/useEnglish";
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

type Step = "category" | "generating" | "record" | "review" | "analyzing" | "results" | "saved" | "empty_expression_practice";
type ViewState = "home" | "new" | "detail";

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  subs: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    key: "daily_life", label: "日常对话", icon: Coffee,
    subs: ["Restaurant", "Shopping", "Travel", "Friends", "Hobbies", "Food"],
  },
  {
    key: "work_business", label: "工作商务", icon: Briefcase,
    subs: ["Job Interview", "Meeting", "Presentation", "Customer Communication"],
  },
  {
    key: "ielts", label: "雅思口语", icon: GraduationCap,
    subs: ["Part 1 Introduction", "Part 2 Long Turn", "Part 3 Discussion"],
  },
  {
    key: "personal_growth", label: "个人成长", icon: Heart,
    subs: ["Challenges", "Goals", "Learning", "Relationships"],
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  daily_life: "bg-amber-50 text-amber-600",
  work_business: "bg-blue-50 text-blue-600",
  ielts: "bg-purple-50 text-purple-600",
  personal_growth: "bg-emerald-50 text-emerald-600",
};

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
    // Always stop tracks (shared or owned) — done with stream
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

  // New session state
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
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

  // Data
  const { data: sessions, isLoading: sessionsLoading } = useSpeakingSessions();
  const { data: stats } = useSpeakingStats();
  const { data: dueExpressions } = useDueExpressions();
  const createSession = useCreateSpeakingSession();
  const createAttempt = useCreateSpeakingAttempt();
  const createExpression = useCreateExpression();

  const recorder = useAudioRecorder();
  const asr = useSpeechRecognition();

  // ── Handlers ──

  const handlePickCategory = (catKey: string) => {
    setView("new");
    setCategory(catKey);
    setStep("category");
    if (catKey === "expression_practice") {
      setMode("expression_practice");
      setStep("generating");
    }
  };

  const handlePickSub = (sub: string) => {
    setSubCategory(sub);
    setStep("generating");
  };

  const handleStartExpressionPractice = () => {
    if (!dueExpressions || dueExpressions.length === 0) {
      setView("new");
      setMode("expression_practice");
      setCategory("expression_practice");
      setSubCategory("");
      setStep("empty_expression_practice");
      return;
    }
    setView("new");
    setMode("expression_practice");
    setCategory("expression_practice");
    setSubCategory("");
    setStep("generating");
  };

  const handleStartRecording = async () => {
    if (isStarting || recorder.state !== "idle") return;
    setIsStarting(true);
    setAiError(null);
    try {
      const result = await createSession.mutateAsync({
        prompt: question,
        context: questionContext,
        category: category || undefined,
        mode,
        recommended_expressions: suitableExpressions.length > 0 ? suitableExpressions : undefined,
      });
      setSessionId(result.id as string);
      asr.setSessionId(result.id as string);

      // Get stream once, share with both MediaRecorder (blob/playback) and ASR (real-time)
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

  // Batch ASR: when MediaRecorder blob is ready, submit for transcription.
  // Streaming providers already have transcript via real-time WebSocket.
  useEffect(() => {
    if (recorder.state === "done" && recorder.blob && !asr.transcript && asr.supported && asr.isProcessing === false) {
      asr.stop(recorder.blob);
    }
  }, [recorder.state, recorder.blob]);

  const handleGoToReview = async () => {
    // Wait for cloud ASR (aliyun/whisper) to finish upload + transcription
    if (asr.isProcessing) {
      await new Promise<void>((r) => {
        const check = setInterval(() => {
          if (!asr.isProcessing) { clearInterval(check); r(); }
        }, 150);
      });
    }
    // Ensure browser ASR onend has fired before showing review
    // (onend fires ~100ms after stop(), MediaRecorder.onstop takes 200-500ms)
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
      // Generate reference answer in parallel, store promise for save to await
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

    // Await pending reference answer with a 3s timeout so it's not lost on save
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
      console.log("[EnglishSpeaking] handleSave blob:", {
        size: recorder.blob.size,
        type: recorder.blob.type,
        duration: recorder.duration,
      });
      try {
        audioUrl = await uploadAudio(sessionId, recorder.blob);
        console.log("[EnglishSpeaking] Audio upload OK:", audioUrl);
      } catch (err) {
        console.error("[EnglishSpeaking] Audio upload failed:", err);
        setAiError("录音上传失败，但练习记录已保存。Storage bucket 可能未配置正确。");
      }
    } else {
      console.warn("[EnglishSpeaking] handleSave: recorder.blob is null — audio not saved");
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

    // Auto-lower SRS levels for missed expressions
    if (expressionsMissed.length > 0) {
      try {
        await lowerMissedExpressions(expressionsMissed);
      } catch (err) {
        console.error("[EnglishSpeaking] lowerMissedExpressions failed:", err);
      }
    }
    // Boost SRS levels for successfully used expressions
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
      // Dedup: check if expression already exists (case-insensitive)
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
    setStep("category");
    setCategory("");
    setSubCategory("");
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
    } else if (view === "detail") {
      setView("home");
      setViewingSessionId(null);
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

        {/* Category cards */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-light">选择口语类别</p>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.key}
                  onClick={() => { handlePickCategory(cat.key); }}
                  className="bg-card rounded-2xl border border-border p-4 text-left hover:border-sage-light/50 transition-colors"
                >
                  <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center mb-2", CATEGORY_COLORS[cat.key] || "bg-ink/5 text-ink-light")}>
                    <Icon size={18} />
                  </div>
                  <p className="text-sm font-semibold text-ink">{cat.label}</p>
                  <p className="text-[10px] text-ink-lighter mt-0.5">{cat.subs.slice(0, 2).join(" · ")}...</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expression Practice */}
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
              <p className="text-xs text-ink-lighter mt-1">选择一个类别开始你的第一次口语训练</p>
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

  // ── DETAIL VIEW ──

  if (view === "detail" && viewingSessionId) {
    return (
      <SessionDetail
        sessionId={viewingSessionId}
        onBack={handleBack}
      />
    );
  }

  // ── SUBCATEGORY PICKER ──

  if (step === "category" && category && category !== "expression_practice") {
    const cat = CATEGORIES.find((c) => c.key === category);
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-3">
          <button onClick={() => { setView("home"); setCategory(""); setStep("category"); }} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <p className="text-sm text-ink-lighter">English OS</p>
            <h1 className="text-xl font-semibold tracking-tight mt-0.5">{cat?.label} — 选择话题</h1>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-2">
          {cat?.subs.map((sub) => (
            <button
              key={sub}
              onClick={() => handlePickSub(sub)}
              className="bg-card rounded-2xl border border-border p-4 text-left hover:border-sage-light/50 transition-colors flex items-center justify-between"
            >
              <span className="text-sm font-medium text-ink">{sub}</span>
              <ChevronRight size={14} className="text-ink-lighter shrink-0" />
            </button>
          ))}
        </div>
      </div>
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
                onClick={() => { setView("home"); setStep("category"); }}
                className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold"
              >
                先去自由口语练习
              </button>
              <button
                onClick={() => { setView("home"); setStep("category"); setMode("free_speaking"); }}
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
              {mode === "expression_practice" ? "基于你的表达库生成练习题目" : `类别: ${CATEGORIES.find((c) => c.key === category)?.label} — ${subCategory}`}
            </p>
          </div>

          {/* Auto-trigger question generation */}
          <GenerateQuestion
            mode={mode}
            category={category}
            subCategory={subCategory}
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
                        category: category || undefined,
                        mode,
                        recommended_expressions: suitableExpressions.length > 0 ? suitableExpressions : undefined,
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
          {/* Audio playback */}
          {recorder.audioUrl && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-ink-lighter mb-2">你的录音 ({formatDuration(recorder.duration)})</p>
              <audio controls src={recorder.audioUrl} className="w-full h-10" />
            </div>
          )}

          {/* ASR transcript */}
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

          {/* Editable transcript */}
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
          {/* Scores */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
            <p className="text-xs font-medium text-ink-light mb-1">四维评分</p>
            <ScoreBar label="流利度 Fluency" score={feedback.fluencyScore} />
            <ScoreBar label="语法 Grammar" score={feedback.grammarScore} />
            <ScoreBar label="词汇 Vocabulary" score={feedback.vocabularyScore} />
            <ScoreBar label="自然度 Naturalness" score={feedback.naturalnessScore} />
          </div>

          {/* Natural version */}
          <div className="bg-card rounded-2xl border border-sage-light/50 p-4">
            <p className="text-xs font-medium text-sage-deep mb-1">更自然的表达</p>
            <p className="text-sm text-ink leading-relaxed">{feedback.naturalVersion}</p>
          </div>

          {/* Expression Usage */}
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

          {/* Main problems */}
          {feedback.mainProblems && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-2">主要问题</p>
              <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                {feedback.mainProblems}
              </div>
            </div>
          )}

          {/* Useful corrections */}
          {feedback.usefulCorrections && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-2">纠错建议</p>
              <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                {feedback.usefulCorrections}
              </div>
            </div>
          )}

          {/* Better chunks */}
          {feedback.betterChunks && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-2">推荐表达</p>
              <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                {feedback.betterChunks}
              </div>
            </div>
          )}

          {/* Expression Upgrade */}
          {feedback.expressionUpgrade && feedback.expressionUpgrade.length > 0 && (
            <div className="bg-card rounded-2xl border border-violet-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-violet-500" />
                <p className="text-xs font-semibold text-violet-700">表达升级 Expression Upgrade</p>
              </div>

              {/* Add-to-bank error */}
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

          {/* One better example */}
          {feedback.oneBetterExample && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-2">参考范例</p>
              <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                {feedback.oneBetterExample}
              </div>
            </div>
          )}

          {/* Re-analyze */}
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

          {/* Save */}
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
              onClick={handleNew}
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

// ── Auto-generate question component ──

function GenerateQuestion({
  mode, category, subCategory, dueExpressions, onGenerated, onReady,
}: {
  mode: string;
  category: string;
  subCategory: string;
  dueExpressions?: Record<string, unknown>[];
  onGenerated: (q: string, ctx: string, exprs: { english: string; chinese: string }[]) => void;
  onReady: () => void;
}) {
  const generatedKey = useRef("");

  useEffect(() => {
    const key = `${mode}|${category}|${subCategory}`;
    if (generatedKey.current === key) return;
    generatedKey.current = key;

    async function generate() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("No session");

        if (mode === "expression_practice") {
          // Only Expression Practice reads from the Expression Bank
          const exprList = (dueExpressions || []).slice(0, 10).map((e) => ({
            english: (e.english as string) || "",
            chinese: (e.chinese as string) || "",
          }));

          // Safety net: if no due expressions, go back to empty state
          if (exprList.length === 0) {
            onGenerated("", "", []);
            onReady();
            return;
          }

          const result = await generateExpressionPracticeQuestion(exprList, session.access_token);
          onGenerated(result.question, result.context, exprList);
        } else {
          // Other modes: pure category-based questions, no expression bank
          const cat = CATEGORIES.find((c) => c.key === category);
          const result = await generateCategoryQuestion(
            cat?.label || category, subCategory, [], session.access_token,
          );
          const exprs = (result.suitableExpressions || []).map((e: string) => ({ english: e, chinese: "" }));
          onGenerated(result.question, result.context, exprs);
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
            `Talk about ${subCategory} in English.`,
            `Share your experience and opinions about ${subCategory}.`,
            [],
          );
        }
      }
      onReady();
    }

    generate();
  }, [mode, category, subCategory]); // eslint-disable-line react-hooks/exhaustive-deps

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
