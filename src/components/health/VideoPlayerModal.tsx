import { useEffect, useState } from "react";
import { X, Maximize, Minimize, Dumbbell, Clock, Zap, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import VideoPlayer from "@/components/health/VideoPlayer";
import { useFullscreen } from "@/lib/hooks/useFullscreen";
import type { WorkoutVideo } from "@/lib/hooks/useHealth";

type VideoPlayerModalProps = {
  video: WorkoutVideo;
  onClose: () => void;
};

export default function VideoPlayerModal({ video, onClose }: VideoPlayerModalProps) {
  const { ref: fsRef, enter: enterFs, exit: exitFs } = useFullscreen({
    onExit: () => setIsFullscreen(false),
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Esc
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isFullscreen) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, isFullscreen]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await exitFs();
      setIsFullscreen(false);
    } else {
      await enterFs();
      setIsFullscreen(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 safe-bottom">
      {/* Fullscreen container */}
      <div
        ref={fsRef}
        className={cn(
          "relative w-full h-full flex flex-col",
          isFullscreen
            ? "bg-black"
            : "max-w-4xl mx-auto bg-black md:rounded-2xl md:overflow-hidden",
        )}
      >
        {/* ── Top bar: close + fullscreen ── */}
        <div className={cn(
          "flex items-center justify-between shrink-0 px-4 py-3 z-10",
          isFullscreen ? "safe-top absolute top-0 left-0 right-0" : "",
        )}>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="关闭"
          >
            <X size={18} />
          </button>

          <button
            onClick={toggleFullscreen}
            className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label={isFullscreen ? "退出全屏" : "全屏"}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>

        {/* ── Video area ── */}
        <div className={cn("flex-1 flex items-center justify-center", isFullscreen ? "px-0" : "px-4")}>
          <div className={cn("w-full", isFullscreen ? "h-full" : "aspect-video max-h-[70vh]")}>
            <VideoPlayer
              embedUrl={video.embed_url!}
              thumbnailUrl={video.thumbnail_url}
              title={video.title || ""}
              platform={video.platform}
              sourceUrl={video.url}
              autoPlay
              className="h-full [&>*:last-child]:hidden"
            />
          </div>
        </div>

        {/* ── Workout info bar ── */}
        {!isFullscreen && (
          <div className="shrink-0 px-4 py-3">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
              <h2 className="text-white font-semibold text-sm leading-snug">
                {video.title || "训练视频"}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {video.training_type && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-white/70 bg-white/10 rounded-full px-2 py-0.5">
                    <Dumbbell size={10} />
                    {video.training_type}
                  </span>
                )}
                {video.difficulty && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-white/70 bg-white/10 rounded-full px-2 py-0.5">
                    <Zap size={10} />
                    {video.difficulty}
                  </span>
                )}
                {video.estimated_duration && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-white/70 bg-white/10 rounded-full px-2 py-0.5">
                    <Clock size={10} />
                    ~{video.estimated_duration}分钟
                  </span>
                )}
                {video.category && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-white/70 bg-white/10 rounded-full px-2 py-0.5">
                    <Target size={10} />
                    {video.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
