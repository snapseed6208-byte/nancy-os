// ============================================
// Nancy OS — Shared Audio Recorder Hook
// Used by English Speaking, Chinese Speaking, and LifeTrace Capture.
//
// IMPORTANT: audioUrl is a transient blob URL revoked on reset().
// For persistent playback (e.g. comparison UI), use the uploaded DB URL.
// ============================================

import { useState, useRef, useCallback } from "react";

export type MicErrorType = "denied" | "not_found" | "busy" | "unsupported" | "unknown";

export function useAudioRecorder() {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<MicErrorType | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startTime = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownsStreamRef = useRef(true);

  const _setupRecorder = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    const mr = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
    });
    mediaRecorder.current = mr;
    chunks.current = [];
    startTime.current = Date.now();

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

    mr.onstop = () => {
      const audioBlob = new Blob(chunks.current, { type: mr.mimeType });
      const url = URL.createObjectURL(audioBlob);
      setBlob(audioBlob);
      setAudioUrl(url);
      setDuration(Math.round((Date.now() - startTime.current) / 1000));
      setState("done");
      if (timerRef.current) clearInterval(timerRef.current);
      wakeLockRef.current?.release().catch(() => {});
    };

    mr.start();
    setState("recording");
    timerRef.current = setInterval(() => {
      setDuration(Math.round((Date.now() - startTime.current) / 1000));
    }, 200);
  }, []);

  const start = useCallback(async (existingStream?: MediaStream) => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") return;
    setError(null);
    setErrorType(null);
    try {
      const stream = existingStream || await navigator.mediaDevices.getUserMedia({ audio: true });
      ownsStreamRef.current = !existingStream;
      _setupRecorder(stream);
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch { /* not supported */ }
    } catch (err: unknown) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setError("麦克风权限被拒绝。请在浏览器设置中允许麦克风访问，或切换至文本模式。");
        setErrorType("denied");
      } else if (e.name === "NotFoundError") {
        setError("未检测到麦克风设备。请连接麦克风后重试，或切换至文本模式。");
        setErrorType("not_found");
      } else if (e.name === "NotReadableError") {
        setError("麦克风被其他应用占用。请关闭其他使用麦克风的应用后重试。");
        setErrorType("busy");
      } else {
        setError("无法访问麦克风。请检查浏览器权限设置，或切换至文本模式。");
        setErrorType("unknown");
      }
      setState("idle");
    }
  }, [_setupRecorder]);

  const startWithStream = useCallback((stream: MediaStream) => {
    return start(stream);
  }, [start]);

  const stop = useCallback(() => {
    mediaRecorder.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ownsStreamRef.current = true;
    setAudioUrl(null);
    setBlob(null);
    setDuration(0);
    setError(null);
    setErrorType(null);
    setState("idle");
  }, [audioUrl]);

  return { state, audioUrl, blob, duration, error, errorType, start, startWithStream, stop, reset, streamRef };
}
