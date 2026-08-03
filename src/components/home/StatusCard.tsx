import type { ComponentType } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusCardProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
  path: string;
}

export function StatusCard({ icon: Icon, label, value, sub, color, bg, path }: StatusCardProps) {
  return (
    <a
      href={path}
      onClick={(e) => {
        e.preventDefault();
        window.history.pushState({}, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
      className={cn(
        "rounded-2xl p-3.5 flex flex-col gap-1.5 group",
        "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
        "cursor-pointer",
        bg,
      )}
    >
      <div className="flex items-center justify-between">
        <Icon size={16} className={color} />
        <span className="text-[9px] text-ink-lighter opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          查看 <ChevronRight size={9} />
        </span>
      </div>
      <div>
        <p className="text-lg font-bold text-ink">{value}</p>
        <p className="text-[11px] font-medium text-ink-light">{label}</p>
        <p className="text-[10px] text-ink-lighter mt-0.5">{sub}</p>
      </div>
    </a>
  );
}
