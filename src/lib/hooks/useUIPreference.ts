// ============================================
// Nancy OS — UI Preference Hook
// localStorage-backed, future-migration-ready
// Swap the storage layer to migrate to backend settings
// ============================================

import { useState, useCallback } from "react";

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

export function useUIPreference<T>(
  key: string,
  defaultValue: T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, defaultValue));

  const set = useCallback(
    (next: T) => {
      setValue(next);
      write(key, next);
    },
    [key],
  );

  return [value, set];
}
