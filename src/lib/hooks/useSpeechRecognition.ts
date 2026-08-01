import { useState, useRef, useCallback, useEffect } from "react";
import { createSpeechProvider } from "@/lib/speech/speechService";
import type { SpeechProvider } from "@/lib/speech/types";

/**
 * Unified speech recognition hook.
 * Delegates to the configured ASR provider (browser / aliyun / openai-whisper).
 *
 * For cloud ASR providers (aliyun, whisper), the audio blob from MediaRecorder
 * is needed. Call `stop(audioBlob)` — the provider that needs it will process;
 * the browser provider ignores blob.
 *
 * `isProcessing` is true while a cloud provider is uploading + transcribing.
 * Wait for it to become false before navigating away from the transcript step.
 */
export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerRef = useRef<SpeechProvider | null>(null);

  // Lazy-init provider once
  if (!providerRef.current) {
    const p = createSpeechProvider();
    providerRef.current = p;

    p.onTranscriptUpdate = (text: string) => setTranscript(text);
    p.onStateChange = () => {
      setIsListening(p.isListening);
      setTranscript(p.transcript);
      setInterim(p.interim);
      setError(p.error);
    };
  }

  const provider = providerRef.current;

  useEffect(() => {
    return () => {
      providerRef.current?.reset();
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    setInterim("");
    setIsProcessing(false);
    await provider.start();
    setIsListening(provider.isListening);
    setError(provider.error);
  }, [provider]);

  const stop = useCallback(async (audioBlob?: Blob) => {
    if (provider.name !== "browser" && audioBlob) {
      setIsProcessing(true);
      await provider.stop(audioBlob);
      setIsProcessing(false);
    } else {
      await provider.stop(audioBlob);
    }
    // Sync all state back from provider
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
  }, [provider]);

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
    /** Exposed for Aliyun provider: set the session ID used for Storage upload. */
    setSessionId: (id: string) => {
      if ("setSessionId" in provider) {
        (provider as { setSessionId(id: string): void }).setSessionId(id);
      }
    },
  };
}
