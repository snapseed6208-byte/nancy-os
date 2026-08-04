import { useState, useRef, useCallback, useEffect } from "react";
import { createSpeechProvider } from "@/lib/speech/speechService";
import type { SpeechProvider } from "@/lib/speech/types";

/**
 * Unified speech recognition hook.
 *
 * Streaming providers (browser, aliyun-realtime):
 *   start(stream) → transcript updates during recording → stop() finalizes.
 *
 * Batch providers (aliyun file-based, whisper):
 *   start() → setAudioBlob(blob) → stop() processes blob → transcript.
 */
export function useSpeechRecognition() {
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
    const p = createSpeechProvider();
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
    provider.name === "aliyun-realtime" ? "realtime_websocket" :
    provider.name === "aliyun" ? "batch_upload" :
    "browser_builtin";

  // Realtime providers (aliyun-realtime) stream via WebSocket — no setAudioBlob
  const isRealtimeProvider = provider.name === "aliyun-realtime";

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

  const stop = useCallback(async (audioBlob?: Blob) => {
    // Batch providers need the blob set before stop()
    if (audioBlob && "setAudioBlob" in provider) {
      (provider as SpeechProvider & { setAudioBlob(b: Blob): void }).setAudioBlob(audioBlob);
      setIsProcessing(true);
      await provider.stop();
      setIsProcessing(false);
    } else {
      await provider.stop();
    }
    setIsListening(provider.isListening);
    setTranscript(provider.transcript);
    setInterim(provider.interim);
    setError(provider.error);
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
