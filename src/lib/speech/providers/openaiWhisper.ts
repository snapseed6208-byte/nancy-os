// ============================================
// Nancy OS — OpenAI Whisper ASR Provider (stub)
// Not yet implemented. Reserved for future use.
// ============================================

import type { SpeechProvider } from "../types";

export class OpenAIWhisperProvider implements SpeechProvider {
  readonly name = "openai-whisper";
  readonly supported = true;

  transcript = "";
  interim = "";
  isListening = false;
  error: string | null = null;

  private _onTranscriptUpdate: ((text: string) => void) | null = null;
  private _onStateChange: (() => void) | null = null;

  set onTranscriptUpdate(cb: ((text: string) => void) | null) {
    this._onTranscriptUpdate = cb;
  }

  set onStateChange(cb: (() => void) | null) {
    this._onStateChange = cb;
  }

  async start(): Promise<void> {
    this.error = null;
    this.isListening = true;
  }

  async stop(_audioBlob?: Blob): Promise<void> {
    this.isListening = false;
    this.error = "OpenAI Whisper provider is not yet implemented.";
  }

  reset(): void {
    this.transcript = "";
    this.interim = "";
    this.isListening = false;
    this.error = null;
  }
}
