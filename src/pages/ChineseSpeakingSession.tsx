import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Mic, Square, Play, Pause, Loader2, CheckCircle2,
  AlertTriangle, Sparkles, Lightbulb, ChevronRight, RotateCcw,
  Eye, EyeOff, Target, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioRecorder } from "@/lib/hooks/useAudioRecorder";
import {
  useChineseSpeakingSession,
  useCreateChineseSpeakingAttempt,
  useUpdateChineseSpeakingAttempt,
  uploadChineseAudio,
  analyzeChineseExpression,
  TOPIC_TYPE_LABELS,
  FRAMEWORK_LABELS,
  type ChineseTopicType,
  type ChineseFramework,
  type AttemptScores,
  type AttemptDiagnosis,
  type OutlineStep,
  type KeyImprovement,
  type DeliveryMetrics,
} from "@/lib/hooks/useChineseSpeaking";

// ── Step type ──

type Step =
  | "prep"
  | "recording"
  | "review"
  | "analyzing"
  | "results"
  | "retry_recording"
  | "retry_review"
  | "retry_analyzing"
  | "retry_results"
  | "saved";

// ── Prep Countdown ──

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

// ── Recording Timer ──

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

// ── Score bar for results ──

function DimensionBar({ name, score, maxScore, comment, quotes }: {
  name: string; score: number; maxScore: number; comment: string; quotes?: string[];
}) {
  const pct = (score / maxScore) * 100;
  const color =
    pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-sage-deep/60" : pct >= 40 ? "bg-amber-400" : "bg-accent-rose/60";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink">{name}</span>
        <span className="text-xs font-mono text-ink-light">{score}/{maxScore}</span>
      </div>
      <div className="h-1.5 bg-ink/8 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-ink-lighter leading-relaxed">{comment}</p>
      {quotes && quotes.length > 0 && (
        <p className="text-[10px] text-ink-lighter/70 italic">
          &ldquo;{quotes[0]}&rdquo;
        </p>
      )}
    </div>
  );
}

// ── Main Page ──

export default function ChineseSpeakingSession() {
  const [, params] = useRoute("/chinese/session/:id");
  const [, navigate] = useLocation();
  const sessionId = params?.id || "";

  const { data: session, isLoading: sessionLoading } = useChineseSpeakingSession(sessionId);
  const createAttempt = useCreateChineseSpeakingAttempt();
  const updateAttempt = useUpdateChineseSpeakingAttempt();

  const recorder = useAudioRecorder();

  const [step, setStep] = useState<Step>("prep");
  const [transcript, setTranscript] = useState("");
  const [editedTranscript, setEditedTranscript] = useState("");

  // AI results state (Round 1)
  const [round1Scores, setRound1Scores] = useState<AttemptScores | null>(null);
  const [round1Diagnosis, setRound1Diagnosis] = useState<AttemptDiagnosis | null>(null);
  const [round1Outline, setRound1Outline] = useState<OutlineStep[] | null>(null);
  const [round1ImprovedSpeech, setRound1ImprovedSpeech] = useState<string | null>(null);
  const [round1KeyImprovements, setRound1KeyImprovements] = useState<KeyImprovement[] | null>(null);
  const [round1DeliveryMetrics, setRound1DeliveryMetrics] = useState<DeliveryMetrics | null>(null);
  const [round1AttemptId, setRound1AttemptId] = useState<string | null>(null);
  const [round1AudioUrl, setRound1AudioUrl] = useState<string | null>(null);
  const [round1Transcript, setRound1Transcript] = useState("");

  // Round 2
  const [retryRefMode, setRetryRefMode] = useState<"structure" | "full" | "hidden">("structure");
  const [round2Transcript, setRound2Transcript] = useState("");
  const [round2EditedTranscript, setRound2EditedTranscript] = useState("");
  const [round2Scores, setRound2Scores] = useState<AttemptScores | null>(null);
  const [round2Diagnosis, setRound2Diagnosis] = useState<AttemptDiagnosis | null>(null);
  const [round2ImprovedSpeech, setRound2ImprovedSpeech] = useState<string | null>(null);
  const [round2DeliveryMetrics, setRound2DeliveryMetrics] = useState<DeliveryMetrics | null>(null);
  const [round2AudioUrl, setRound2AudioUrl] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Timer ref for recording
  const recordStartRef = useRef(0);
  const [recordElapsed, setRecordElapsed] = useState(0);

  // ── Prep → Recording ──

  const handlePrepDone = useCallback(async () => {
    setStep("recording");
    recordStartRef.current = Date.now();
    setRecordElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder.start(stream);
    } catch {
      // Mic error handled by recorder hook
      setStep("prep");
    }
  }, [recorder]);

  // Recording timer
  useEffect(() => {
    if (step !== "recording") return;
    const t = setInterval(() => {
      setRecordElapsed(Math.round((Date.now() - recordStartRef.current) / 1000));
    }, 200);
    return () => clearInterval(t);
  }, [step]);

  // ── Recording → Review ──

  const handleStopRecording = useCallback(async () => {
    recorder.stop();
    // For now, use a placeholder transcript until STT is integrated in Stage 3
    const placeholder = "（转录功能将在 Stage 3 集成中文语音识别后启用。您的录音已保存。）";
    setTranscript(placeholder);
    setEditedTranscript(placeholder);
    setStep("review");
  }, [recorder]);

  // ── Review → Analyzing ──

  const handleAnalyze = useCallback(async () => {
    if (!session) return;
    setAnalyzing(true);
    setAiError(null);
    setStep("analyzing");

    // Upload audio first
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

    // Save Round 1 attempt
    try {
      const attempt = await createAttempt.mutateAsync({
        session_id: sessionId,
        attempt_round: 1,
        is_retry: false,
        audio_url: audioUrl,
        audio_duration: recorder.duration,
        transcript: editedTranscript,
        edited_transcript: editedTranscript,
      });
      setRound1AttemptId(attempt.id);
    } catch {
      setAiError("保存失败，请重试");
      setStep("review");
      setAnalyzing(false);
      return;
    }

    // AI Analysis
    const result = await analyzeChineseExpression(
      session.topic,
      session.topic_type as ChineseTopicType | null,
      editedTranscript,
      1,
    );

    if (!result.success) {
      setAiError(result.error);
      setStep("review");
      setAnalyzing(false);
      return;
    }

    const d = result.data;
    setRound1Scores(d.scores);
    setRound1Diagnosis(d.diagnosis);
    setRound1Outline(d.answer_outline);
    setRound1ImprovedSpeech(d.final_improved_speech);
    setRound1KeyImprovements(d.key_improvements);
    setRound1DeliveryMetrics(d.delivery_metrics);
    setRound1Transcript(editedTranscript);

    // Update attempt with AI results
    if (round1AttemptId) {
      await updateAttempt.mutateAsync({
        id: round1AttemptId,
        session_id: sessionId,
        updates: {
          scores: d.scores,
          diagnosis: d.diagnosis,
          answer_outline: d.answer_outline,
          final_improved_speech: d.final_improved_speech,
          key_improvements: d.key_improvements,
          delivery_metrics: d.delivery_metrics,
        },
      });
    }

    setAnalyzing(false);
    setStep("results");
  }, [session, sessionId, recorder.blob, recorder.duration, editedTranscript, createAttempt, updateAttempt, round1AttemptId]);

  // ── Results → Retry Recording ──

  const handleStartRetry = useCallback(async () => {
    if (!round1AttemptId) return;
    setAiError(null);
    recorder.reset();
    setStep("retry_recording");
    recordStartRef.current = Date.now();
    setRecordElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder.start(stream);
    } catch {
      setStep("results");
    }
  }, [recorder, round1AttemptId]);

  // ── Retry Recording → Retry Review ──

  const handleStopRetry = useCallback(async () => {
    recorder.stop();
    const placeholder = "（转录功能将在 Stage 3 集成后启用）";
    setRound2Transcript(placeholder);
    setRound2EditedTranscript(placeholder);
    setStep("retry_review");
  }, [recorder]);

  // ── Retry Review → Retry Analyzing ──

  const handleRetryAnalyze = useCallback(async () => {
    if (!session) return;
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
        retry_of_attempt_id: round1AttemptId || undefined,
        audio_url: audioUrl,
        audio_duration: recorder.duration,
        transcript: round2EditedTranscript,
        edited_transcript: round2EditedTranscript,
      });
      attempt2Id = attempt.id;
    } catch {
      setAiError("保存失败");
      setStep("retry_review");
      setAnalyzing(false);
      return;
    }

    // AI Analysis Round 2
    const result = await analyzeChineseExpression(
      session.topic,
      session.topic_type as ChineseTopicType | null,
      round2EditedTranscript,
      2,
    );

    if (!result.success) {
      setAiError(result.error);
      setStep("retry_review");
      setAnalyzing(false);
      return;
    }

    const d = result.data;
    setRound2Scores(d.scores);
    setRound2Diagnosis(d.diagnosis);
    setRound2ImprovedSpeech(d.final_improved_speech);
    setRound2DeliveryMetrics(d.delivery_metrics);

    if (attempt2Id) {
      await updateAttempt.mutateAsync({
        id: attempt2Id,
        session_id: sessionId,
        updates: {
          scores: d.scores,
          diagnosis: d.diagnosis,
          answer_outline: d.answer_outline,
          final_improved_speech: d.final_improved_speech,
          key_improvements: d.key_improvements,
          delivery_metrics: d.delivery_metrics,
        },
      });
    }

    setAnalyzing(false);
    setStep("retry_results");
  }, [session, sessionId, recorder.blob, recorder.duration, round2EditedTranscript, createAttempt, updateAttempt, round1AttemptId]);

  // ── Helpers ──

  const topicTypeLabel = session?.topic_type
    ? TOPIC_TYPE_LABELS[session.topic_type as ChineseTopicType]
    : null;

  const frameworkLabel = round1Diagnosis?.recommended_framework
    ? FRAMEWORK_LABELS[round1Diagnosis.recommended_framework as ChineseFramework]
    : null;

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

      {/* ── PREP ── */}
      {step === "prep" && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="text-center mb-6">
            <p className="text-sm text-ink-lighter mb-2">话题</p>
            <p className="text-xl font-semibold text-ink">{session.topic}</p>
          </div>
          <PrepCountdown seconds={30} onSkip={handlePrepDone} />
        </div>
      )}

      {/* ── RECORDING ── */}
      {(step === "recording" || step === "retry_recording") && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
          {(step === "retry_recording") && (
            <div className="bg-sage-light/10 border border-sage-light/30 rounded-xl p-3 text-xs text-sage-deep">
              重新表达 — 根据 AI 建议改进你的表达
            </div>
          )}

          {/* Reference display for retry */}
          {(step === "retry_recording") && retryRefMode !== "hidden" && (
            <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-700">参考内容</span>
                <div className="flex gap-1">
                  {(["structure", "full", "hidden"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setRetryRefMode(mode)}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full transition-colors",
                        retryRefMode === mode ? "bg-purple-200 text-purple-800" : "text-purple-500",
                      )}
                    >
                      {mode === "structure" ? "框架" : mode === "full" ? "完整" : "隐藏"}
                    </button>
                  ))}
                </div>
              </div>
              {round1Outline && (
                <div className="space-y-1">
                  <p className="text-[10px] text-purple-500 font-medium">推荐框架：{frameworkLabel}</p>
                  {round1Outline.map((s) => (
                    <div key={s.step} className="flex gap-2 text-[11px]">
                      <span className="text-purple-600 font-medium shrink-0">{s.step}. {s.label}</span>
                      <span className="text-purple-500/80">{s.guidance}</span>
                    </div>
                  ))}
                </div>
              )}
              {retryRefMode === "full" && round1ImprovedSpeech && (
                <div className="mt-2 pt-2 border-t border-purple-100">
                  <p className="text-[10px] text-purple-500 font-medium mb-1">参考表达</p>
                  <p className="text-[11px] text-purple-800 leading-relaxed">{round1ImprovedSpeech}</p>
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
            else handleStopRecording();
          }} />

          {recorder.error && (
            <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-2 text-xs text-accent-rose flex items-center gap-2">
              <AlertTriangle size={12} />
              {recorder.error}
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => {
                if (step === "retry_recording") handleStopRetry();
                else handleStopRecording();
              }}
              className="h-14 w-14 rounded-full bg-accent-rose text-white flex items-center justify-center hover:bg-accent-rose/90 transition-colors"
            >
              <Square size={22} />
            </button>
            <span className="text-xs text-ink-lighter">点击停止录音</span>
          </div>
        </div>
      )}

      {/* ── REVIEW ── */}
      {(step === "review" || step === "retry_review") && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-ink">
                {step === "retry_review" ? "第二次表达 · 转录" : "录音转录"}
              </p>
              {recorder.audioUrl && (
                <audio controls src={recorder.audioUrl} className="h-8 max-w-[180px]" />
              )}
            </div>
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
                setStep("recording");
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
            <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500" /> 转录分析</span>
            <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> 结构评估</span>
            <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> 生成建议</span>
          </div>
          {aiError && (
            <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 text-xs text-accent-rose">
              {aiError}
            </div>
          )}
        </div>
      )}

      {/* ── RESULTS ── */}
      {step === "results" && (
        <div className="space-y-4">
          {/* Score card */}
          {round1Scores && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">总分</p>
                  <p className="text-[11px] text-ink-lighter">{round1Scores.verdict}</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-sage-light flex items-center justify-center">
                  <span className="text-xl font-bold text-sage-deep">{round1Scores.total}</span>
                </div>
              </div>

              {/* Dimensions */}
              <div className="space-y-3 pt-2 border-t border-border/50">
                {round1Scores.dimensions.map((dim) => (
                  <DimensionBar key={dim.name} {...dim} maxScore={dim.max_score} />
                ))}
              </div>
            </div>
          )}

          {/* Diagnosis */}
          {round1Diagnosis && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-accent-rose" />
                <p className="text-sm font-medium text-ink">三个关键问题</p>
              </div>
              {round1Diagnosis.top_3_problems.map((p, i) => (
                <div key={i} className="bg-accent-rose/[0.03] border border-accent-rose/10 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      p.severity === "high" ? "bg-accent-rose/10 text-accent-rose"
                        : p.severity === "medium" ? "bg-amber-100 text-amber-700"
                        : "bg-ink/5 text-ink-light",
                    )}>
                      {p.severity === "high" ? "严重" : p.severity === "medium" ? "中等" : "轻微"}
                    </span>
                    <span className="text-sm font-medium text-ink">{p.problem}</span>
                  </div>
                  {p.example && <p className="text-[11px] text-ink-lighter italic">&ldquo;{p.example}&rdquo;</p>}
                  <p className="text-[11px] text-sage-deep">{p.suggestion}</p>
                </div>
              ))}
            </div>
          )}

          {/* Framework */}
          {round1Diagnosis && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-purple-600" />
                <p className="text-sm font-medium text-ink">推荐结构</p>
              </div>
              <div className="inline-flex px-2.5 py-1 bg-purple-100 rounded-full">
                <span className="text-xs font-medium text-purple-700">{frameworkLabel}</span>
              </div>
              <p className="text-xs text-ink-lighter">{round1Diagnosis.framework_reason}</p>
            </div>
          )}

          {/* Answer outline */}
          {round1Outline && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <p className="text-sm font-medium text-ink">答案骨架</p>
              <div className="space-y-2">
                {round1Outline.map((s) => (
                  <div key={s.step} className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-sage-light flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-sage-deep">{s.step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{s.label}</p>
                      <p className="text-[11px] text-ink-lighter">{s.guidance}</p>
                      <p className="text-[10px] text-ink-lighter/70">约 {s.time_hint_seconds} 秒</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Improved Speech */}
          {round1ImprovedSpeech && (
            <div className="bg-gradient-to-br from-sage-light/10 to-white border border-sage-light/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-sage-deep" />
                <p className="text-sm font-medium text-ink">优化表达（仅供参考）</p>
              </div>
              <p className="text-sm text-ink leading-relaxed">{round1ImprovedSpeech}</p>
            </div>
          )}

          {/* Key Improvements */}
          {round1KeyImprovements && round1KeyImprovements.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
              <p className="text-sm font-medium text-ink">关键提升点</p>
              {round1KeyImprovements.map((ki, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-xs text-sage-deep font-bold shrink-0">{i + 1}.</span>
                  <div>
                    <p className="text-xs font-medium text-ink">{ki.title}</p>
                    <p className="text-[11px] text-ink-lighter">{ki.description}</p>
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

          {/* Re-express button */}
          <button
            onClick={handleStartRetry}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            按这个结构重新讲一次
          </button>
        </div>
      )}

      {/* ── RETRY RESULTS ── */}
      {step === "retry_results" && (
        <div className="space-y-4">
          {/* Comparison header */}
          <div className="bg-gradient-to-r from-sage-light/5 to-purple-50/50 border border-sage-light/30 rounded-2xl p-4">
            <p className="text-sm font-medium text-ink mb-3">前后对比</p>

            {/* Score comparison */}
            {round1Scores && round2Scores && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white/60 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-ink-lighter mb-1">第一次</p>
                  <p className="text-xl font-bold text-ink">{round1Scores.total}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-ink-lighter mb-1">第二次</p>
                  <p className="text-xl font-bold text-sage-deep">{round2Scores.total}</p>
                </div>
              </div>
            )}

            {/* Dimension comparison */}
            {round1Scores && round2Scores && (
              <div className="space-y-1.5">
                {round1Scores.dimensions.map((d1, i) => {
                  const d2 = round2Scores?.dimensions[i];
                  const delta = d2 ? d2.score - d1.score : 0;
                  return (
                    <div key={d1.name} className="flex items-center gap-2">
                      <span className="text-[10px] text-ink-lighter w-16 shrink-0">{d1.name}</span>
                      <span className="text-[10px] font-mono w-6 text-right">{d1.score}</span>
                      <div className="flex-1 h-1 bg-ink/8 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sage-deep/40 rounded-full"
                          style={{ width: `${(d1.score / d1.max_score) * 100}%` }}
                        />
                      </div>
                      {d2 && (
                        <>
                          <span className="text-[10px] font-mono w-6 text-right font-medium text-sage-deep">{d2.score}</span>
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

          {/* Round 2 improved speech */}
          {round2ImprovedSpeech && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-sage-deep" />
                <p className="text-sm font-medium text-ink">第二次优化表达</p>
              </div>
              <p className="text-sm text-ink leading-relaxed">{round2ImprovedSpeech}</p>
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
              {round1AudioUrl && !round2AudioUrl && recorder.audioUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-lighter w-14">第二次</span>
                  <audio controls src={recorder.audioUrl} className="h-8 flex-1 max-w-[220px]" />
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
            onClick={() => setStep("saved")}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={16} />
            完成练习
          </button>
        </div>
      )}

      {/* ── SAVED ── */}
      {step === "saved" && (
        <div className="text-center py-12 space-y-4">
          <div className="h-16 w-16 rounded-full bg-sage-light flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} className="text-sage-deep" />
          </div>
          <p className="text-lg font-semibold text-ink">练习完成</p>
          <p className="text-sm text-ink-lighter">两轮表达已保存</p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => navigate("/chinese/history")}
              className="rounded-xl border border-border px-4 py-2 text-sm text-ink-light"
            >
              查看历史
            </button>
            <button
              onClick={() => navigate("/chinese")}
              className="rounded-xl bg-sage-light text-sage-deep px-4 py-2 text-sm font-semibold"
            >
              再来一次
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
