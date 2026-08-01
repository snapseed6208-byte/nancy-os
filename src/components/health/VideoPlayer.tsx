import { useState, useRef, useCallback, useEffect } from "react";
import { Play, ExternalLink, AlertTriangle, Loader2, X, Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFullscreen } from "@/lib/hooks/useFullscreen";

type PlayerState = "idle" | "loading" | "playing" | "error";

export type VideoPlayerProps = {
  embedUrl: string;
  thumbnailUrl: string | null;
  title: string;
  platform: string;
  sourceUrl: string;
  className?: string;
  /** Called when user clicks X to collapse player back to thumbnail */
  onClose?: () => void;
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
  className,
  onClose,
}: VideoPlayerProps) {
  const [state, setState] = useState<PlayerState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReadyRef = useRef(false);

  const { ref: fsRef, enter: enterFs, exit: exitFs } = useFullscreen();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Listen for native fullscreen exit
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

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
  }, [clearTimer]);

  const handleIframeError = useCallback(() => {
    clearTimer();
    iframeReadyRef.current = false;
    setState("error");
  }, [clearTimer]);

  const handleRetry = useCallback(() => {
    iframeReadyRef.current = false;
    setState("idle");
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await exitFs();
      setIsFullscreen(false);
    } else {
      await enterFs();
      setIsFullscreen(true);
    }
  }, [enterFs, exitFs]);

  const meta = getPlatformMeta(platform);
  const hasThumbnail = !!thumbnailUrl;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Player area */}
      <div
        ref={fsRef}
        className={cn(
          "video-container relative w-full overflow-hidden rounded-xl bg-black",
          isFullscreen
            ? "flex items-center justify-center rounded-none"
            : "",
        )}
        style={isFullscreen ? undefined : { aspectRatio: "16/9" }}
      >
        {/* Idle: thumbnail + play button */}
        {state === "idle" && (
          <button
            onClick={handlePlay}
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-2 transition-colors bg-cover bg-center",
              !hasThumbnail && meta.bg,
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

        {/* Iframe */}
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
              "border-0",
              isFullscreen
                ? "w-full h-full"
                : "absolute inset-0 w-full h-full",
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

        {/* Control bar — visible when playing */}
        {state === "playing" && (
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-2 py-2 z-10">
            {onClose && (
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg bg-black/50 flex items-center justify-center text-white/80 hover:bg-black/70 hover:text-white transition-colors"
                aria-label="关闭播放器"
              >
                <X size={15} />
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="h-8 w-8 rounded-lg bg-black/50 flex items-center justify-center text-white/80 hover:bg-black/70 hover:text-white transition-colors ml-auto"
              aria-label={isFullscreen ? "退出全屏" : "全屏"}
            >
              {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
            </button>
          </div>
        )}
      </div>

      {/* External link */}
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-ink-lighter hover:text-accent-sky transition-colors"
      >
        <ExternalLink size={10} />
        在{meta.label}打开
      </a>
    </div>
  );
}
