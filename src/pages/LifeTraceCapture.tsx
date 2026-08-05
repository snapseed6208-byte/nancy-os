import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Mic, Square, Image, X, CheckCircle2, Loader2, AlertTriangle, Camera,
} from "lucide-react";
import { saveCapture, getPendingSyncs, markSynced, type PendingCapture } from "@/lib/db/indexedDb";
import { useSyncCapture } from "@/lib/hooks/useLifeTrace";
import { useAudioRecorder } from "@/lib/hooks/useAudioRecorder";
import { cn } from "@/lib/utils";

const ENTRY_TYPES = ["心情", "想法", "备忘", "灵感", "待办", "复盘", "照片记录", "语音记录"];

// ── Page ──

export default function LifeTraceCapture() {
  const [, navigate] = useLocation();
  const syncCapture = useSyncCapture();

  const initialType = new URLSearchParams(window.location.search).get("type") || "";

  const [content, setContent] = useState("");
  const [category, setCategory] = useState(
    initialType && ENTRY_TYPES.includes(initialType) ? initialType : ""
  );
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncingPending, setSyncingPending] = useState(false);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);

  const recorder = useAudioRecorder();

  // Sync pending captures on mount
  const syncPendingCaptures = useCallback(async () => {
    const pending = await getPendingSyncs();
    if (pending.length === 0) return;
    setSyncingPending(true);
    setSyncErrors([]);
    const errors: string[] = [];
    for (const capture of pending) {
      try {
        await syncCapture.mutateAsync(capture);
        await markSynced(capture.localId);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "同步失败");
      }
    }
    if (errors.length > 0) setSyncErrors(errors);
    setSyncingPending(false);
  }, [syncCapture]);

  useEffect(() => {
    syncPendingCaptures();
  }, []);

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length && images.length < 6; i++) {
      const reader = new FileReader();
      reader.onload = () => setImages((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(files[i]);
    }
    e.target.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!content.trim() && images.length === 0 && !recorder.blob) return;
    setSaving(true);
    setSaveError(null);

    let audioDataUrl = "";
    if (recorder.blob) {
      const reader = new FileReader();
      audioDataUrl = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve("");
        reader.readAsDataURL(recorder.blob!);
      });
    }

    const capture: PendingCapture = {
      localId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      content: content.trim(),
      category: category || "",
      images,
      audioDataUrl: audioDataUrl || null,
      audioDuration: recorder.duration,
      synced: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Save to IndexedDB (instant)
      await saveCapture(capture);

      // Try background sync to Supabase
      try {
        await syncCapture.mutateAsync(capture);
        await markSynced(capture.localId);
      } catch {
        // Will sync later — capture is safely in IndexedDB
      }

      setSaved(true);
      setTimeout(() => navigate("/life-trace"), 1200);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const canSave = content.trim() || images.length > 0 || recorder.blob;

  if (saved) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="h-16 w-16 rounded-full bg-sage-light flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-sage-deep" />
        </div>
        <p className="text-lg font-semibold text-ink">已保存</p>
        <p className="text-xs text-ink-lighter">记录已保存到本地，后台同步中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/life-trace")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div>
          <p className="text-sm text-ink-lighter">Life Trace</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">快速记录</h1>
        </div>
      </header>

      {/* Content */}
      <textarea
        className="w-full bg-card border border-border rounded-xl px-3 py-3 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light resize-none"
        rows={5}
        placeholder="此刻在想什么？"
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      {/* Type selector */}
      <div>
        <label className="text-xs font-medium text-ink-light mb-2 block">记录类型</label>
        <div className="flex flex-wrap gap-2">
          {ENTRY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setCategory(category === t ? "" : t)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs transition-colors",
                category === t
                  ? "border-sage-light bg-sage-light/30 text-sage-deep"
                  : "border-border text-ink-light hover:border-sage-light/50",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Voice recording */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-medium text-ink-light mb-3">语音记录</p>
        {recorder.error && (
          <p className="text-xs text-accent-rose mb-2 flex items-center gap-1">
            <AlertTriangle size={12} /> {recorder.error}
          </p>
        )}
        <div className="flex items-center gap-3">
          {recorder.state === "idle" && (
            <button onClick={() => recorder.start()} className="bg-accent-rose/10 text-accent-rose rounded-full h-10 w-10 flex items-center justify-center">
              <Mic size={18} />
            </button>
          )}
          {recorder.state === "recording" && (
            <button onClick={recorder.stop} className="bg-accent-rose/20 text-accent-rose rounded-full h-10 w-10 flex items-center justify-center animate-pulse">
              <Square size={16} />
            </button>
          )}
          {recorder.state === "done" && (
            <>
              <button onClick={recorder.reset} className="bg-ink/5 text-ink-light rounded-full h-10 w-10 flex items-center justify-center">
                <X size={16} />
              </button>
              {recorder.audioUrl && <audio controls src={recorder.audioUrl} className="h-10 max-w-[200px]" />}
            </>
          )}
          <span className="text-xs text-ink-lighter">
            {recorder.state === "idle" && "点击录音"}
            {recorder.state === "recording" && `录音中 ${recorder.duration}秒`}
            {recorder.state === "done" && `录音完成 (${recorder.duration}秒)`}
          </span>
        </div>
      </div>

      {/* Photo capture */}
      <div>
        <p className="text-xs font-medium text-ink-light mb-2">照片 (最多6张)</p>
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0">
              <img src={img} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => handleRemoveImage(i)}
                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-ink/60 flex items-center justify-center"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
          {images.length < 6 && (
            <label className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-sage-light/50 transition-colors">
              <Camera size={18} className="text-ink-lighter" />
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageAdd} multiple />
            </label>
          )}
        </div>
      </div>

      {/* Error */}
      {saveError && (
        <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 text-xs text-accent-rose flex items-center gap-2">
          <AlertTriangle size={14} />
          {saveError}
        </div>
      )}

      {/* Sync pending banner */}
      {syncingPending && (
        <div className="bg-sage-light/20 border border-sage-light/30 rounded-xl p-3 text-xs text-sage-deep flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          正在同步之前的离线记录...
        </div>
      )}

      {/* Sync error with retry */}
      {syncErrors.length > 0 && (
        <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 space-y-2">
          {syncErrors.map((err, i) => (
            <p key={i} className="text-xs text-accent-rose flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {err}
            </p>
          ))}
          <button
            onClick={syncPendingCaptures}
            className="text-xs text-sage-deep font-medium underline"
          >
            重新同步
          </button>
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            保存中...
          </>
        ) : (
          "保存记录"
        )}
      </button>

      <p className="text-xs text-ink-lighter text-center">
        记录先保存到本地，稍后自动同步到云端
      </p>
    </div>
  );
}
