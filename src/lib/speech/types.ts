// ============================================
// Nancy OS — Speech Provider Abstraction
// Pluggable ASR backends: browser, aliyun-realtime, aliyun, whisper
// ============================================

export interface SpeechProvider {
  readonly name: string;
  readonly supported: boolean;

  /**
   * Begin recognition session.
   * Browser: starts SpeechRecognition (acquires mic internally).
   * Cloud realtime: accepts optional MediaStream for PCM capture + WebSocket.
   * Cloud batch: no-op (MediaRecorder handles recording separately).
   */
  start(stream?: MediaStream): Promise<void>;

  /**
   * End recognition session and finalize transcript.
   * Browser: stops SpeechRecognition.
   * Cloud realtime: closes WebSocket, disconnects AudioContext.
   * Cloud batch: uploads audio blob → Edge Function → ASR.
   */
  stop(): Promise<void>;

  /** Hard reset: abort any ongoing session, clear transcript & error. */
  reset(): void;

  /** Accumulated final sentences (SentenceEnd events for realtime). */
  transcript: string;

  /** Current partial recognition result (TranscriptionResultChanged). */
  interim: string;

  isListening: boolean;
  error: string | null;

  // Callbacks (set by hook, called by provider)
  onTranscriptUpdate: ((text: string) => void) | null;
  onInterimUpdate: ((text: string) => void) | null;
  onStateChange: (() => void) | null;
}

export type SpeechProviderType = "browser" | "aliyun-realtime" | "aliyun" | "openai-whisper";
