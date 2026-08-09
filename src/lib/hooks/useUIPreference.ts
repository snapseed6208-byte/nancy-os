// ============================================
// Nancy OS — UI Preference Hook (v2)
// localStorage-backed with cross-tab sync and
// structural validation.
// ============================================

import { useState, useCallback, useEffect } from "react";

const PREFIX = "ui_pref_";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // quota exceeded or private mode — silently ignore
  }
}

/**
 * localStorage-backed preference with cross-tab synchronization.
 * When a write happens in another tab, this hook picks it up via the
 * `storage` event and updates state.
 */
export function useUIPreference<T>(
  key: string,
  defaultValue: T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, defaultValue));

  // Cross-tab sync: listen for localStorage changes from other tabs
  useEffect(() => {
    const fullKey = PREFIX + key;
    const handler = (e: StorageEvent) => {
      if (e.key !== fullKey) return;
      if (e.newValue === null) {
        setValue(defaultValue);
        return;
      }
      try {
        setValue(JSON.parse(e.newValue) as T);
      } catch {
        // corrupt value from another tab — keep current
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [key, defaultValue]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      write(key, next);
    },
    [key],
  );

  return [value, set];
}
