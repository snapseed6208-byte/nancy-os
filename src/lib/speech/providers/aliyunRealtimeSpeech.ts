// ============================================
// Nancy OS — Aliyun Real-time ASR Provider
// Flow: AudioContext+AudioWorklet → PCM → WebSocket → Aliyun NLS
// Browser connects directly to Aliyun WebSocket; Edge Function only for token.
//
// Shared PCM pipeline for English and Chinese — language is determined
// by the Aliyun project/appkey, not by this provider.
// ============================================

import type { SpeechProvider } from "../types";
import { supabase } from "@/lib/supabase";

const WS_URL = "wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1";
const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aliyun-token`;

// ── Config ──

interface AliyunRealtimeConfig {
  tokenLanguage: "english" | "chinese";
  providerId: string;
}

const DEFAULT_CONFIG: AliyunRealtimeConfig = {
  tokenLanguage: "english",
  providerId: "aliyun-realtime",
};

// ── AudioWorklet processor (inline, loaded via Blob URL) ──

const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      this.port.postMessage(input[0], [input[0].buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

let workletBlobUrl: string | null = null;

function getWorkletUrl(): string {
  if (!workletBlobUrl) {
    workletBlobUrl = URL.createObjectURL(
      new Blob([WORKLET_CODE], { type: "application/javascript" }),
    );
  }
  return workletBlobUrl;
}

// ── Helpers ──

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

// ── WebSocket message types ──

interface WsMessage {
  header: {
    message_id: string;
    task_id: string;
    namespace: string;
    name: string;
    appkey?: string;
    status?: number;
    status_message?: string;
  };
  payload: Record<string, unknown>;
  context?: Record<string, unknown>;
}

interface TokenResponse {
  token?: string;
  error?: string;
  appkey?: string;
  appKeySource?: string;
}

// ── Provider ──

export class AliyunRealtimeSpeechProvider implements SpeechProvider {
  readonly supported = typeof AudioContext !== "undefined" && typeof WebSocket !== "undefined";

  transcript = "";
  interim = "";
  isListening = false;
  error: string | null = null;

  private config: AliyunRealtimeConfig;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private taskId = "";
  private appkey = "";
  private appKeySource = "unknown";
  private finalTranscript = "";
  private wsReady = false;
  private stopped = false;
  private latestRecognizedText = "";
  private sentenceCount = 0;
  private finalTranscriptSource: "sentence_end" | "interim_cache" | "batch_fallback" | "none" = "none";

  private _onTranscriptUpdate: ((text: string) => void) | null = null;
  private _onInterimUpdate: ((text: string) => void) | null = null;
  private _onStateChange: (() => void) | null = null;

  constructor(config?: Partial<AliyunRealtimeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get name(): string { return this.config.providerId; }

  set onTranscriptUpdate(cb: ((text: string) => void) | null) { this._onTranscriptUpdate = cb; }
  set onInterimUpdate(cb: ((text: string) => void) | null) { this._onInterimUpdate = cb; }
  set onStateChange(cb: (() => void) | null) { this._onStateChange = cb; }

  async start(stream?: MediaStream): Promise<void> {
    if (!stream) {
      this.error = "需要麦克风权限才能使用实时语音识别";
      return;
    }

    this.error = null;
    this.transcript = "";
    this.interim = "";
    this.finalTranscript = "";
    this.stopped = false;
    this.wsReady = false;
    this.latestRecognizedText = "";
    this.sentenceCount = 0;
    this.finalTranscriptSource = "none";
    this.appKeySource = "unknown";

    try {
      // 1. Fetch NLS token
      const tTokenStart = performance.now();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");

      const tokenResp = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ language: this.config.tokenLanguage }),
      });
      const tokenData: TokenResponse = await tokenResp.json();

      // Handle Chinese appkey not configured
      if (!tokenResp.ok || tokenData.error) {
        throw new Error(tokenData.error || "Failed to get ASR token");
      }
      if (!tokenData.token) {
        throw new Error("No token in response");
      }

      if (tokenData.appkey) {
        this.appkey = tokenData.appkey;
      }
      this.appKeySource = tokenData.appKeySource || "unknown";

      console.log(
        `[${this.config.providerId}] Token obtained in ${(performance.now() - tTokenStart).toFixed(0)}ms | ` +
        `requestedLanguage=${this.config.tokenLanguage} appKeySource=${this.appKeySource} ` +
        `appKey=${this.appkey ? this.appkey.slice(0, 4) + "..." : "MISSING"}`,
      );

      // 2. Set up AudioContext + AudioWorklet
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.stream = stream;

      await this.audioContext.audioWorklet.addModule(getWorkletUrl());

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.workletNode = new AudioWorkletNode(this.audioContext, "pcm-processor");
      this.sourceNode.connect(this.workletNode);

      // 3. Open WebSocket
      const wsUrl = `${WS_URL}?token=${tokenData.token}`;
      this.ws = new WebSocket(wsUrl);
      this.taskId = generateId();

      await new Promise<void>((resolve, reject) => {
        const ws = this.ws!;
        const timeout = setTimeout(() => reject(new Error("WebSocket connection timeout")), 15000);

        ws.onopen = () => {
          clearTimeout(timeout);
          const startMsg: WsMessage = {
            header: {
              message_id: generateId(),
              task_id: this.taskId,
              namespace: "SpeechTranscriber",
              name: "StartTranscription",
              appkey: this.appkey,
            },
            payload: {
              format: "pcm",
              sample_rate: 16000,
              enable_intermediate_result: true,
              enable_punctuation_prediction: true,
              max_sentence_silence: 1800,
            },
            context: {},
          };
          ws.send(JSON.stringify(startMsg));
        };

        ws.onmessage = (event: MessageEvent) => {
          if (typeof event.data !== "string") return;

          try {
            const msg: WsMessage = JSON.parse(event.data);
            const { name, status, status_message: statusMsg } = msg.header;

            if (status && status !== 20000000 && status !== 0) {
              reject(new Error(`Aliyun error ${status}: ${statusMsg || "unknown"}`));
              return;
            }

            switch (name) {
              case "TranscriptionStarted":
                this.wsReady = true;
                this.isListening = true;
                this._onStateChange?.();
                resolve();
                break;

              case "TranscriptionResultChanged":
                if (msg.payload.result) {
                  this.latestRecognizedText = msg.payload.result as string;
                  this.interim = this.latestRecognizedText;
                  this._onInterimUpdate?.(this.interim);
                }
                break;

              case "SentenceEnd":
                if (msg.payload.result) {
                  this.finalTranscript += (msg.payload.result as string) + " ";
                  this.transcript = this.finalTranscript.trim();
                  this.latestRecognizedText = this.transcript;
                  this.interim = "";
                  this.sentenceCount++;
                  this._onTranscriptUpdate?.(this.transcript);
                  this._onInterimUpdate?.("");
                }
                break;

              case "TranscriptionCompleted":
                break;
            }
          } catch {
            // Non-fatal JSON parse errors on control messages
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("WebSocket connection failed"));
        };

        ws.onclose = (e) => {
          // Handled in stop() lifecycle
        };
      });

      // 4. Start pumping PCM audio to WebSocket
      this.workletNode.port.onmessage = (event: MessageEvent) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.wsReady) return;
        const pcmFloat = event.data as Float32Array;
        const pcmInt16 = float32ToInt16(pcmFloat);
        this.ws.send(pcmInt16.buffer);
      };
    } catch (err) {
      this.cleanup();
      this.error = err instanceof Error ? err.message : "实时语音识别启动失败";
      console.error(`[${this.config.providerId}] Start failed:`, this.error);
      throw err;
    }
  }

  async stop(): Promise<string> {
    const transcriptBeforeStop = this.transcript;
    let sentencesReceivedDuringStop = 0;
    let completedReceived = false;
    let closeReason = "";
    const tStopStart = performance.now();

    this.stopped = true;

    // Stop audio capture — no more PCM frames
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
    }

    // Send StopTranscription and wait for final results
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const stopMsg: WsMessage = {
          header: {
            message_id: generateId(),
            task_id: this.taskId,
            namespace: "SpeechTranscriber",
            name: "StopTranscription",
            appkey: this.appkey,
          },
          payload: {},
        };
        this.ws.send(JSON.stringify(stopMsg));

        await new Promise<void>((resolve) => {
          const FINAL_FLUSH_TIMEOUT = 5000;
          const timeout = setTimeout(() => {
            closeReason = "timeout";
            resolve();
          }, FINAL_FLUSH_TIMEOUT);

          const ws = this.ws!;
          const origHandler = ws.onmessage;
          ws.onmessage = (event: MessageEvent) => {
            origHandler?.call(ws, event);

            if (typeof event.data === "string") {
              try {
                const msg: WsMessage = JSON.parse(event.data);
                if (msg.header.name === "SentenceEnd") {
                  sentencesReceivedDuringStop++;
                }
                if (msg.header.name === "TranscriptionCompleted") {
                  completedReceived = true;
                  closeReason = "completed";
                  clearTimeout(timeout);
                  resolve();
                }
              } catch { /* ignore */ }
            }
          };
        });
      } catch { /* ignore */ }
    } else {
      closeReason = "ws_unavailable";
    }

    // ── Fallback: use latestRecognizedText if no SentenceEnd ──
    if (!this.transcript && this.latestRecognizedText) {
      this.finalTranscript = this.latestRecognizedText;
      this.transcript = this.finalTranscript.trim();
      this._onTranscriptUpdate?.(this.transcript);
      this.finalTranscriptSource = "interim_cache";
    } else if (this.transcript) {
      this.finalTranscriptSource = "sentence_end";
    } else {
      this.finalTranscriptSource = "none";
    }

    const finalTranscript = this.transcript;
    const flushDuration = (performance.now() - tStopStart).toFixed(0);

    console.log(
      `[${this.config.providerId}] Stop lifecycle complete:` +
      `\n  providerId:              ${this.config.providerId}` +
      `\n  requestedLanguage:       ${this.config.tokenLanguage}` +
      `\n  appKeySource:            ${this.appKeySource}` +
      `\n  taskId:                  ${this.taskId}` +
      `\n  sentenceCount:           ${this.sentenceCount}` +
      `\n  sentencesDuringStop:     ${sentencesReceivedDuringStop}` +
      `\n  interimLength:           ${this.latestRecognizedText.length}` +
      `\n  completedReceived:       ${completedReceived ? "YES" : "NO"}` +
      `\n  closeReason:             ${closeReason}` +
      `\n  flushDuration:           ${flushDuration}ms` +
      `\n  finalTranscriptSource:   ${this.finalTranscriptSource}` +
      `\n  finalTranscriptLength:   ${finalTranscript.length}` +
      `\n  errorCode:               ${this.error || "none"}`,
    );

    this.cleanup();
    this.isListening = false;
    this._onStateChange?.();

    return finalTranscript;
  }

  reset(): void {
    this.cleanup();
    this.transcript = "";
    this.interim = "";
    this.isListening = false;
    this.error = null;
    this.finalTranscript = "";
    this.stopped = false;
    this.wsReady = false;
    this.latestRecognizedText = "";
    this.sentenceCount = 0;
    this.finalTranscriptSource = "none";
    this.appKeySource = "unknown";
  }

  private cleanup(): void {
    this.wsReady = false;

    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* ignore */ }
      this.sourceNode = null;
    }
    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch { /* ignore */ }
      this.workletNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.stream = null;
  }
}
