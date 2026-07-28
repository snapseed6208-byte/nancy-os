import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Mic, MicOff, Square, Plus, ChevronRight, Sparkles,
  Loader2, CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  useSpeakingSessions, useCreateSpeakingSession, useCreateSpeakingAttempt, uploadAudio,
} from "@/lib/hooks/useEnglish";
import {
  analyzeSpeaking, buildCombinedFeedback,
} from "@/lib/ai/englishCoach";
import type { SpeakingFeedback } from "@/lib/ai/englishCoach";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const PROMPTS = [
  "Describe your typical morning routine.",
  "What's your favorite book and why?",
  "Tell me about a memorable trip you took.",
  "What are your career goals for the next 5 years?",
  "Describe a challenge you recently overcame.",
  "What does a healthy lifestyle mean to you?",
  "Tell me about someone who inspires you.",
  "What's the best advice you've ever received?",
  "Describe your ideal weekend.",
  "What skill are you currently learning?",
];

// ── Audio Recorder Hook ──

function useAudioRecorder() {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startTime = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mr.start();
      setState("recording");
      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTime.current) / 1000));
      }, 200);
    } catch {
      setError("无法访问麦克风。请在浏览器设置中允许麦克风访问权限。");
      setState("idle");
    }
  }, []);

  const stop = useCallback(() => {
    mediaRecorder.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setBlob(null);
    setDuration(0);
    setState("idle");
  }, [audioUrl]);

  return { state, audioUrl, blob, duration, error, start, stop, reset };
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

// ── Page ──

export default function EnglishSpeaking() {
  const [, navigate] = useLocation();
  const { data: sessions, isLoading } = useSpeakingSessions();
  const createSession = useCreateSpeakingSession();
  const createAttempt = useCreateSpeakingAttempt();

  const [showNew, setShowNew] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [context, setContext] = useState("");
  const [step, setStep] = useState<"setup" | "record" | "analyze" | "saved">("setup");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const recorder = useAudioRecorder();

  // ── AI analysis state ──
  const [transcript, setTranscript] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);

  const finalPrompt = prompt || customPrompt || PROMPTS[0];

  const handleStartSession = async () => {
    const result = await createSession.mutateAsync({
      prompt: finalPrompt,
      context: context || undefined,
    });
    setSessionId(result.id as string);
    setStep("record");
  };

  const handleAnalyze = async () => {
    const text = transcript.trim() || `[Audio response to: ${finalPrompt}]`;
    setAnalyzing(true);
    setAiError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("请先登录");
      const result = await analyzeSpeaking(finalPrompt, text, [], session.access_token);
      setFeedback(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI 分析失败，请稍后重试");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!sessionId) return;
    setUploading(true);

    let audioUrl = "";
    if (recorder.blob) {
      try {
        audioUrl = await uploadAudio(sessionId, recorder.blob);
      } catch {
        // Continue without audio URL
      }
    }

    const combined = feedback
      ? buildCombinedFeedback(feedback)
      : "AI 反馈将在 Phase 7 接入后生成。当前为占位记录。";

    await createAttempt.mutateAsync({
      session_id: sessionId,
      answer: transcript || `[Voice recording on: ${finalPrompt}]`,
      transcribed_text: transcript || null,
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
    });

    setUploading(false);
    setStep("saved");
  };

  const handleNew = () => {
    setShowNew(true);
    setStep("setup");
    setPrompt("");
    setCustomPrompt("");
    setContext("");
    setSessionId(null);
    setTranscript("");
    setFeedback(null);
    setAiError(null);
    recorder.reset();
  };

  const handleBack = () => {
    if (showNew) {
      setShowNew(false);
      setStep("setup");
      recorder.reset();
      setFeedback(null);
      setAiError(null);
    } else {
      navigate("/english");
    }
  };

  // ── Session list view ──
  if (!showNew) {
    return (
      <div className="space-y-4">
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
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 bg-sage-light text-sage-deep rounded-xl px-3 py-2 text-sm font-medium"
          >
            <Plus size={16} />
            新练习
          </button>
        </header>

        {isLoading && <div className="text-center py-12 text-sm text-ink-lighter">加载中...</div>}

        {!isLoading && (!sessions || sessions.length === 0) && (
          <div className="text-center py-12">
            <Mic size={40} className="text-ink-lighter mx-auto mb-3" />
            <p className="text-sm text-ink-light">还没有口语练习记录</p>
            <p className="text-xs text-ink-lighter mt-1">点击「新练习」开始你的第一次口语训练</p>
          </div>
        )}

        <div className="space-y-2">
          {sessions?.map((s) => (
            <button
              key={s.id as string}
              className="w-full bg-card rounded-2xl border border-border p-4 text-left hover:border-sage-light/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{(s.prompt as string).slice(0, 60)}</p>
                  <p className="text-xs text-ink-lighter mt-1">
                    {new Date(s.created_at as string).toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <ChevronRight size={14} className="text-ink-lighter shrink-0 ml-2" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── New session flow ──
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={handleBack} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div>
          <p className="text-sm text-ink-lighter">English OS</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
            {step === "saved" ? "练习完成" : "新练习"}
          </h1>
        </div>
      </header>

      {/* Step 1: Setup */}
      {step === "setup" && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-light mb-2 block">选择话题</label>
            <div className="grid grid-cols-2 gap-2">
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setPrompt(prompt === p ? "" : p); setCustomPrompt(""); }}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs text-left transition-colors",
                    prompt === p
                      ? "border-sage-light bg-sage-light/30 text-sage-deep"
                      : "border-border text-ink-light hover:border-sage-light/50",
                  )}
                >
                  {p.slice(0, 40)}...
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-ink-light mb-1 block">或自定义话题</label>
            <textarea
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light resize-none"
              rows={2}
              placeholder="输入你想练习的话题..."
              value={customPrompt}
              onChange={(e) => { setCustomPrompt(e.target.value); setPrompt(""); }}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-ink-light mb-1 block">场景说明 (可选)</label>
            <input
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
              placeholder="e.g., 模拟雅思口语 Part 2"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>

          <button
            onClick={handleStartSession}
            disabled={createSession.isPending || (!prompt && !customPrompt)}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {createSession.isPending ? "创建中..." : "开始录音"}
          </button>
        </div>
      )}

      {/* Step 2: Record */}
      {step === "record" && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-xs text-ink-lighter mb-1">话题</p>
            <p className="text-sm font-medium text-ink">{finalPrompt}</p>
          </div>

          <div className="bg-card rounded-2xl border border-sage-light/50 p-6 text-center space-y-4">
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center mx-auto transition-all",
              recorder.state === "recording" ? "bg-accent-rose/10 animate-pulse" : "bg-ink/5",
            )}>
              {recorder.state === "recording" ? (
                <Mic size={28} className="text-accent-rose" />
              ) : recorder.state === "done" ? (
                <CheckCircle2 size={28} className="text-sage-deep" />
              ) : (
                <MicOff size={28} className="text-ink-lighter" />
              )}
            </div>

            <div>
              {recorder.state === "idle" && (
                <p className="text-sm text-ink-light">点击下方按钮开始录音</p>
              )}
              {recorder.state === "recording" && (
                <p className="text-sm font-semibold text-accent-rose">正在录音... {recorder.duration}秒</p>
              )}
              {recorder.state === "done" && (
                <p className="text-sm text-sage-deep font-medium">录音完成 ({recorder.duration}秒)</p>
              )}
            </div>

            {recorder.error && (
              <p className="text-xs text-accent-rose">{recorder.error}</p>
            )}

            <div className="flex items-center justify-center gap-3">
              {recorder.state === "idle" && (
                <button
                  onClick={recorder.start}
                  className="bg-accent-rose/10 text-accent-rose rounded-full h-12 w-12 flex items-center justify-center"
                >
                  <Mic size={20} />
                </button>
              )}
              {recorder.state === "recording" && (
                <button
                  onClick={recorder.stop}
                  className="bg-accent-rose/20 text-accent-rose rounded-full h-12 w-12 flex items-center justify-center"
                >
                  <Square size={18} />
                </button>
              )}
              {recorder.state === "done" && (
                <>
                  <button
                    onClick={recorder.reset}
                    className="bg-ink/5 text-ink-light rounded-full h-10 w-10 flex items-center justify-center"
                  >
                    <MicOff size={16} />
                  </button>
                  {recorder.audioUrl && (
                    <audio controls src={recorder.audioUrl} className="h-10 max-w-[180px]" />
                  )}
                </>
              )}
            </div>
          </div>

          {recorder.state === "done" && (
            <button
              onClick={() => setStep("analyze")}
              className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold"
            >
              下一步：AI 分析
            </button>
          )}
        </div>
      )}

      {/* Step 3: Analyze */}
      {step === "analyze" && (
        <div className="space-y-4">
          {/* Audio playback */}
          {recorder.audioUrl && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-ink-lighter mb-2">你的录音</p>
              <audio controls src={recorder.audioUrl} className="w-full h-10" />
            </div>
          )}

          {/* Transcript input */}
          <div>
            <label className="text-xs font-medium text-ink-light mb-1 block">
              转录你的回答 (可选 — 不填则 AI 仅根据话题给出建议)
            </label>
            <textarea
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light resize-none"
              rows={4}
              placeholder="输入你说的话，AI 会给出针对性反馈..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </div>

          {/* Analyze button */}
          {!feedback && (
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
          )}

          {/* AI Error */}
          {aiError && (
            <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-accent-rose shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-accent-rose">AI 分析暂不可用</p>
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

          {/* AI Feedback Results */}
          {feedback && (
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

              {/* One better example */}
              {feedback.oneBetterExample && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-xs font-medium text-ink-light mb-2">参考范例</p>
                  <div className="text-xs text-ink leading-relaxed whitespace-pre-line">
                    {feedback.oneBetterExample}
                  </div>
                </div>
              )}

              {/* Re-analyze button */}
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full bg-ink/5 text-ink-light rounded-xl py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    重新分析中...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    重新分析
                  </>
                )}
              </button>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={uploading}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {uploading ? "保存中..." : "保存练习记录"}
          </button>

          {/* Skip AI hint */}
          {!feedback && !analyzing && !aiError && (
            <p className="text-xs text-ink-lighter text-center">
              也可以直接保存，AI 反馈可在之后补充
            </p>
          )}
        </div>
      )}

      {/* Step 4: Saved */}
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
          <div className="flex gap-3">
            <button
              onClick={handleNew}
              className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold"
            >
              再练一次
            </button>
            <button
              onClick={() => { setShowNew(false); }}
              className="flex-1 bg-ink/5 text-ink-light rounded-xl py-2.5 text-sm font-medium"
            >
              返回列表
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
