// ============================================
// Nancy OS — Speech Provider Abstraction
// Pluggable ASR backends: browser, aliyun, whisper
// ============================================

export interface SpeechProvider {
  readonly name: string;
  readonly supported: boolean;

  /** Begin recognition session. Browser: starts SpeechRecognition. Cloud: no-op (MediaRecorder handles recording). */
  start(): Promise<void>;

  /**
   * End recognition session and finalize transcript.
   * Browser: stops SpeechRecognition (sync in practice, wrapped as Promise).
   * Cloud: uploads audio blob → Edge Function → ASR → transcript.
   * @param audioBlob — the recorded audio blob (required for cloud providers, ignored by browser)
   */
  stop(audioBlob?: Blob): Promise<void>;

  /** Hard reset: abort any ongoing session, clear transcript & error. */
  reset(): void;

  // State (mutated by provider, read by hook)
  transcript: string;
  interim: string;
  isListening: boolean;
  error: string | null;

  // Callbacks (set by hook, called by provider)
  onTranscriptUpdate: ((text: string) => void) | null;
  onStateChange: (() => void) | null;
}

export type SpeechProviderType = "browser" | "aliyun" | "openai-whisper";
