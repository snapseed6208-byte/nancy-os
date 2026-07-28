import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { NAV_ITEMS } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarCheck,
  Briefcase,
  BookOpen,
  Heart,
  GraduationCap,
  Footprints,
  Lightbulb,
  BarChart3,
  Brain,
  Database,
  Settings,
  Menu,
  X,
  Sparkles,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  CalendarCheck,
  Briefcase,
  BookOpen,
  Heart,
  GraduationCap,
  Footprints,
  Lightbulb,
  BarChart3,
  Brain,
  Database,
  FolderOpen,
  Settings,
};

export default function Sidebar() {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Close drawer on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm hover:bg-card-hover transition-colors"
        aria-label="打开菜单"
      >
        <Menu size={20} className="text-ink" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={closeMobile}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-warm-cream border-r border-border flex flex-col shadow-2xl transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent location={location} navigate={navigate} onClose={closeMobile} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 bg-warm-cream border-r border-border flex-col">
        <SidebarContent location={location} navigate={navigate} />
      </aside>
    </>
  );
}

function SidebarContent({
  location,
  navigate,
  onClose,
}: {
  location: string;
  navigate: (path: string) => void;
  onClose?: () => void;
}) {
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
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/"
              ? location === "/"
              : location.startsWith(item.path);
          const Icon = iconMap[item.icon];

          return (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group",
                isActive
                  ? "bg-white border border-border/60 shadow-sm"
                  : "hover:bg-white/60",
              )}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isActive
                    ? "bg-sage-light text-sage-deep"
                    : "bg-ink/5 text-ink-light group-hover:bg-sage-light/50 group-hover:text-sage-deep",
                )}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-[13px] font-medium leading-tight",
                    isActive ? "text-ink" : "text-ink-light",
                  )}
                >
                  {item.label}
                </div>
                <div className="text-[10px] text-ink-lighter leading-tight mt-0.5 truncate">
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
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
  );
}
