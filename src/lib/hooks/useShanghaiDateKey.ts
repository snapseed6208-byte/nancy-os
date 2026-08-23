import { useEffect, useState } from "react";
import { getShanghaiDateKey } from "@/lib/english/sessionRepository";

const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const MIDNIGHT_SAFETY_BUFFER_MS = 250;

export function getMillisecondsUntilNextShanghaiMidnight(now: Date = new Date()): number {
  const [year, month, day] = getShanghaiDateKey(now).split("-").map(Number);
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1) - SHANGHAI_UTC_OFFSET_MS;
  return Math.max(0, nextMidnightUtc - now.getTime());
}

export function useShanghaiDateKey(): string {
  const [dateKey, setDateKey] = useState(() => getShanghaiDateKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextCheck = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        refreshDateKey,
        getMillisecondsUntilNextShanghaiMidnight() + MIDNIGHT_SAFETY_BUFFER_MS,
      );
    };

    const refreshDateKey = () => {
      setDateKey((current) => {
        const next = getShanghaiDateKey();
        return current === next ? current : next;
      });
      scheduleNextCheck();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshDateKey();
    };

    scheduleNextCheck();
    window.addEventListener("focus", refreshDateKey);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", refreshDateKey);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return dateKey;
}
