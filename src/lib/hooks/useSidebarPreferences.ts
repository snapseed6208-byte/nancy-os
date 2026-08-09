// ============================================
// Nancy OS — useSidebarPreferences
// localStorage-backed sidebar personalization.
// Uses the same pattern as useUIPreference.
// ============================================

import { useUIPreference } from "@/lib/hooks/useUIPreference";
import { useCallback, useMemo } from "react";
import { DEFAULT_ITEM_ORDER } from "@/config/navigation";

export interface SidebarPreferences {
  /** Ordered list of item IDs (top to bottom) */
  order: string[];
  /** Groups that are currently collapsed */
  collapsedGroups: string[];
  /** Items hidden by user */
  hiddenItems: string[];
}

const DEFAULTS: SidebarPreferences = {
  order: DEFAULT_ITEM_ORDER,
  collapsedGroups: [],
  hiddenItems: [],
};

export function useSidebarPreferences() {
  const [prefs, setPrefs] = useUIPreference<SidebarPreferences>(
    "sidebar_v1",
    DEFAULTS,
  );

  // Ensure new items (not in saved order) appear at their default position
  const order = useMemo(() => {
    const saved = prefs.order;
    // Add any items that exist in defaults but not in saved order
    const missing = DEFAULT_ITEM_ORDER.filter((id) => !saved.includes(id));
    if (missing.length === 0) return saved;
    // Insert missing items near their default neighbors
    const merged = [...saved];
    for (const id of missing) {
      const defaultIndex = DEFAULT_ITEM_ORDER.indexOf(id);
      // Find the nearest item that exists in merged
      let insertAt = merged.length;
      for (let i = defaultIndex - 1; i >= 0; i--) {
        const neighborIdx = merged.indexOf(DEFAULT_ITEM_ORDER[i]);
        if (neighborIdx !== -1) {
          insertAt = neighborIdx + 1;
          break;
        }
      }
      merged.splice(insertAt, 0, id);
    }
    return merged;
  }, [prefs.order]);

  const setOrder = useCallback(
    (newOrder: string[]) => {
      setPrefs({ ...prefs, order: newOrder });
    },
    [prefs, setPrefs],
  );

  const toggleGroup = useCallback(
    (groupId: string) => {
      const collapsed = prefs.collapsedGroups.includes(groupId)
        ? prefs.collapsedGroups.filter((g) => g !== groupId)
        : [...prefs.collapsedGroups, groupId];
      setPrefs({ ...prefs, collapsedGroups: collapsed });
    },
    [prefs, setPrefs],
  );

  const toggleItemVisibility = useCallback(
    (itemId: string) => {
      const hidden = prefs.hiddenItems.includes(itemId)
        ? prefs.hiddenItems.filter((i) => i !== itemId)
        : [...prefs.hiddenItems, itemId];
      setPrefs({ ...prefs, hiddenItems: hidden });
    },
    [prefs, setPrefs],
  );

  const isGroupCollapsed = useCallback(
    (groupId: string) => prefs.collapsedGroups.includes(groupId),
    [prefs.collapsedGroups],
  );

  const isItemHidden = useCallback(
    (itemId: string) => prefs.hiddenItems.includes(itemId),
    [prefs.hiddenItems],
  );

  const resetToDefaults = useCallback(() => {
    setPrefs(DEFAULTS);
  }, [setPrefs]);

  return {
    order,
    collapsedGroups: prefs.collapsedGroups,
    hiddenItems: prefs.hiddenItems,
    setOrder,
    toggleGroup,
    toggleItemVisibility,
    isGroupCollapsed,
    isItemHidden,
    resetToDefaults,
  } as const;
}
