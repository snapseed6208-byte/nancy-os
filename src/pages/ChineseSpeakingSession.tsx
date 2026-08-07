import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Mic, Square, Play, Pause, Loader2, CheckCircle2,
  AlertTriangle, Sparkles, Lightbulb, ChevronRight, RotateCcw,
  Eye, EyeOff, Target, BarChart3, Volume2, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioRecorder } from "@/lib/hooks/useAudioRecorder";
import { createChineseSpeechProvider } from "@/lib/speech/chineseSpeechService";
import type { SpeechProvider } from "@/lib/speech/types";
import {
  useChineseSpeakingSession,
  useCreateChineseSpeakingAttempt,
  useUpdateChineseSpeakingAttempt,
  useMarkReferenceViewed,
  uploadChineseAudio,
  analyzeChineseExpression,
  generateChineseReference,
  compareChineseRounds,
  TOPIC_TYPE_LABELS,
  FRAMEWORK_LABELS,
  type ChineseTopicType,
  type V4Diagnosis,
  type V4Reference,
  type V4DimensionScore,
  type V4KeyUpgrade,
  type V2Comparison,
  type DeliveryMetrics,
} from "@/lib/hooks/useChineseSpeaking";

// ── Constants ──
const MIN_TRANSCRIPT_LENGTH = 5;

// ── Step type ──

type Step =
  | "idle"
  | "preparing"
  | "recording"
  | "stopping"
  | "transcribing"
  | "review"
  | "analyzing"
  | "result"
  | "retry_recording"
  | "retry_stopping"
  | "retry_review"
  | "retry_analyzing"
  | "comparing"
  | "save_error";

// ── Prep Countdown Component ──

function PrepCountdown({ seconds, onSkip }: { seconds: number; onSkip: () => void }) {
  const [count, setCount] = useState(seconds);

  useEffect(() => {
    if (count <= 0) return;
    const t = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    if (count <= 0) onSkip();
  }, [count, onSkip]);

  const pct = ((seconds - count) / seconds) * 100;

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      <p className="text-sm text-ink-lighter">准备时间</p>
      <div className="relative h-32 w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" className="text-ink/8" strokeWidth="4" />
          <circle
            cx="50" cy="50" r="44" fill="none" stroke="currentColor"
            className={cn("text-sage-deep transition-all duration-1000", count <= 5 && "text-accent-rose")}
            strokeWidth="4" strokeDasharray={`${pct * 2.76} 276`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-3xl font-bold tabular-nums", count <= 5 ? "text-accent-rose" : "text-ink")}>
            {count}
          </span>
        </div>
      </div>
      <button onClick={onSkip} className="text-sm text-ink-light underline">
        跳过准备
      </button>
    </div>
  );
}

// ── Recording Timer Component ──

function RecordingTimer({ elapsed, limit, onStop }: { elapsed: number; limit: number; onStop: () => void }) {
  const remaining = Math.max(0, limit - elapsed);
  const pct = (elapsed / limit) * 100;

  useEffect(() => {
    if (elapsed >= limit) onStop();
  }, [elapsed, limit, onStop]);

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" className="text-ink/8" strokeWidth="3" />
          <circle
            cx="50" cy="50" r="44" fill="none" stroke="currentColor"
            className={cn("text-accent-rose transition-colors", remaining <= 10 && "text-accent-rose animate-pulse")}
            strokeWidth="3" strokeDasharray={`${pct * 2.76} 276`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold tabular-nums", remaining <= 10 ? "text-accent-rose" : "text-ink")}>
            {remaining}
          </span>
          <span className="text-xs text-ink-lighter">秒</span>
        </div>
      </div>
    </div>
  );
}

// ── V4 Dimension bar ──

function V4DimensionBar({ data }: { data: V4DimensionScore }) {
  const pct = (data.score / data.max_score) * 100;
  const color =
    pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-sage-deep/60" : pct >= 40 ? "bg-amber-400" : "bg-accent-rose/60";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink">{data.label}</span>
        <span className="text-xs font-mono text-ink-light">{data.score}/{data.max_score}</span>
      </div>
      <div className="h-1.5 bg-ink/8 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-ink-lighter leading-relaxed">{data.diagnosis}</p>
      {data.evidence_quote && (
        <p className="text-[10px] text-ink-lighter/70 italic">
          &ldquo;{data.evidence_quote}&rdquo;
        </p>
      )}
    </div>
  );
}

// ── Helpers ──

function isValidTranscript(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < MIN_TRANSCRIPT_LENGTH) return false;
  if (trimmed.includes("转录功能将在")) return false;
  if (trimmed.includes("Stage 3")) return false;
  if (trimmed.startsWith("（") && trimmed.endsWith("）")) return false;
  return true;
}

// ── Main Page ──

export default function ChineseSpeakingSession() {
  const [, params] = useRoute("/chinese/session/:id");
  const [, navigate] = useLocation();
  const sessionId = params?.id || "";

  const { data: session, isLoading: sessionLoading } = useChineseSpeakingSession(sessionId);
  const createAttempt = useCreateChineseSpeakingAttempt();
  const updateAttempt = useUpdateChineseSpeakingAttempt();
  const markReferenceViewed = useMarkReferenceViewed();

  const recorder = useAudioRecorder();

  // ── Step state machine ──
  const [step, setStep] = useState<Step>("idle");

  // Round 1 transcript state
  const [transcript, setTranscript] = useState("");
  const [editedTranscript, setEditedTranscript] = useState("");
  const [asrInterim, setAsrInterim] = useState("");

  // Round 1 STT metadata
  const [r1SttProvider, setR1SttProvider] = useState("");
  const [r1SttMode, setR1SttMode] = useState("");
  const [r1TranscriptSource, setR1TranscriptSource] = useState<string | undefined>(undefined);
  const [r1SttSuccess, setR1SttSuccess] = useState(false);

  // Round 1 V4 AI results (diagnosis only; reference loaded on-demand)
  const [round1Diagnosis, setRound1Diagnosis] = useState<V4Diagnosis | null>(null);
  const [round1Reference, setRound1Reference] = useState<V4Reference | null>(null);
  const [round1DeliveryMetrics, setRound1DeliveryMetrics] = useState<DeliveryMetrics | null>(null);
  const [round1AttemptId, setRound1AttemptId] = useState<string | null>(null);
  const [round1AudioUrl, setRound1AudioUrl] = useState<string | null>(null);
  const [round1FullReferenceViewed, setRound1FullReferenceViewed] = useState(false);
  const [round1GeneratingReference, setRound1GeneratingReference] = useState(false);

  // Round 2 state
  const [retryRefMode, setRetryRefMode] = useState<"structure" | "full" | "hidden">("structure");
  const [round2Transcript, setRound2Transcript] = useState("");
  const [round2EditedTranscript, setRound2EditedTranscript] = useState("");
  const [r2SttProvider, setR2SttProvider] = useState("");
  const [r2SttMode, setR2SttMode] = useState("");
  const [r2TranscriptSource, setR2TranscriptSource] = useState<string | undefined>(undefined);
  const [r2SttSuccess, setR2SttSuccess] = useState(false);
  const [round2Diagnosis, setRound2Diagnosis] = useState<V4Diagnosis | null>(null);
  const [round2Reference, setRound2Reference] = useState<V4Reference | null>(null);
  const [round2DeliveryMetrics, setRound2DeliveryMetrics] = useState<DeliveryMetrics | null>(null);
  const [round2AudioUrl, setRound2AudioUrl] = useState<string | null>(null);
  const [round2FullReferenceViewed, setRound2FullReferenceViewed] = useState(false);

  // Comparison
  const [comparison, setComparison] = useState<V2Comparison | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ASR provider ref
  const asrRef = useRef<SpeechProvider | null>(null);
  const stoppingRef = useRef(false);

  // Timer ref for recording
  const recordStartRef = useRef(0);
  const [recordElapsed, setRecordElapsed] = useState(0);

  // Cleanup ASR on unmount
  useEffect(() => {
    return () => {
      asrRef.current?.reset();
    };
  }, []);

  function createAsr(): SpeechProvider {
    asrRef.current?.reset();
    const p = createChineseSpeechProvider();
    p.onTranscriptUpdate = () => {};
    p.onInterimUpdate = (text: string) => setAsrInterim(text);
    p.onStateChange = () => {};
    asrRef.current = p;
    return p;
  }

  // ── Prep → Recording ──

  const handlePrepDone = useCallback(async () => {
    setStep("preparing");
    setAiError(null);
    stoppingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const asr = createAsr();

      await Promise.all([
        recorder.start(stream),
        asr.start(stream),
      ]);

      setStep("recording");
      recordStartRef.current = Date.now();
      setRecordElapsed(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "启动失败";
      if (msg.includes("CHINESE_APP_KEY_NOT_CONFIGURED")) {
        setAiError("中文语音识别尚未配置。请在阿里云控制台创建普通话实时识别项目，并将 AppKey 添加到 Supabase Edge Function Secrets (ALIYUN_ASR_CHINESE_APP_KEY)。");
      } else if (!recorder.error) {
        setAiError(msg);
      }
      setStep("idle");
    }
  }, [recorder]);

  // Recording timer
  useEffect(() => {
    if (step !== "recording" && step !== "retry_recording") return;
    const t = setInterval(() => {
      setRecordElapsed(Math.round((Date.now() - recordStartRef.current) / 1000));
    }, 200);
    return () => clearInterval(t);
  }, [step]);

  // ── Recording → Review (Round 1) ──

  const handleStopRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    setStep("stopping");

    try {
      const asr = asrRef.current;
      const [audioBlob, finalTranscript] = await Promise.all([
        recorder.stop(),
        asr ? asr.stop() : Promise.resolve(""),
      ]);

      setR1SttProvider(asr?.name || "");
      setR1SttMode("realtime_websocket");
      setR1TranscriptSource(finalTranscript.trim() ? "aliyun_realtime" : "none");
      setR1SttSuccess(finalTranscript.trim().length >= MIN_TRANSCRIPT_LENGTH);

      setTranscript(finalTranscript);
      setEditedTranscript(finalTranscript);

      if (!isValidTranscript(finalTranscript)) {
        setStep("transcribing");
      } else {
        setStep("review");
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "停止录音失败");
      setStep("transcribing");
    } finally {
      stoppingRef.current = false;
    }
  }, [recorder]);

  // ── Review → Analyzing (V3: diagnosis only) ──

  const handleAnalyze = useCallback(async () => {
    if (!session) return;
    if (!isValidTranscript(editedTranscript)) {
      setAiError("转录文本无效，无法进行AI分析。请重新录音。");
      return;
    }

    setAnalyzing(true);
    setAiError(null);
    setStep("analyzing");

    // Upload audio
    let audioUrl = "";
    if (recorder.blob) {
      try {
        audioUrl = await uploadChineseAudio(sessionId, recorder.blob);
        setRound1AudioUrl(audioUrl);
      } catch {
        setAiError("音频上传失败，请重试");
        setStep("review");
        setAnalyzing(false);
        return;
      }
    }

    // Save Round 1 attempt (before AI to get the ID)
    let attemptId: string;
    try {
      const attempt = await createAttempt.mutateAsync({
        session_id: sessionId,
        attempt_round: 1,
        is_retry: false,
        audio_url: audioUrl,
        audio_duration: recorder.duration,
        transcript: editedTranscript,
        edited_transcript: editedTranscript,
        stt_provider: r1SttProvider,
        stt_mode: r1SttMode,
        transcript_source: r1TranscriptSource,
        stt_success: r1SttSuccess,
      });
      attemptId = attempt.id;
      setRound1AttemptId(attempt.id);
    } catch {
      setAiError("保存失败，请重试");
      setStep("review");
      setAnalyzing(false);
      return;
    }

    // V4 AI Analysis — skill-specific diagnosis (no full speech)
    const timeLimit = session.time_limit_seconds || 60;
    const result = await analyzeChineseExpression(
      session.topic,
      session.topic_type as ChineseTopicType | null,
      editedTranscript,
      1,
      recorder.duration || 60,
      timeLimit,
    );

    if (!result.success) {
      setAiError(result.error);
      setStep("review");
      setAnalyzing(false);
      return;
    }

    const d = result.data;
    setRound1Diagnosis(d.diagnosis);
    setRound1DeliveryMetrics(d.delivery_metrics);

    // Update attempt with V4 diagnosis (no reference data yet — saved on-demand via generate_reference)
    await updateAttempt.mutateAsync({
      id: attemptId,
      session_id: sessionId,
      updates: {
        scores: d.diagnosis.overall,
        diagnosis: d.diagnosis as unknown as Record<string, unknown>,
        answer_outline: d.diagnosis.answer_outline as unknown as Record<string, unknown>[],
        delivery_metrics: d.delivery_metrics,
        ai_prompt_version: `chinese-v4/${session.topic_type || "opinion"}@1`,
      },
    });

    setAnalyzing(false);
    setStep("result");
  }, [session, sessionId, recorder.blob, recorder.duration, editedTranscript, r1SttProvider, r1SttMode, r1TranscriptSource, r1SttSuccess, createAttempt, updateAttempt]);

  // ── Generate Reference (V3 — on-demand full speech) ──

  const handleGenerateReference = useCallback(async (round: 1 | 2) => {
    if (!session) return;
    const transcript = round === 1 ? editedTranscript : round2EditedTranscript;
    const diagnosis = round === 1 ? round1Diagnosis : round2Diagnosis;
    if (!transcript || !diagnosis) return;

    if (round === 1) {
      setRound1GeneratingReference(true);
      setRound1FullReferenceViewed(true);
      // Persist reference_viewed_before_retry immediately
      if (round1AttemptId) {
        markReferenceViewed.mutate(round1AttemptId);
      }
    }

    const result = await generateChineseReference(
      session.topic,
      transcript,
      diagnosis as unknown as Record<string, unknown>,
    );

    if (result.success) {
      if (round === 1) {
        setRound1Reference(result.data.reference);
        setRound1GeneratingReference(false);
        // Update attempt with reference data
        if (round1AttemptId) {
          await updateAttempt.mutateAsync({
            id: round1AttemptId,
            session_id: sessionId,
            updates: {
              final_improved_speech: result.data.reference.improved_speech,
              key_improvements: result.data.reference.key_upgrades as unknown as Record<string, unknown>[],
            },
          });
        }
      } else {
        setRound2Reference(result.data.reference);
      }
    } else {
      setAiError(result.error);
      if (round === 1) setRound1GeneratingReference(false);
    }
  }, [session, editedTranscript, round2EditedTranscript, round1Diagnosis, round2Diagnosis, round1AttemptId, sessionId, updateAttempt, markReferenceViewed]);

  // ── Results → Retry Recording ──

  const handleStartRetry = useCallback(async () => {
    if (!round1AttemptId) return;
    setAiError(null);
    stoppingRef.current = false;
    setRound2FullReferenceViewed(round1FullReferenceViewed);

    recorder.reset();
    asrRef.current?.reset();

    setStep("retry_recording");
    recordStartRef.current = Date.now();
    setRecordElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const asr = createAsr();

      await Promise.all([
        recorder.start(stream),
        asr.start(stream),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "启动失败";
      if (msg.includes("CHINESE_APP_KEY_NOT_CONFIGURED")) {
        setAiError("中文语音识别尚未配置。");
      }
      setStep("result");
    }
  }, [recorder, round1AttemptId]);

  // ── Retry Recording → Retry Review ──

  const handleStopRetry = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    setStep("retry_stopping");

    try {
      const asr = asrRef.current;
      const [audioBlob, finalTranscript] = await Promise.all([
        recorder.stop(),
        asr ? asr.stop() : Promise.resolve(""),
      ]);

      setR2SttProvider(asr?.name || "");
      setR2SttMode("realtime_websocket");
      setR2TranscriptSource(finalTranscript.trim() ? "aliyun_realtime" : "none");
      setR2SttSuccess(finalTranscript.trim().length >= MIN_TRANSCRIPT_LENGTH);

      setRound2Transcript(finalTranscript);
      setRound2EditedTranscript(finalTranscript);

      if (!isValidTranscript(finalTranscript)) {
        setAiError("第二次录音未获得有效转录。");
      }
      setStep("retry_review");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "停止录音失败");
      setStep("retry_review");
    } finally {
      stoppingRef.current = false;
    }
  }, [recorder]);

  // ── Retry Review → Retry Analyzing + Comparison ──

  const handleRetryAnalyze = useCallback(async () => {
    if (!session || !round1AttemptId) return;
    if (!isValidTranscript(round2EditedTranscript)) {
      setAiError("转录文本无效，无法进行AI分析。");
      return;
    }

    setAnalyzing(true);
    setAiError(null);
    setStep("retry_analyzing");

    let audioUrl = "";
    if (recorder.blob) {
      try {
        audioUrl = await uploadChineseAudio(sessionId, recorder.blob);
        setRound2AudioUrl(audioUrl);
      } catch {
        setAiError("音频上传失败");
        setStep("retry_review");
        setAnalyzing(false);
        return;
      }
    }

    // Save Round 2 attempt
    let attempt2Id = "";
    try {
      const attempt = await createAttempt.mutateAsync({
        session_id: sessionId,
        attempt_round: 2,
        is_retry: true,
        retry_of_attempt_id: round1AttemptId,
        audio_url: audioUrl,
        audio_duration: recorder.duration,
        transcript: round2EditedTranscript,
        edited_transcript: round2EditedTranscript,
        stt_provider: r2SttProvider,
        stt_mode: r2SttMode,
        transcript_source: r2TranscriptSource,
        stt_success: r2SttSuccess,
      });
      attempt2Id = attempt.id;
    } catch {
      setAiError("保存失败");
      setStep("retry_review");
      setAnalyzing(false);
      return;
    }

    // V3 AI Analysis Round 2 — diagnosis only
    const result = await analyzeChineseExpression(
      session.topic,
      session.topic_type as ChineseTopicType | null,
      round2EditedTranscript,
      2,
      recorder.duration || 60,
    );

    if (!result.success) {
      setAiError(result.error);
      setStep("retry_review");
      setAnalyzing(false);
      return;
    }

    const d = result.data;
    setRound2Diagnosis(d.diagnosis);
    setRound2DeliveryMetrics(d.delivery_metrics);

    if (attempt2Id) {
      await updateAttempt.mutateAsync({
        id: attempt2Id,
        session_id: sessionId,
        updates: {
          scores: d.diagnosis.overall,
          diagnosis: d.diagnosis as unknown as Record<string, unknown>,
          answer_outline: d.diagnosis.answer_outline as unknown as Record<string, unknown>[],
          delivery_metrics: d.delivery_metrics,
          ai_prompt_version: `chinese-v4/${session.topic_type || "opinion"}@1`,
        },
      });
    }

    // V2 AI Comparison (pass full diagnosis objects)
    const r1Scores = round1Diagnosis?.overall || null;
    const r2Scores = d.diagnosis?.overall || null;

    const compResult = await compareChineseRounds(
      session.topic,
      editedTranscript,
      round2EditedTranscript,
      r1Scores as unknown as Record<string, unknown> | null,
      r2Scores as unknown as Record<string, unknown> | null,
      round2FullReferenceViewed,
    );

    if (compResult.success) {
      setComparison(compResult.data);
    }

    setAnalyzing(false);
    setStep("comparing");
  }, [session, sessionId, recorder.blob, recorder.duration, round2EditedTranscript, editedTranscript, r2SttProvider, r2SttMode, r2TranscriptSource, r2SttSuccess, createAttempt, updateAttempt, round1AttemptId, round1Diagnosis, round2FullReferenceViewed]);

  // ── Helpers ──

  const topicTypeLabel = session?.topic_type
    ? TOPIC_TYPE_LABELS[session.topic_type as ChineseTopicType]
    : null;

  const frameworkLabel = round1Diagnosis?.recommended_structure?.name || null;

  // ── Loading state ──

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-sage-deep" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-16 space-y-3">
        <AlertTriangle size={32} className="opacity-30 mx-auto" />
        <p className="text-sm text-ink-lighter">未找到此练习记录</p>
        <button onClick={() => navigate("/chinese")} className="text-sm text-sage-deep font-medium underline">
          返回训练首页
        </button>
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/chinese")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div className="min-w-0">
          <p className="text-sm text-ink-lighter truncate">
            {topicTypeLabel || "表达训练"}
          </p>
          <h1 className="text-lg font-semibold truncate">{session.topic}</h1>
        </div>
      </header>

      {/* ── IDLE / PREP ── */}
      {(step === "idle" || step === "preparing") && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="text-center mb-6">
            <p className="text-sm text-ink-lighter mb-2">话题</p>
            <p className="text-xl font-semibold text-ink">{session.topic}</p>
          </div>

          {step === "preparing" ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 size={36} className="animate-spin text-sage-deep" />
              <p className="text-sm text-ink-lighter">正在准备语音识别...</p>
            </div>
          ) : (
            <PrepCountdown seconds={30} onSkip={handlePrepDone} />
          )}

          {aiError && (
            <div className="mt-4 bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 text-xs text-accent-rose flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {recorder.error && (
            <div className="mt-4 bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-2 text-xs text-accent-rose flex items-center gap-2">
              <AlertTriangle size={12} />
              {recorder.error}
            </div>
          )}
        </div>
      )}

      {/* ── RECORDING ── */}
      {(step === "recording" || step === "stopping" || step === "retry_recording" || step === "retry_stopping") && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
          {(step === "retry_recording" || step === "retry_stopping") && (
            <div className="bg-sage-light/10 border border-sage-light/30 rounded-xl p-3 text-xs text-sage-deep">
              重新表达 — 根据 AI 建议改进你的表达
            </div>
          )}

          {/* V2 Reference display for retry — skeleton default, full answer collapsed */}
          {(step === "retry_recording") && retryRefMode !== "hidden" && round1Diagnosis && (
            <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-700">AI 优化参考</span>
                <div className="flex gap-1">
                  {(["structure", "full", "hidden"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setRetryRefMode(mode);
                        if (mode === "full") setRound2FullReferenceViewed(true);
                      }}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full transition-colors",
                        retryRefMode === mode ? "bg-purple-200 text-purple-800" : "text-purple-500",
                      )}
                    >
                      {mode === "structure" ? "只看框架" : mode === "full" ? "完整参考" : "隐藏"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Always show framework + skeleton in structure mode */}
              <div className="space-y-2">
                {frameworkLabel && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-purple-500 font-medium">推荐框架：</span>
                    <span className="text-[11px] text-purple-700 font-medium">{frameworkLabel}</span>
                    {round1Diagnosis.recommended_structure.steps.length > 0 && (
                      <span className="text-[10px] text-purple-400">
                        （{round1Diagnosis.recommended_structure.steps.join(" → ")}）
                      </span>
                    )}
                  </div>
                )}

                {/* Answer outline skeleton (V4) */}
                {round1Diagnosis.answer_outline && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-purple-500 font-medium">答案骨架</p>
                    {round1Diagnosis.answer_outline.map((s) => (
                      <div key={s.step} className="flex gap-2 text-[11px]">
                        <span className="text-purple-600 font-medium shrink-0">{s.step}. {s.label}</span>
                        <span className="text-purple-500/80">{s.guidance}</span>
                        <span className="text-purple-400 text-[10px]">~{s.target_seconds}s</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Self-questions from diagnosis (V3: top-level) */}
                {round1Diagnosis.self_questions && round1Diagnosis.self_questions.length > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-purple-500 font-medium">自我提问</p>
                    {round1Diagnosis.self_questions.map((q, i) => (
                      <p key={i} className="text-[10px] text-purple-600/70 italic">&ldquo;{q}&rdquo;</p>
                    ))}
                  </div>
                )}

                {/* Key upgrades from diagnosis (V4: key_upgrades) */}
                {round1Diagnosis.key_upgrades && round1Diagnosis.key_upgrades.length > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-purple-500 font-medium">关键提升点</p>
                    {round1Diagnosis.key_upgrades.slice(0, 3).map((ku, i) => (
                      <p key={i} className="text-[10px] text-purple-600/80">{ku.title}: {ku.original} → {ku.direction}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Full answer — collapsed by default (V4: from reference or generate on-demand) */}
              {(round1Reference?.improved_speech || round1Diagnosis.recommended_structure) && (
                <div className="pt-2 border-t border-purple-100">
                  {retryRefMode === "full" && round1Reference?.improved_speech ? (
                    <div>
                      <p className="text-[11px] text-purple-800 leading-relaxed">{round1Reference.improved_speech}</p>
                      <p className="text-[9px] text-purple-400 mt-1">AI 优化参考，仅用于学习结构与思路，不代表唯一正确答案。</p>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        setRetryRefMode("full");
                        setRound2FullReferenceViewed(true);
                        if (!round1Reference) {
                          await handleGenerateReference(1);
                        }
                      }}
                      className="text-[10px] text-purple-500 underline hover:text-purple-700"
                    >
                      查看完整参考答案
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-ink-lighter mb-1">一分钟表达</p>
            <p className="text-sm text-ink font-medium">{session.topic}</p>
          </div>

          <RecordingTimer elapsed={recordElapsed} limit={session.time_limit_seconds} onStop={() => {
            if (step === "retry_recording") handleStopRetry();
            else if (step === "recording") handleStopRecording();
          }} />

          {asrInterim && (
            <div className="bg-ink/[0.02] rounded-xl p-3 max-h-24 overflow-y-auto">
              <p className="text-xs text-ink-lighter/70">{asrInterim}</p>
            </div>
          )}

          {recorder.error && (
            <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-2 text-xs text-accent-rose flex items-center gap-2">
              <AlertTriangle size={12} />
              {recorder.error}
            </div>
          )}

          {aiError && (
            <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-2 text-xs text-accent-rose flex items-center gap-2">
              <AlertTriangle size={12} />
              {aiError}
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => {
                if (step === "retry_recording") handleStopRetry();
                else handleStopRecording();
              }}
              disabled={step === "stopping" || step === "retry_stopping"}
              className="h-14 w-14 rounded-full bg-accent-rose text-white flex items-center justify-center hover:bg-accent-rose/90 transition-colors disabled:opacity-50"
            >
              {step === "stopping" || step === "retry_stopping" ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <Square size={22} />
              )}
            </button>
            <span className="text-xs text-ink-lighter">
              {step === "stopping" || step === "retry_stopping" ? "正在停止..." : "点击停止录音"}
            </span>
          </div>
        </div>
      )}

      {/* ── TRANSCRIBING ── */}
      {step === "transcribing" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="text-center py-6 space-y-3">
            <Volume2 size={36} className="opacity-30 mx-auto" />
            <p className="text-sm font-medium text-ink">未获得有效转录</p>
            <p className="text-xs text-ink-lighter">
              录音已保存，但语音识别未能生成有效文本。请重新录音或检查网络连接。
            </p>
          </div>

          {aiError && (
            <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 text-xs text-accent-rose flex items-center gap-2">
              <AlertTriangle size={14} />
              {aiError}
            </div>
          )}

          {recorder.audioUrl && (
            <div className="flex items-center gap-2 justify-center">
              <audio controls src={recorder.audioUrl} className="h-8 max-w-[220px]" />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                recorder.reset();
                asrRef.current?.reset();
                stoppingRef.current = false;
                setStep("idle");
                setAiError(null);
              }}
              className="flex-1 border border-border rounded-xl py-2 text-sm text-ink-light"
            >
              重新录音
            </button>
            <button
              onClick={() => {
                setStep("review");
                setTranscript("");
                setEditedTranscript("");
              }}
              className="flex-1 bg-ink/5 rounded-xl py-2 text-sm text-ink-light"
            >
              手动输入文本
            </button>
          </div>
        </div>
      )}

      {/* ── REVIEW ── */}
      {(step === "review" || step === "retry_review") && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-ink">
                {step === "retry_review" ? "你的第二次表达 · 转录" : "你的第一次表达 · 转录"}
              </p>
              {recorder.audioUrl && (
                <audio controls src={recorder.audioUrl} className="h-8 max-w-[180px]" />
              )}
            </div>

            {(step === "review" ? r1SttProvider : r2SttProvider) && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-ink-lighter/70">
                  {(step === "review" ? r1SttProvider : r2SttProvider)}
                </span>
                {(step === "review" ? r1SttSuccess : r2SttSuccess) ? (
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">识别成功</span>
                ) : (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">识别未完成</span>
                )}
              </div>
            )}

            <textarea
              className="w-full bg-transparent border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50 resize-none"
              rows={6}
              value={step === "retry_review" ? round2EditedTranscript : editedTranscript}
              onChange={(e) => {
                if (step === "retry_review") setRound2EditedTranscript(e.target.value);
                else setEditedTranscript(e.target.value);
              }}
            />
            <p className="text-[10px] text-ink-lighter mt-1">你可以编辑修正转录中的识别错误</p>
          </div>

          {aiError && (
            <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 text-xs text-accent-rose flex items-center gap-2">
              <AlertTriangle size={14} />
              {aiError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                recorder.reset();
                asrRef.current?.reset();
                stoppingRef.current = false;
                if (step === "retry_review") {
                  setStep("retry_recording");
                } else {
                  setStep("idle");
                }
                setAiError(null);
              }}
              className="flex-1 border border-border rounded-xl py-2 text-sm text-ink-light"
            >
              重新录音
            </button>
            <button
              onClick={step === "retry_review" ? handleRetryAnalyze : handleAnalyze}
              disabled={analyzing || !(step === "retry_review" ? round2EditedTranscript : editedTranscript).trim()}
              className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {analyzing ? <><Loader2 size={14} className="animate-spin" /> 分析中</> : <><Sparkles size={14} /> AI 分析</>}
            </button>
          </div>
        </div>
      )}

      {/* ── ANALYZING ── */}
      {(step === "analyzing" || step === "retry_analyzing") && (
        <div className="bg-card rounded-2xl border border-border p-8 flex flex-col items-center justify-center space-y-4">
          <Loader2 size={36} className="animate-spin text-sage-deep" />
          <p className="text-sm font-medium text-ink">AI 正在分析你的表达...</p>
          <div className="flex gap-3 text-[11px] text-ink-lighter">
            <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500" /> 思辨诊断</span>
            <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> 结构推荐</span>
          </div>
          {aiError && (
            <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 text-xs text-accent-rose">
              {aiError}
            </div>
          )}
        </div>
      )}

      {/* ── V2 RESULT ── */}
      {step === "result" && round1Diagnosis && (
        <div className="space-y-4">
          {/* Score card (V4) */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">你的第一次表达</p>
                <p className="text-[11px] text-ink-lighter">{round1Diagnosis.overall.summary}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-sage-light flex items-center justify-center">
                <span className="text-xl font-bold text-sage-deep">{round1Diagnosis.overall.score}</span>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-border/50">
              {round1Diagnosis.dimensions.map((dim) => (
                <V4DimensionBar key={dim.key} data={dim} />
              ))}
            </div>
          </div>

          {/* Top issues (V4) */}
          {round1Diagnosis.top_issues && round1Diagnosis.top_issues.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-accent-rose" />
                <p className="text-sm font-medium text-ink">关键问题</p>
              </div>
              {round1Diagnosis.top_issues.map((issue, i) => (
                <div key={i} className="bg-accent-rose/[0.03] border border-accent-rose/10 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      issue.severity === "high" ? "bg-accent-rose/10 text-accent-rose"
                        : issue.severity === "medium" ? "bg-amber-100 text-amber-700"
                        : "bg-ink/5 text-ink-light",
                    )}>
                      {issue.severity === "high" ? "严重" : issue.severity === "medium" ? "中等" : "轻微"}
                    </span>
                    <span className="text-sm font-medium text-ink">{issue.title}</span>
                  </div>
                  {issue.evidence_quote && (
                    <p className="text-[11px] text-ink-lighter italic">&ldquo;{issue.evidence_quote}&rdquo;</p>
                  )}
                  <p className="text-[11px] text-ink-lighter">{issue.why_it_matters}</p>
                  <p className="text-[11px] text-sage-deep">{issue.action}</p>
                </div>
              ))}
            </div>
          )}

          {/* Thinking or Deepening (V4) */}
          {round1Diagnosis.thinking_or_deepening && round1Diagnosis.thinking_or_deepening.items.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-purple-600" />
                <p className="text-sm font-medium text-ink">{round1Diagnosis.thinking_or_deepening.title}</p>
              </div>
              {round1Diagnosis.thinking_or_deepening.items.map((item, i) => (
                <div key={i} className="bg-purple-50/50 rounded-lg p-2.5 space-y-1">
                  <p className="text-[11px] font-medium text-purple-700">{item.lens}</p>
                  <p className="text-[11px] text-ink-light">{item.insight}</p>
                  <p className="text-[10px] text-purple-500">{item.application}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recommended structure (V4) */}
          {round1Diagnosis.recommended_structure && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-purple-600" />
                <p className="text-sm font-medium text-ink">推荐结构</p>
              </div>
              <div className="inline-flex px-2.5 py-1 bg-purple-100 rounded-full">
                <span className="text-xs font-medium text-purple-700">{frameworkLabel}</span>
              </div>
              <p className="text-xs text-ink-lighter">{round1Diagnosis.recommended_structure.reason}</p>
              {round1Diagnosis.recommended_structure.steps.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {round1Diagnosis.recommended_structure.steps.map((step) => (
                    <span key={step} className="text-[10px] bg-purple-50 text-purple-600 rounded-full px-2 py-0.5">{step}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Answer outline — V4 format */}
          {round1Diagnosis.answer_outline && round1Diagnosis.answer_outline.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <p className="text-sm font-medium text-ink">答案骨架</p>
              <div className="space-y-2">
                {round1Diagnosis.answer_outline.map((s) => (
                  <div key={s.step} className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-sage-light flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-sage-deep">{s.step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{s.label}</p>
                      <p className="text-[11px] text-ink-lighter">{s.guidance}</p>
                      <p className="text-[10px] text-ink-lighter/70">约 {s.target_seconds} 秒</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI 优化参考 — V3: on-demand reference */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-sage-deep" />
              <p className="text-sm font-medium text-ink">AI 优化参考</p>
            </div>
            <p className="text-[10px] text-ink-lighter/70 -mt-1">
              仅用于学习结构与思路，不代表唯一正确答案。
            </p>

            {round1Reference ? (
              round1Reference.integrity_failed ? (
                <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3">
                  <p className="text-xs text-accent-rose flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    本次优化检测到虚构内容，已自动跳过。请查看答案骨架和关键提升点。
                  </p>
                </div>
              ) : (
                <>
                  <details className="group">
                    <summary className="text-sm text-ink leading-relaxed cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <span className="line-clamp-2">{round1Reference.improved_speech}</span>
                      <span className="text-[11px] text-sage-deep font-medium mt-1 inline-block">
                        <ChevronDown size={14} className="inline mr-1 group-open:hidden" />
                        <ChevronUp size={14} className="hidden mr-1 group-open:inline" />
                        展开完整参考
                      </span>
                    </summary>
                    <p className="text-sm text-ink leading-relaxed mt-2 pt-2 border-t border-border/50">
                      {round1Reference.improved_speech}
                    </p>
                  </details>

                  {round1Reference.thought_features && round1Reference.thought_features.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-border/50">
                      <p className="text-xs font-medium text-ink">思辨特征</p>
                      {round1Reference.thought_features.map((tf, i) => (
                        <div key={i} className="text-[11px]">
                          <span className="text-purple-600 font-medium">{tf.type}</span>
                          <span className="text-ink-lighter"> — {tf.purpose}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            ) : (
              <button
                onClick={() => handleGenerateReference(1)}
                disabled={round1GeneratingReference}
                className="w-full bg-purple-50 border border-purple-100 rounded-xl py-2.5 text-sm text-purple-700 font-medium flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors disabled:opacity-50"
              >
                {round1GeneratingReference ? (
                  <><Loader2 size={14} className="animate-spin" /> 正在生成参考...</>
                ) : (
                  <><Sparkles size={14} /> 查看完整参考答案</>
                )}
              </button>
            )}
          </div>

          {/* Key upgrades — V4: from diagnosis.key_upgrades, or reference.key_upgrades if loaded */}
          {((round1Diagnosis.key_upgrades && round1Diagnosis.key_upgrades.length > 0) ||
            (round1Reference?.key_upgrades && round1Reference.key_upgrades.length > 0)) && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
              <p className="text-sm font-medium text-ink">关键提升点</p>
              {round1Reference?.key_upgrades
                ? round1Reference.key_upgrades.map((ku, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-xs text-sage-deep font-bold shrink-0">{i + 1}.</span>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-ink">{ku.title}</p>
                        <p className="text-[10px] text-ink-lighter">
                          <span className="text-accent-rose/70">原：「{ku.original}」</span>
                          {" → "}
                          <span className="text-emerald-600/70">改：「{ku.direction}」</span>
                        </p>
                        <p className="text-[10px] text-ink-lighter/70">{ku.reason}</p>
                      </div>
                    </div>
                  ))
                : round1Diagnosis.key_upgrades.map((ku, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-xs text-sage-deep font-bold shrink-0">{i + 1}.</span>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-ink">{ku.title}</p>
                        <p className="text-[10px] text-ink-lighter">
                          <span className="text-accent-rose/70">原：「{ku.original}」</span>
                          {" → "}
                          <span className="text-emerald-600/70">改：「{ku.direction}」</span>
                        </p>
                        <p className="text-[10px] text-ink-lighter/70">{ku.reason}</p>
                      </div>
                    </div>
                  ))}
            </div>
          )}

          {/* Delivery metrics */}
          {round1DeliveryMetrics && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-sm font-medium text-ink mb-2">口语呈现</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-ink-lighter">语速</span><span className="text-ink text-right">{round1DeliveryMetrics.pace_wpm} 字/分钟</span>
                <span className="text-ink-lighter">停顿次数</span><span className="text-ink text-right">{round1DeliveryMetrics.pause_count}</span>
                <span className="text-ink-lighter">口头禅</span><span className="text-ink text-right">{round1DeliveryMetrics.filler_word_count} 次</span>
                <span className="text-ink-lighter">字数</span><span className="text-ink text-right">{round1DeliveryMetrics.word_count} 字</span>
              </div>
              {round1DeliveryMetrics.filler_words.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {round1DeliveryMetrics.filler_words.map((w, i) => (
                    <span key={i} className="text-[10px] bg-ink/5 text-ink-light rounded-full px-2 py-0.5">{w}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fact consistency (V4) */}
          {round1Diagnosis.fact_consistency && (
            <div className={cn(
              "rounded-xl p-3 text-xs",
              round1Diagnosis.fact_consistency.status === "needs_confirmation"
                ? "bg-amber-50 border border-amber-100 text-amber-700"
                : round1Diagnosis.fact_consistency.status === "not_applicable"
                ? "bg-ink/5 border border-border text-ink-light"
                : "bg-emerald-50/50 border border-emerald-100 text-emerald-700",
            )}>
              <span className="flex items-center gap-1.5">
                {round1Diagnosis.fact_consistency.status === "needs_confirmation"
                  ? <><AlertTriangle size={12} /> {round1Diagnosis.fact_consistency.message}</>
                  : round1Diagnosis.fact_consistency.status === "not_applicable"
                  ? <><CheckCircle2 size={12} /> {round1Diagnosis.fact_consistency.message}</>
                  : <><CheckCircle2 size={12} /> {round1Diagnosis.fact_consistency.message || "事实一致性保护 — AI未新增关键事实"}</>
                }
              </span>
            </div>
          )}

          {/* Re-express button */}
          <button
            onClick={handleStartRetry}
            disabled={!round1AttemptId}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RotateCcw size={16} />
            按这个结构重新讲一次
          </button>
        </div>
      )}

      {/* ── V2 COMPARING (Round 2 results) ── */}
      {step === "comparing" && (
        <div className="space-y-4">
          {/* Comparison header */}
          <div className="bg-gradient-to-r from-sage-light/5 to-purple-50/50 border border-sage-light/30 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-medium text-ink">前后对比</p>

            {/* Score comparison */}
            {round1Diagnosis && round2Diagnosis && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/60 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-ink-lighter mb-1">你的第一次表达</p>
                  <p className="text-xl font-bold text-ink">{round1Diagnosis.overall.score}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-ink-lighter mb-1">你的第二次表达</p>
                  <p className={cn(
                    "text-xl font-bold",
                    round2Diagnosis.overall.score > round1Diagnosis.overall.score ? "text-emerald-600"
                      : round2Diagnosis.overall.score < round1Diagnosis.overall.score ? "text-accent-rose"
                      : "text-sage-deep",
                  )}>
                    {round2Diagnosis.overall.score}
                  </p>
                </div>
              </div>
            )}

            {/* AI comparison with evidence — V2 */}
            {comparison && (
              <div className="space-y-3">
                {/* Dimension changes with explanations */}
                {comparison.dimension_changes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-ink">各维度变化</p>
                    {comparison.dimension_changes.map((dc, i) => (
                      <div key={i} className="bg-white/50 rounded-lg p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-ink">{dc.dimension}</span>
                          <span className="text-[11px] text-ink-light">
                            {dc.round1_score} → {dc.round2_score}
                            <span className={cn(
                              "ml-1 font-medium",
                              dc.delta > 0 ? "text-emerald-600" : dc.delta < 0 ? "text-accent-rose" : "text-ink-lighter",
                            )}>
                              {dc.delta > 0 ? `+${dc.delta}` : dc.delta}
                            </span>
                          </span>
                        </div>
                        <p className="text-[10px] text-ink-lighter">{dc.explanation}</p>
                        {dc.round1_evidence && (
                          <p className="text-[9px] text-ink-lighter/60 italic">第一次：「{dc.round1_evidence}」</p>
                        )}
                        {dc.round2_evidence && (
                          <p className="text-[9px] text-ink-lighter/60 italic">第二次：「{dc.round2_evidence}」</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Progress points */}
                {comparison.progress_points.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-emerald-700">进步点</p>
                    {comparison.progress_points.map((pp, i) => (
                      <div key={i} className="flex gap-1.5 text-[11px]">
                        <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-medium text-ink">{pp.area}</span>
                          <span className="text-ink-lighter"> — {pp.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Remaining issues */}
                {comparison.remaining_issues.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-amber-700">待改进</p>
                    {comparison.remaining_issues.map((ri, i) => (
                      <div key={i} className="flex gap-1.5 text-[11px]">
                        <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-medium text-ink">{ri.area}</span>
                          <span className="text-ink-lighter"> — {ri.detail}</span>
                          {ri.suggestion && (
                            <p className="text-[10px] text-sage-deep mt-0.5">{ri.suggestion}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reference dependency */}
                {comparison.reference_dependency && (
                  <div className="bg-purple-50/50 rounded-lg p-2 text-[10px] text-purple-700">
                    {comparison.reference_dependency.interpretation}
                  </div>
                )}
              </div>
            )}

            {/* Fallback: simple dimension comparison if AI comparison failed (V4) */}
            {!comparison && round1Diagnosis && round2Diagnosis && (
              <div className="space-y-1.5">
                {round1Diagnosis.dimensions.map((d1) => {
                  const d2 = round2Diagnosis.dimensions.find((d) => d.key === d1.key);
                  const delta = d2 ? d2.score - d1.score : 0;
                  return (
                    <div key={d1.key} className="flex items-center gap-2">
                      <span className="text-[10px] text-ink-lighter w-20 shrink-0">{d1.label}</span>
                      <span className="text-[10px] font-mono w-5 text-right">{d1.score}</span>
                      <div className="flex-1 h-1 bg-ink/8 rounded-full overflow-hidden">
                        <div className="h-full bg-sage-deep/40 rounded-full" style={{ width: `${(d1.score / d1.max_score) * 100}%` }} />
                      </div>
                      {d2 && (
                        <>
                          <span className="text-[10px] font-mono w-5 text-right font-medium text-sage-deep">{d2.score}</span>
                          <span className={cn(
                            "text-[10px] w-6 text-right font-medium",
                            delta > 0 ? "text-emerald-600" : delta < 0 ? "text-accent-rose" : "text-ink-lighter",
                          )}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Round 2 improved speech (V3 reference) */}
          {round2Reference?.improved_speech && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-sage-deep" />
                <p className="text-sm font-medium text-ink">你的第二次表达 · AI 参考</p>
              </div>
              <p className="text-sm text-ink leading-relaxed">{round2Reference.improved_speech}</p>
              {round2Reference.thought_features && round2Reference.thought_features.length > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1">
                  {round2Reference.thought_features.map((tf, i) => (
                    <div key={i} className="text-[11px]">
                      <span className="text-purple-600 font-medium">{tf.type}</span>
                      <span className="text-ink-lighter"> — {tf.purpose}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Audio comparison */}
          {(round1AudioUrl || round2AudioUrl) && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
              <p className="text-sm font-medium text-ink">录音对比</p>
              {round1AudioUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-lighter w-14">第一次</span>
                  <audio controls src={round1AudioUrl} className="h-8 flex-1 max-w-[220px]" />
                </div>
              )}
              {round2AudioUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-lighter w-14">第二次</span>
                  <audio controls src={round2AudioUrl} className="h-8 flex-1 max-w-[220px]" />
                </div>
              )}
            </div>
          )}

          {/* Delivery comparison */}
          {round1DeliveryMetrics && round2DeliveryMetrics && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-sm font-medium text-ink mb-2">口语呈现对比</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-lighter">语速</span>
                  <span>{round1DeliveryMetrics.pace_wpm} → <span className="font-medium text-sage-deep">{round2DeliveryMetrics.pace_wpm}</span> 字/分</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-lighter">口头禅</span>
                  <span>{round1DeliveryMetrics.filler_word_count} → <span className={cn("font-medium", round2DeliveryMetrics.filler_word_count < round1DeliveryMetrics.filler_word_count ? "text-emerald-600" : "text-accent-rose")}>{round2DeliveryMetrics.filler_word_count}</span> 次</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-lighter">字数</span>
                  <span>{round1DeliveryMetrics.word_count} → <span className="font-medium text-sage-deep">{round2DeliveryMetrics.word_count}</span> 字</span>
                </div>
              </div>
            </div>
          )}

          {/* Done */}
          <button
            onClick={() => navigate("/chinese/history")}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={16} />
            完成练习
          </button>
        </div>
      )}

      {/* ── SAVE ERROR ── */}
      {step === "save_error" && (
        <div className="text-center py-12 space-y-4">
          <div className="h-16 w-16 rounded-full bg-accent-rose/10 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} className="text-accent-rose" />
          </div>
          <p className="text-lg font-semibold text-ink">保存出错</p>
          <p className="text-sm text-ink-lighter">{aiError || "保存失败，请检查网络后重试"}</p>
          <button
            onClick={() => navigate("/chinese")}
            className="rounded-xl bg-sage-light text-sage-deep px-4 py-2 text-sm font-semibold"
          >
            返回主页
          </button>
        </div>
      )}
    </div>
  );
}
