// ============================================
// Nancy OS — Sidebar Personalization System v1.0
//
// Features:
// - Group-based navigation with collapse/expand
// - Drag-and-drop reorder (native HTML5 DnD, zero deps)
// - Per-item visibility control
// - localStorage persistence (via useSidebarPreferences)
// ============================================

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useSidebarPreferences } from "@/lib/hooks/useSidebarPreferences";
import {
  NAVIGATION_ITEMS,
  GROUP_ORDER,
  GROUP_LABELS,
  type NavigationGroup,
} from "@/config/navigation";
import {
  LayoutDashboard, CalendarCheck, Briefcase, BookOpen, Heart,
  GraduationCap, Footprints, Lightbulb, BarChart3, Brain, Database,
  Settings, Menu, X, Sparkles, FolderOpen, Mic,
  GripVertical, ChevronDown, EyeOff, RotateCcw,
  type LucideIcon,
} from "lucide-react";

// ═══════════════════════════════════════
// Icon map
// ═══════════════════════════════════════

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, CalendarCheck, Briefcase, BookOpen, Heart,
  GraduationCap, Footprints, Lightbulb, BarChart3, Brain, Database,
  Settings, FolderOpen, Mic, Sparkles,
};

// ═══════════════════════════════════════
// Drag-and-Drop Nav Item
// ═══════════════════════════════════════

function DraggableNavItem({
  id,
  label,
  icon,
  path,
  description,
  isActive,
  onNavigate,
}: {
  id: string;
  label: string;
  icon: string;
  path: string;
  description: string;
  isActive: boolean;
  onNavigate: (path: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver, setDragOver] = useState<"above" | "below" | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const Icon = iconMap[icon] || LayoutDashboard;

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
    // Slight delay for the browser to capture the drag image
    requestAnimationFrame(() => {
      if (itemRef.current) {
        itemRef.current.style.opacity = "0.4";
      }
    });
  }, [id]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragOver(null);
    if (itemRef.current) {
      itemRef.current.style.opacity = "";
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // Determine if cursor is in top or bottom half of the item
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setDragOver(e.clientY < midY ? "above" : "below");
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(null);
  }, []);

  return (
    <div ref={itemRef} className="relative group/item">
      {/* Drop indicator: above */}
      {dragOver === "above" && (
        <div className="absolute -top-0.5 left-1 right-1 h-0.5 bg-sage-deep rounded-full z-10" />
      )}
      {/* Drop indicator: below */}
      {dragOver === "below" && (
        <div className="absolute -bottom-0.5 left-1 right-1 h-0.5 bg-sage-deep rounded-full z-10" />
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDragEnd}
        className={cn(
          "rounded-xl transition-colors",
          dragOver && "bg-sage-light/30",
        )}
      >
        <button
          onClick={() => onNavigate(path)}
          className={cn(
            "w-full flex items-center gap-2.5 pl-2 pr-3 py-2.5 rounded-xl text-left transition-all duration-150",
            isActive
              ? "bg-white border border-border/60 shadow-sm"
              : "hover:bg-white/60",
          )}
        >
          {/* Drag handle — shown on hover via group-hover */}
          <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={cn(
              "h-6 w-4 flex items-center justify-center shrink-0 rounded cursor-grab active:cursor-grabbing transition-opacity",
              "opacity-0 group-hover/item:opacity-100",
              isDragging && "opacity-100",
            )}
            title="拖拽排序"
          >
            <GripVertical size={12} className="text-ink-lighter" />
          </div>

          {/* Icon */}
          <div
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
              isActive
                ? "bg-sage-light text-sage-deep"
                : "bg-ink/5 text-ink-light group-hover/item:bg-sage-light/50 group-hover/item:text-sage-deep",
            )}
          >
            <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
          </div>

          {/* Label */}
          <div className="min-w-0">
            <div
              className={cn(
                "text-[13px] font-medium leading-tight",
                isActive ? "text-ink" : "text-ink-light",
              )}
            >
              {label}
            </div>
            <div className="text-[10px] text-ink-lighter leading-tight mt-0.5 truncate">
              {description}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Group Header
// ═══════════════════════════════════════

function GroupHeader({
  groupId,
  label,
  isCollapsed,
  itemCount,
  onToggle,
}: {
  groupId: string;
  label: string;
  isCollapsed: boolean;
  itemCount: number;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-1 py-1.5 group/header"
    >
      <ChevronDown
        size={12}
        className={cn(
          "text-ink-lighter transition-transform shrink-0",
          isCollapsed && "-rotate-90",
        )}
      />
      <span className="text-[10px] font-semibold text-ink-lighter uppercase tracking-widest">
        {label}
      </span>
      {!isCollapsed && (
        <span className="text-[10px] text-ink-lighter/50">({itemCount})</span>
      )}
      <div className="flex-1 h-px bg-border/30 ml-1" />
    </button>
  );
}

// ═══════════════════════════════════════
// Sidebar Settings Modal
// ═══════════════════════════════════════

function SidebarSettingsModal({
  isOpen,
  onClose,
  hiddenItems,
  onToggleItem,
  onReset,
}: {
  isOpen: boolean;
  onClose: () => void;
  hiddenItems: string[];
  onToggleItem: (id: string) => void;
  onReset: () => void;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl border border-border/60 shadow-lg w-full max-w-sm max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <div>
              <h3 className="font-semibold text-ink text-sm">侧边栏设置</h3>
              <p className="text-[11px] text-ink-light mt-0.5">
                管理可见模块和排序 · 拖拽手柄调整顺序
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-warm-cream transition-colors"
            >
              <X size={16} className="text-ink-light" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            {NAVIGATION_ITEMS.map((item) => {
              const isHidden = hiddenItems.includes(item.id);
              const Icon = iconMap[item.icon] || LayoutDashboard;
              return (
                <button
                  key={item.id}
                  onClick={() => onToggleItem(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors",
                    isHidden
                      ? "opacity-40 hover:opacity-70"
                      : "hover:bg-warm-cream",
                  )}
                >
                  <Icon
                    size={14}
                    className={isHidden ? "text-ink-lighter" : "text-sage-deep"}
                  />
                  <span className="text-[13px] flex-1 text-ink">{item.label}</span>
                  <span className="text-[10px] text-ink-lighter">
                    {GROUP_LABELS[item.group]}
                  </span>
                  {isHidden ? (
                    <span className="text-[10px] text-accent-warm ml-1">已隐藏</span>
                  ) : (
                    <EyeOff size={12} className="text-ink-lighter/25 ml-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between">
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-[11px] text-ink-light hover:text-ink transition-colors"
            >
              <RotateCcw size={11} />
              恢复默认
            </button>
            <button
              onClick={onClose}
              className="text-[11px] font-medium text-sage-deep hover:text-sage transition-colors"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════
// Drop Zone (invisible area between groups)
// ═══════════════════════════════════════

function DropZone({
  zoneId,
  onReorder,
  children,
}: {
  zoneId: string;
  onReorder: (fromId: string, toZoneId: string) => void;
  children: React.ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the zone (not entering a child)
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId && draggedId !== zoneId) {
        onReorder(draggedId, zoneId);
      }
    },
    [zoneId, onReorder],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "rounded-xl transition-colors min-h-[2px]",
        dragOver && "bg-sage-light/40 ring-1 ring-sage/30",
      )}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════
// Sidebar Content
// ═══════════════════════════════════════

function SidebarContent({
  location,
  navigate,
  onClose,
}: {
  location: string;
  navigate: (path: string) => void;
  onClose?: () => void;
}) {
  const {
    order,
    collapsedGroups,
    hiddenItems,
    setOrder,
    toggleGroup,
    toggleItemVisibility,
    isGroupCollapsed,
    isItemHidden,
    resetToDefaults,
  } = useSidebarPreferences();

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Build visible items respecting order + hidden + collapsed
  const visibleItems = useMemo(() => {
    const visible: Array<{ id: string; group: NavigationGroup }> = [];
    for (const id of order) {
      if (hiddenItems.includes(id)) continue;
      const config = NAVIGATION_ITEMS.find((i) => i.id === id);
      if (!config) continue;
      if (collapsedGroups.includes(config.group)) continue;
      visible.push({ id, group: config.group });
    }
    return visible;
  }, [order, hiddenItems, collapsedGroups]);

  // Group visible items, inserting group headers
  const groupedVisible = useMemo(() => {
    const result: Array<
      | { type: "group_header"; group: NavigationGroup; label: string; count: number }
      | { type: "item"; id: string; group: NavigationGroup }
    > = [];

    let lastGroup: string | null = null;
    const groupItemCounts: Record<string, number> = {};
    for (const item of NAVIGATION_ITEMS) {
      if (hiddenItems.includes(item.id)) continue;
      groupItemCounts[item.group] = (groupItemCounts[item.group] || 0) + 1;
    }

    for (const v of visibleItems) {
      if (v.group !== lastGroup) {
        result.push({
          type: "group_header",
          group: v.group,
          label: GROUP_LABELS[v.group] || v.group,
          count: groupItemCounts[v.group] || 0,
        });
        lastGroup = v.group;
      }
      result.push({ type: "item", id: v.id, group: v.group });
    }
    return result;
  }, [visibleItems, hiddenItems]);

  // Handle drop: move fromId to just after targetId (or to end if target not found)
  const handleDrop = useCallback(
    (fromId: string, targetId: string) => {
      if (fromId === targetId) return;
      const newOrder = order.filter((id) => id !== fromId);
      const targetIndex = newOrder.indexOf(targetId);
      if (targetIndex === -1) {
        newOrder.push(fromId);
      } else {
        newOrder.splice(targetIndex + 1, 0, fromId);
      }
      setOrder(newOrder);
    },
    [order, setOrder],
  );

  // Handle drop at the end (after last item)
  const handleDropToEnd = useCallback(
    (fromId: string) => {
      const newOrder = order.filter((id) => id !== fromId);
      newOrder.push(fromId);
      setOrder(newOrder);
    },
    [order, setOrder],
  );

  const hiddenCount = hiddenItems.length;

  return (
    <div className="flex flex-col h-full py-5 px-3">
      {/* Header */}
      <div className="flex items-center justify-between px-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-sage-light flex items-center justify-center">
            <Sparkles size={16} className="text-sage-deep" />
          </div>
          <span className="text-base font-semibold tracking-tight text-ink">
            Nancy OS
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-card-hover transition-colors"
          >
            <X size={18} className="text-ink-light" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0 overflow-y-auto">
        {groupedVisible.map((entry, idx) => {
          if (entry.type === "group_header") {
            return (
              <GroupHeader
                key={`header-${entry.group}`}
                groupId={entry.group}
                label={entry.label}
                isCollapsed={isGroupCollapsed(entry.group)}
                itemCount={entry.count}
                onToggle={() => toggleGroup(entry.group)}
              />
            );
          }

          const config = NAVIGATION_ITEMS.find((i) => i.id === entry.id);
          if (!config) return null;

          const isActive =
            config.path === "/"
              ? location === "/"
              : location.startsWith(config.path);

          return (
            <DropZone
              key={entry.id}
              zoneId={entry.id}
              onReorder={handleDrop}
            >
              <DraggableNavItem
                id={entry.id}
                label={config.label}
                icon={config.icon}
                path={config.path}
                description={config.description}
                isActive={isActive}
                onNavigate={(p) => {
                  navigate(p);
                  onClose?.();
                }}
              />
            </DropZone>
          );
        })}

        {/* Final drop zone at end of list */}
        {visibleItems.length > 0 && (
          <EndDropZone onDrop={handleDropToEnd} />
        )}

        {/* Hidden items hint */}
        {hiddenCount > 0 && (
          <div className="mt-2 px-3">
            <p className="text-[10px] text-ink-lighter">
              {hiddenCount} 个模块已隐藏 ·
              <button
                onClick={() => setSettingsOpen(true)}
                className="ml-1 text-sage-deep hover:text-sage transition-colors"
              >
                管理
              </button>
            </p>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="pt-3 px-3 border-t border-border mt-2">
        <div className="flex items-center gap-2.5 justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-accent-warm/20 flex items-center justify-center">
              <span className="text-[11px] font-semibold text-accent-warm">N</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink truncate">Nancy</p>
              <p className="text-[10px] text-ink-lighter">Personal AI OS</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Sidebar settings */}
            <button
              onClick={() => setSettingsOpen(true)}
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                settingsOpen
                  ? "bg-sage-light text-sage-deep"
                  : "text-ink-lighter hover:bg-white/60 hover:text-ink-light",
              )}
              title="侧边栏设置"
            >
              <EyeOff size={14} />
            </button>
            {/* App settings */}
            <button
              onClick={() => navigate("/settings")}
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                location === "/settings"
                  ? "bg-sage-light text-sage-deep"
                  : "text-ink-lighter hover:bg-white/60 hover:text-ink-light",
              )}
              title="设置"
            >
              <Settings size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Settings Modal */}
      <SidebarSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        hiddenItems={hiddenItems}
        onToggleItem={toggleItemVisibility}
        onReset={resetToDefaults}
      />
    </div>
  );
}

// ═══════════════════════════════════════
// End Drop Zone
// ═══════════════════════════════════════

function EndDropZone({ onDrop }: { onDrop: (fromId: string) => void }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const fromId = e.dataTransfer.getData("text/plain");
        if (fromId) onDrop(fromId);
      }}
      className={cn(
        "h-6 rounded-xl transition-colors",
        dragOver && "bg-sage-light/40 ring-1 ring-sage/30",
      )}
    />
  );
}

// ═══════════════════════════════════════
// Main Sidebar Export
// ═══════════════════════════════════════

export default function Sidebar() {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm hover:bg-card-hover transition-colors"
        aria-label="打开菜单"
      >
        <Menu size={20} className="text-ink" />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={closeMobile}
        />
      )}

      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-warm-cream border-r border-border flex flex-col shadow-2xl transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent location={location} navigate={navigate} onClose={closeMobile} />
      </aside>

      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 bg-warm-cream border-r border-border flex-col">
        <SidebarContent location={location} navigate={navigate} />
      </aside>
    </>
  );
}
