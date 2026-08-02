// ============================================
// Nancy OS — Aliyun Real-time ASR Provider
// Flow: AudioContext+AudioWorklet → PCM → WebSocket → Aliyun NLS
// Browser connects directly to Aliyun WebSocket; Edge Function only for token.
// ============================================

import type { SpeechProvider } from "../types";
import { supabase } from "@/lib/supabase";

const WS_URL = "wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1";
const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aliyun-token`;

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

// ── Provider ──

export class AliyunRealtimeSpeechProvider implements SpeechProvider {
  readonly name = "aliyun-realtime";
  readonly supported = typeof AudioContext !== "undefined" && typeof WebSocket !== "undefined";

  transcript = "";
  interim = "";
  isListening = false;
  error: string | null = null;

  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private taskId = "";
  private appkey = "";
  private finalTranscript = "";
  private wsReady = false;
  private stopped = false;

  private _onTranscriptUpdate: ((text: string) => void) | null = null;
  private _onInterimUpdate: ((text: string) => void) | null = null;
  private _onStateChange: (() => void) | null = null;

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

    try {
      // 1. Fetch NLS token
      const tTokenStart = performance.now();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");

      const tokenResp = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      const tokenData = await tokenResp.json() as { token?: string; error?: string; appkey?: string };
      if (!tokenResp.ok || tokenData.error || !tokenData.token) {
        throw new Error(tokenData.error || "Failed to get ASR token");
      }
      console.log(`[aliyunRealtime] Token obtained in ${(performance.now() - tTokenStart).toFixed(0)}ms`);
      if (tokenData.appkey) {
        this.appkey = tokenData.appkey;
      }
      console.log("[aliyunRealtime] AppKey:", this.appkey ? `${this.appkey.slice(0, 4)}...` : "MISSING");

      // 2. Set up AudioContext + AudioWorklet
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.stream = stream;

      // Load worklet
      await this.audioContext.audioWorklet.addModule(getWorkletUrl());

      // Connect: stream → source → worklet → (no output, just postMessage)
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
          // Send StartTranscription
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
              max_sentence_silence: 800,
            },
            context: {},
          };
          console.log("[aliyunRealtime] StartTranscription:", JSON.stringify(startMsg, null, 2));
          ws.send(JSON.stringify(startMsg));
        };

        ws.onmessage = (event: MessageEvent) => {
          if (typeof event.data !== "string") return; // Binary (shouldn't happen)

          console.log("[aliyunRealtime] Server message:", event.data.slice(0, 300));

          try {
            const msg: WsMessage = JSON.parse(event.data);
            const { name, status, status_message: statusMsg } = msg.header;

            if (status && status !== 20000000 && status !== 0) {
              console.error("[aliyunRealtime] Server error response:", JSON.stringify(msg, null, 2));
              reject(new Error(`Aliyun error ${status}: ${statusMsg || "unknown"}`));
              return;
            }

            switch (name) {
              case "TranscriptionStarted":
                this.wsReady = true;
                this.isListening = true;
                this._onStateChange?.();
                console.log("[aliyunRealtime] TranscriptionStarted, ready for audio");
                resolve();
                break;

              case "TranscriptionResultChanged":
                if (msg.payload.result) {
                  this.interim = msg.payload.result as string;
                  this._onInterimUpdate?.(this.interim);
                }
                break;

              case "SentenceEnd":
                if (msg.payload.result) {
                  this.finalTranscript += (msg.payload.result as string) + " ";
                  this.transcript = this.finalTranscript.trim();
                  this.interim = "";
                  this._onTranscriptUpdate?.(this.transcript);
                  this._onInterimUpdate?.("");
                  console.log("[aliyunRealtime] SentenceEnd:", msg.payload.result);
                }
                break;

              case "TranscriptionCompleted":
                console.log("[aliyunRealtime] TranscriptionCompleted");
                break;
            }
          } catch (err) {
            // JSON parse errors on control messages are non-fatal
            console.warn("[aliyunRealtime] Failed to parse message:", event.data.slice(0, 100));
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("WebSocket connection failed"));
        };

        ws.onclose = (e) => {
          if (!this.stopped) {
            console.warn(`[aliyunRealtime] WebSocket closed: code=${e.code} reason=${e.reason} wasClean=${e.wasClean}`);
          }
        };
      });

      // 4. Start pumping PCM audio to WebSocket
      this.workletNode.port.onmessage = (event: MessageEvent) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.wsReady) return;
        const pcmFloat = event.data as Float32Array;
        const pcmInt16 = float32ToInt16(pcmFloat);
        this.ws.send(pcmInt16.buffer);
      };

      console.log("[aliyunRealtime] Audio streaming started");
    } catch (err) {
      this.cleanup();
      this.error = err instanceof Error ? err.message : "实时语音识别启动失败";
      console.error("[aliyunRealtime] Start failed:", this.error);
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;

    // Stop audio capture
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
    }

    // Send StopTranscription
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const stopMsg: WsMessage = {
          header: {
            message_id: generateId(),
            task_id: this.taskId,
            namespace: "SpeechTranscriber",
            name: "StopTranscription",
          },
          payload: {},
        };
        this.ws.send(JSON.stringify(stopMsg));
        console.log("[aliyunRealtime] StopTranscription sent");

        // Wait briefly for final events then close
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.log("[aliyunRealtime] Stop timeout — closing");
            resolve();
          }, 3000);

          const ws = this.ws!;
          const origHandler = ws.onmessage;
          ws.onmessage = (event: MessageEvent) => {
            origHandler?.call(ws, event);

            if (typeof event.data === "string") {
              try {
                const msg: WsMessage = JSON.parse(event.data);
                if (msg.header.name === "TranscriptionCompleted") {
                  clearTimeout(timeout);
                  resolve();
                }
              } catch { /* ignore */ }
            }
          };
        });
      } catch { /* ignore */ }
    }

    this.cleanup();
    this.isListening = false;
    this._onStateChange?.();
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
    // Stream tracks are NOT stopped here — shared with MediaRecorder.
    // The component manages track lifecycle after both recorder and ASR finish.
    this.stream = null;
  }
}
