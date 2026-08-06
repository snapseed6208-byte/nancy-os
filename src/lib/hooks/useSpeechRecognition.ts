import { useState, useRef, useCallback, useEffect } from "react";
import { createSpeechProvider } from "@/lib/speech/speechService";
import type { SpeechProvider } from "@/lib/speech/types";

/**
 * Unified speech recognition hook.
 *
 * Streaming providers (browser, aliyun-realtime):
 *   start(stream) → transcript updates during recording → stop() returns final transcript.
 *
 * Batch providers (aliyun file-based, whisper):
 *   start() → setAudioBlob(blob) → stop() processes blob → returns transcript.
 *
 * @param providerFactory — Optional custom provider factory (e.g. for Chinese STT).
 *   When omitted, defaults to the English provider chain.
 */
export function useSpeechRecognition(providerFactory?: () => SpeechProvider) {
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // STT debug metadata
  const [fallbackTriggered, setFallbackTriggered] = useState(false);
  const transcriptGeneratedAt = useRef<number | null>(null);

  const providerRef = useRef<SpeechProvider | null>(null);

  // Lazy-init provider once
  if (!providerRef.current) {
    const p = providerFactory ? providerFactory() : createSpeechProvider();
    providerRef.current = p;

    p.onTranscriptUpdate = (text: string) => {
      setTranscript(text);
      if (text && !transcriptGeneratedAt.current) {
        transcriptGeneratedAt.current = Date.now();
      }
    };
    p.onInterimUpdate = (text: string) => setInterim(text);
    p.onStateChange = () => {
      setIsListening(p.isListening);
      setTranscript(p.transcript);
      setInterim(p.interim);
      setError(p.error);
    };
  }

  const provider = providerRef.current;

  // Derive recognition mode from provider name
  const recognitionMode: "realtime_websocket" | "batch_upload" | "browser_builtin" =
    provider.name === "aliyun-realtime" || provider.name === "aliyun-chinese-realtime" ? "realtime_websocket" :
    provider.name === "aliyun" ? "batch_upload" :
    "browser_builtin";

  // Realtime providers stream via WebSocket — no setAudioBlob
  const isRealtimeProvider =
    provider.name === "aliyun-realtime" || provider.name === "aliyun-chinese-realtime";

  useEffect(() => {
    return () => {
      providerRef.current?.reset();
    };
  }, []);

  const start = useCallback(async (stream?: MediaStream) => {
    setError(null);
    setTranscript("");
    setInterim("");
    setIsProcessing(false);
    await provider.start(stream);
    setIsListening(provider.isListening);
    setError(provider.error);
  }, [provider]);

  /**
   * Stop recognition and return the final transcript string.
   * For streaming providers: flushes remaining audio, waits for final results.
   * For batch providers: processes the audio blob through the ASR service.
   */
  const stop = useCallback(async (audioBlob?: Blob): Promise<string> => {
    let finalTranscript = "";

    // Batch providers need the blob set before stop()
    if (audioBlob && "setAudioBlob" in provider) {
      (provider as SpeechProvider & { setAudioBlob(b: Blob): void }).setAudioBlob(audioBlob);
      setIsProcessing(true);
      finalTranscript = await provider.stop();
      setIsProcessing(false);
    } else {
      finalTranscript = await provider.stop();
    }

    setIsListening(provider.isListening);
    setTranscript(provider.transcript);
    setInterim(provider.interim);
    setError(provider.error);

    return finalTranscript;
  }, [provider]);

  const reset = useCallback(() => {
    provider.reset();
    setTranscript("");
    setInterim("");
    setIsListening(false);
    setIsProcessing(false);
    setError(null);
    setFallbackTriggered(false);
    transcriptGeneratedAt.current = null;
  }, [provider]);

  /** Called when batch fallback is triggered — marks the attempt as fallback */
  const markFallback = useCallback(() => {
    setFallbackTriggered(true);
  }, []);

  return {
    start,
    stop,
    reset,
    transcript,
    setTranscript,
    interim,
    isListening,
    isProcessing,
    error,
    supported: provider.supported,
    // STT debug metadata
    providerName: provider.name,
    recognitionMode,
    isRealtimeProvider,
    fallbackTriggered,
    transcriptGeneratedAt: transcriptGeneratedAt.current,
    markFallback,
    /** Exposed for providers that need a session ID for Storage upload. */
    setSessionId: (id: string) => {
      if ("setSessionId" in provider) {
        (provider as { setSessionId(id: string): void }).setSessionId(id);
      }
    },
  };
}
