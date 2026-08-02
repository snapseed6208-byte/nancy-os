// ============================================
// Nancy OS — Aliyun ASR Provider
// Flow: MediaRecorder blob → WAV conversion → Edge Function → Aliyun ASR → transcript
// No Storage upload — WAV binary sent directly to Edge Function.
// ============================================

import type { SpeechProvider } from "../types";
import { supabase } from "@/lib/supabase";
import { webmToWav } from "../audioUtils";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text`;

export class AliyunSpeechProvider implements SpeechProvider {
  readonly name = "aliyun";
  readonly supported = true;

  transcript = "";
  interim = "";
  isListening = false;
  error: string | null = null;

  private sessionId: string | null = null;
  private _onTranscriptUpdate: ((text: string) => void) | null = null;
  private _onStateChange: (() => void) | null = null;

  set onTranscriptUpdate(cb: ((text: string) => void) | null) {
    this._onTranscriptUpdate = cb;
  }

  set onStateChange(cb: (() => void) | null) {
    this._onStateChange = cb;
  }

  setSessionId(id: string) {
    this.sessionId = id;
  }

  async start(): Promise<void> {
    this.error = null;
    this.isListening = true;
  }

  async stop(audioBlob?: Blob): Promise<void> {
    if (!audioBlob || audioBlob.size === 0) return;

    this.isListening = false;
    this._onStateChange?.();

    const tTotalStart = Date.now();

    try {
      // 1. Convert webm/opus → WAV (16kHz mono 16-bit PCM)
      const tConvertStart = Date.now();
      const wavBlob = await webmToWav(audioBlob);
      const convertTime = Date.now() - tConvertStart;
      console.log(`[aliyunSpeech] Conversion: ${convertTime}ms (${(audioBlob.size / 1024).toFixed(1)}KB webm → ${(wavBlob.size / 1024).toFixed(1)}KB wav)`);

      // 2. Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");

      // 3. Send WAV binary directly to Edge Function
      const tEdgeStart = Date.now();
      const resp = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "audio/wav",
        },
        body: wavBlob,
      });
      const edgeTime = Date.now() - tEdgeStart;

      const result = await resp.json() as {
        transcript?: string;
        task_id?: string;
        duration_ms?: number;
        error?: string;
        timings?: { tokenTime: number; asrTime: number; totalTime: number };
      };

      if (!resp.ok || result.error) {
        throw new Error(result.error || `Edge Function returned HTTP ${resp.status}`);
      }

      const totalTime = Date.now() - tTotalStart;
      console.log("[aliyunSpeech] Timings:", {
        convertTime,
        edgeTime,
        edgeTimings: result.timings,
        totalTime,
      });

      this.transcript = result.transcript || "";
      this._onTranscriptUpdate?.(this.transcript);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "语音识别失败";
      console.error("[aliyunSpeech] Error:", this.error);
    }
  }

  reset(): void {
    this.transcript = "";
    this.interim = "";
    this.isListening = false;
    this.error = null;
  }
}
