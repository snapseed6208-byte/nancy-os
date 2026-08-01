import { useState, useRef, useCallback, useEffect } from "react";
import { Play, ExternalLink, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PlayerState = "idle" | "loading" | "playing" | "error";

export type VideoPlayerProps = {
  embedUrl: string;
  thumbnailUrl: string | null;
  title: string;
  platform: string;
  sourceUrl: string;
  /** Start playing immediately (skip idle state) */
  autoPlay?: boolean;
  /** Extra class for the outer container */
  className?: string;
  /** Called when iframe loads successfully */
  onReady?: () => void;
};

const PLATFORM_COLORS: Record<string, { bg: string; icon: string; label: string }> = {
  bilibili: { bg: "bg-[#fb7299]/10", icon: "text-[#fb7299]", label: "B站" },
  youtube: { bg: "bg-[#ff0000]/10", icon: "text-[#ff0000]", label: "YouTube" },
};

function getPlatformMeta(platform: string) {
  return PLATFORM_COLORS[platform] || { bg: "bg-ink/5", icon: "text-ink-lighter", label: platform };
}

const LOAD_TIMEOUT = 10_000;

export default function VideoPlayer({
  embedUrl,
  thumbnailUrl,
  title,
  platform,
  sourceUrl,
  autoPlay = false,
  className,
  onReady,
}: VideoPlayerProps) {
  const [state, setState] = useState<PlayerState>(autoPlay ? "loading" : "idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReadyRef = useRef(false);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePlay = useCallback(() => {
    iframeReadyRef.current = false;
    setState("loading");
    timerRef.current = setTimeout(() => setState("error"), LOAD_TIMEOUT);
  }, []);

  const handleIframeLoad = useCallback(() => {
    clearTimer();
    iframeReadyRef.current = true;
    setState("playing");
    onReady?.();
  }, [clearTimer, onReady]);

  const handleIframeError = useCallback(() => {
    clearTimer();
    iframeReadyRef.current = false;
    setState("error");
  }, [clearTimer]);

  const handleRetry = useCallback(() => {
    iframeReadyRef.current = false;
    setState("idle");
  }, []);

  const meta = getPlatformMeta(platform);
  const hasThumbnail = !!thumbnailUrl;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Player area */}
      <div className="relative w-full overflow-hidden rounded-xl bg-ink/5" style={{ aspectRatio: "16/9" }}>
        {/* Idle: click-to-play */}
        {state === "idle" && (
          <button
            onClick={handlePlay}
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-2 transition-colors bg-cover bg-center",
              meta.bg,
              "hover:opacity-80",
            )}
            style={hasThumbnail ? { backgroundImage: `url(${thumbnailUrl})` } : undefined}
          >
            {hasThumbnail && <div className="absolute inset-0 bg-black/40 rounded-xl" />}
            <div className={cn(
              "relative z-10 h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg",
              meta.icon,
            )}>
              <Play size={22} fill="currentColor" />
            </div>
            <span className="relative z-10 text-xs font-medium text-white">点击播放</span>
          </button>
        )}

        {/* Loading spinner */}
        {state === "loading" && (
          <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-2", meta.bg)}>
            <Loader2 size={24} className="animate-spin text-ink-lighter" />
            <span className="text-xs text-ink-lighter">加载中...</span>
          </div>
        )}

        {/* Iframe — rendered during loading to start fetch, hidden until ready */}
        {(state === "loading" || state === "playing") && (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={title}
            allow="autoplay; fullscreen; accelerometer; gyroscope"
            allowFullScreen
            {...{ playsInline: true, "webkit-playsinline": "true" } as Record<string, unknown>}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            className={cn(
              "absolute inset-0 w-full h-full border-0",
              state === "playing" ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          />
        )}

        {/* Error state */}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/5">
            <AlertTriangle size={22} className="text-amber-500" />
            <p className="text-xs text-ink-lighter">无法加载视频</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetry}
                className="text-xs font-medium text-sage-deep bg-sage-light rounded-lg px-3 py-1.5 hover:bg-sage-light/80 transition-colors"
              >
                重试
              </button>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-ink-light bg-ink/10 rounded-lg px-3 py-1.5 hover:bg-ink/15 transition-colors inline-flex items-center gap-1"
              >
                <ExternalLink size={11} />
                在{meta.label}打开
              </a>
            </div>
          </div>
        )}

        {/* Auto-play trigger when autoPlay=true */}
        {autoPlay && state === "idle" && (
          <button onClick={handlePlay} className="absolute inset-0" aria-label="加载视频" />
        )}
      </div>

      {/* External link */}
      {!autoPlay && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-ink-lighter hover:text-accent-sky transition-colors"
        >
          <ExternalLink size={10} />
          在{meta.label}打开
        </a>
      )}
    </div>
  );
}
