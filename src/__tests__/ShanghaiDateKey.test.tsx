import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMillisecondsUntilNextShanghaiMidnight, useShanghaiDateKey } from "@/lib/hooks/useShanghaiDateKey";

afterEach(() => {
  vi.useRealTimers();
});

describe("reactive Shanghai date key", () => {
  it("computes the exact delay to the next Asia/Shanghai midnight", () => {
    const now = new Date("2026-08-23T15:59:59.000Z");
    expect(getMillisecondsUntilNextShanghaiMidnight(now)).toBe(1_000);
  });

  it("switches the key after 23:59:59 without reusing the previous day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T15:59:59.000Z"));
    const { result, unmount } = renderHook(() => useShanghaiDateKey());
    expect(result.current).toBe("2026-08-23");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(result.current).toBe("2026-08-24");
    unmount();
  });

  it("checks for a changed Shanghai date again when the window regains focus", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T15:00:00.000Z"));
    const { result, unmount } = renderHook(() => useShanghaiDateKey());

    act(() => {
      vi.setSystemTime(new Date("2026-08-23T16:00:01.000Z"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(result.current).toBe("2026-08-24");
    unmount();
  });
});
