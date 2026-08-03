import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  stat: string;
  statDetail: string;
  color: string;
  iconColor: string;
  path: string;
}

export function ModuleCard({ icon: Icon, label, stat, statDetail, color, iconColor, path }: ModuleCardProps) {
  return (
    <a
      href={path}
      onClick={(e) => {
        e.preventDefault();
        window.history.pushState({}, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
      className={cn(
        "rounded-2xl p-4 flex items-start gap-3 border border-border bg-card",
        "hover:shadow-sm hover:border-sage-light/30 transition-all cursor-pointer",
      )}
    >
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        <p className="text-xs text-ink-light mt-0.5">{stat}</p>
        <p className="text-[10px] text-ink-lighter">{statDetail}</p>
      </div>
    </a>
  );
}
