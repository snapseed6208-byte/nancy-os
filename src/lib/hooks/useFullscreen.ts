import { useCallback, useRef, useEffect } from "react";

interface UseFullscreenOptions {
  onExit?: () => void;
  onError?: () => void;
}

export function useFullscreen(options: UseFullscreenOptions = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const { onExit, onError } = options;

  const enter = useCallback(async () => {
    const el = ref.current;
    if (!el) return;

    try {
      await el.requestFullscreen();

      // Attempt landscape lock on mobile (silent degrade)
      try {
        const orient = screen.orientation as unknown as ScreenOrientationExt | undefined;
        if (orient?.lock && orient.type !== "landscape-primary") {
          await orient.lock("landscape-primary");
        }
      } catch {
        // Not supported or user denied — silent degrade
      }
    } catch {
      onError?.();
    }
  }, [onError]);

  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // silent
    }
  }, []);

  // Listen for native fullscreen exit (Esc key, swipe, etc.)
  useEffect(() => {
    const handleChange = () => {
      if (!document.fullscreenElement) {
        onExit?.();

        // Unlock orientation when exiting fullscreen
        try {
          const orient = screen.orientation as unknown as ScreenOrientationExt | undefined;
          if (orient?.unlock) orient.unlock();
        } catch {
          // silent
        }
      }
    };

    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, [onExit]);

  return { ref, enter, exit };
}

// Lightweight type for Screen Orientation API (not in all TS libs)
interface ScreenOrientationExt {
  type: string;
  lock(orientation: string): Promise<void>;
  unlock(): void;
}
