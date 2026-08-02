// ============================================
// Nancy OS — Aliyun ASR Provider
// Flow: MediaRecorder blob → Supabase Storage → Edge Function → Aliyun ASR → transcript
// ============================================

import type { SpeechProvider } from "../types";
import { supabase } from "@/lib/supabase";
import { webmToWav } from "../audioUtils";

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

  /** Set the session ID before stopping — needed for the Storage upload path. */
  setSessionId(id: string) {
    this.sessionId = id;
  }

  async start(): Promise<void> {
    this.error = null;
    this.isListening = true;
  }

  /**
   * Stop recognition and transcribe audio.
   * Flow: webm blob → decode to PCM → encode WAV → Storage → Edge Function → Aliyun ASR
   * Conversion is needed because Aliyun RecordingFileRecognize does not support
   * webm or opus; it accepts WAV/MP3/MP4/M4A/WMA/AAC/OGG/AMR/FLAC.
   */
  async stop(audioBlob?: Blob): Promise<void> {
    if (!audioBlob || audioBlob.size === 0) return;

    this.isListening = false;
    this._onStateChange?.();

    if (!this.sessionId) {
      this.error = "缺少会话 ID";
      return;
    }

    const tTotalStart = Date.now();

    try {
      // 1. Convert webm/opus → WAV (16kHz mono 16-bit PCM)
      const tConvertStart = Date.now();
      const wavBlob = await webmToWav(audioBlob);
      const convertTime = Date.now() - tConvertStart;
      console.log(`[aliyunSpeech] Conversion: ${convertTime}ms (${(audioBlob.size / 1024).toFixed(1)}KB webm → ${(wavBlob.size / 1024).toFixed(1)}KB wav)`);

      // 2. Upload WAV to Supabase Storage
      const tUploadStart = Date.now();
      const fileName = `${this.sessionId}/${Date.now()}.wav`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("speaking-audio")
        .upload(fileName, wavBlob, {
          contentType: "audio/wav",
          upsert: false,
        });

      if (uploadError) throw new Error(`上传失败: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from("speaking-audio")
        .getPublicUrl(fileName);
      const uploadTime = Date.now() - tUploadStart;
      console.log(`[aliyunSpeech] Upload: ${uploadTime}ms (path: ${fileName})`);

      // 3. Call Edge Function for ASR transcription
      const tEdgeStart = Date.now();
      const result = await supabase.functions.invoke("speech-to-text", {
        body: { audioUrl: urlData.publicUrl },
      });
      const edgeTime = Date.now() - tEdgeStart;

      if (result.error) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : (result.error as { message?: string })?.message || "ASR 调用失败";
        throw new Error(msg);
      }

      const data = result.data as { transcript?: string; error?: string; timings?: Record<string, number> } | null;
      if (data?.error) throw new Error(data.error);

      const totalTime = Date.now() - tTotalStart;
      console.log("[aliyunSpeech] Timings:", {
        convertTime,
        uploadTime,
        edgeTime,
        edgeTimings: data?.timings,
        totalTime,
      });

      this.transcript = data?.transcript || "";
      this._onTranscriptUpdate?.(this.transcript);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "语音识别失败";
    }
  }

  reset(): void {
    this.transcript = "";
    this.interim = "";
    this.isListening = false;
    this.error = null;
  }
}
