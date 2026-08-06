// ============================================
// Nancy OS — Browser Web Speech API Provider
// ============================================

import type { SpeechProvider } from "../types";

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

const win = window as unknown as Record<string, unknown>;
const SpeechRecognitionAPI: (new () => SpeechRecognition) | undefined =
  (win.SpeechRecognition as new () => SpeechRecognition) ||
  (win.webkitSpeechRecognition as new () => SpeechRecognition) ||
  undefined;

export class BrowserSpeechProvider implements SpeechProvider {
  readonly name = "browser";
  readonly supported = !!SpeechRecognitionAPI;

  transcript = "";
  interim = "";
  isListening = false;
  error: string | null = null;

  private recognition: SpeechRecognition | null = null;
  private finalTranscript = "";
  private _onTranscriptUpdate: ((text: string) => void) | null = null;
  private _onInterimUpdate: ((text: string) => void) | null = null;
  private _onStateChange: (() => void) | null = null;

  set onTranscriptUpdate(cb: ((text: string) => void) | null) { this._onTranscriptUpdate = cb; }
  set onInterimUpdate(cb: ((text: string) => void) | null) { this._onInterimUpdate = cb; }
  set onStateChange(cb: (() => void) | null) { this._onStateChange = cb; }

  async start(_stream?: MediaStream): Promise<void> {
    const API = SpeechRecognitionAPI;
    if (!API) {
      this.error = "您的浏览器不支持语音识别。请使用 Chrome 或 Edge 浏览器。";
      return;
    }

    this.error = null;
    this.transcript = "";
    this.interim = "";
    this.finalTranscript = "";

    const recognition: SpeechRecognition = new API();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          this.finalTranscript += result[0].transcript + " ";
        } else {
          interimText += result[0].transcript;
        }
      }
      this.transcript = this.finalTranscript.trim();
      this.interim = interimText;
      this._onTranscriptUpdate?.(this.transcript);
      this._onInterimUpdate?.(this.interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") return;
      if (event.error === "aborted") return;
      this.error = `语音识别错误: ${event.error}`;
      this.isListening = false;
      this._onStateChange?.();
    };

    recognition.onend = () => {
      this.isListening = false;
      if (this.finalTranscript.trim()) {
        this.transcript = this.finalTranscript.trim();
        this._onTranscriptUpdate?.(this.transcript);
      }
      this._onStateChange?.();
    };

    this.recognition = recognition;
    recognition.start();
    this.isListening = true;
  }

  async stop(): Promise<string> {
    this.recognition?.stop();
    this.recognition = null;
    this.isListening = false;
    return this.transcript;
  }

  reset(): void {
    this.recognition?.stop();
    this.recognition = null;
    this.transcript = "";
    this.interim = "";
    this.isListening = false;
    this.error = null;
    this.finalTranscript = "";
  }
}
