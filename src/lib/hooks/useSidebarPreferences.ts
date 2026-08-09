// ============================================
// Nancy OS — useSidebarPreferences (v2)
// localStorage-backed sidebar personalization
// with structural normalization to prevent
// stale/corrupt data from breaking the sidebar.
// ============================================

import { useUIPreference } from "@/lib/hooks/useUIPreference";
import { useCallback, useMemo } from "react";
import { DEFAULT_ITEM_ORDER, GROUP_ORDER } from "@/config/navigation";

export interface SidebarPreferences {
  order: string[];
  collapsedGroups: string[];
  hiddenItems: string[];
}

const DEFAULTS: SidebarPreferences = {
  order: DEFAULT_ITEM_ORDER,
  collapsedGroups: [],
  hiddenItems: [],
};

const VALID_IDS = new Set(DEFAULT_ITEM_ORDER);
const VALID_GROUPS: Set<string> = new Set(GROUP_ORDER);

/**
 * Normalize preferences read from localStorage.
 * Guards against: wrong types, stale IDs, duplicate entries, impossible states.
 */
function normalize(prefs: unknown): SidebarPreferences {
  if (!prefs || typeof prefs !== "object") return DEFAULTS;

  const p = prefs as Record<string, unknown>;

  // Validate & sanitize order
  let order: string[] = [];
  if (Array.isArray(p.order)) {
    const seen = new Set<string>();
    for (const id of p.order) {
      if (typeof id === "string" && VALID_IDS.has(id) && !seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    }
  }
  // Merge missing items
  for (const id of DEFAULT_ITEM_ORDER) {
    if (!order.includes(id)) {
      order.push(id);
    }
  }

  // Validate & sanitize collapsedGroups
  let collapsedGroups: string[] = [];
  if (Array.isArray(p.collapsedGroups)) {
    collapsedGroups = [...new Set(
      p.collapsedGroups.filter(
        (g): g is string => typeof g === "string" && VALID_GROUPS.has(g)
      )
    )];
  }

  // Validate & sanitize hiddenItems
  let hiddenItems: string[] = [];
  if (Array.isArray(p.hiddenItems)) {
    // Don't allow hiding ALL items — keep at least 3 visible
    const validHidden = [...new Set(
      p.hiddenItems.filter(
        (id): id is string => typeof id === "string" && VALID_IDS.has(id)
      )
    )];
    if (validHidden.length < DEFAULT_ITEM_ORDER.length - 3) {
      hiddenItems = validHidden;
    }
    // else: too many hidden — revert to empty (safety valve)
  }

  return { order, collapsedGroups, hiddenItems };
}

export function useSidebarPreferences() {
  const [rawPrefs, setRawPrefs] = useUIPreference<SidebarPreferences>(
    "sidebar_v1",
    DEFAULTS,
  );

  // Normalize on every read — catches stale/corrupt localStorage data
  const prefs = useMemo(() => normalize(rawPrefs), [rawPrefs]);

  const order = useMemo(() => {
    // Already normalized — just ensure no missing items
    const merged = [...prefs.order];
    for (const id of DEFAULT_ITEM_ORDER) {
      if (!merged.includes(id)) {
        merged.push(id);
      }
    }
    return merged;
  }, [prefs.order]);

  const setOrder = useCallback(
    (newOrder: string[]) => {
      setRawPrefs({ ...prefs, order: newOrder });
    },
    [prefs, setRawPrefs],
  );

  const toggleGroup = useCallback(
    (groupId: string) => {
      const collapsed = prefs.collapsedGroups.includes(groupId)
        ? prefs.collapsedGroups.filter((g) => g !== groupId)
        : [...prefs.collapsedGroups, groupId];
      setRawPrefs({ ...prefs, collapsedGroups: collapsed });
    },
    [prefs, setRawPrefs],
  );

  const toggleItemVisibility = useCallback(
    (itemId: string) => {
      const hidden = prefs.hiddenItems.includes(itemId)
        ? prefs.hiddenItems.filter((i) => i !== itemId)
        : [...prefs.hiddenItems, itemId];
      setRawPrefs({ ...prefs, hiddenItems: hidden });
    },
    [prefs, setRawPrefs],
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
    setRawPrefs(DEFAULTS);
  }, [setRawPrefs]);

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
