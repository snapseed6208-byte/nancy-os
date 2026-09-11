import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function HubHeader({ title, subtitle, onBack, namespace = "English OS", backLabel = "返回 English OS" }: { title: string; subtitle: string; onBack?: () => void; namespace?: string; backLabel?: string }) {
  return (
    <header className="flex items-center gap-3">
      {onBack && (
        <button type="button" onClick={onBack} aria-label={backLabel} title={backLabel} className="h-11 w-11 shrink-0 rounded-lg bg-ink/5 flex items-center justify-center hover:bg-ink/10">
          <ArrowLeft size={17} />
        </button>
      )}
      <div className="min-w-0">
        <p className="text-xs text-ink-lighter">{namespace}</p>
        <h1 className="text-2xl font-semibold mt-0.5">{title}</h1>
        <p className="text-sm text-ink-light mt-1">{subtitle}</p>
      </div>
    </header>
  );
}

export function HubLink({ icon: Icon, title, description, onClick, tone = "plain" }: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  tone?: "plain" | "sage" | "blue" | "rose";
}) {
  const tones = {
    plain: "bg-ink/5 text-ink-light",
    sage: "bg-sage-light text-sage-deep",
    blue: "bg-blue-50 text-blue-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <button type="button" onClick={onClick} className="w-full min-w-0 rounded-lg border border-border bg-card p-4 flex items-center gap-3 text-left hover:border-ink/20 transition-colors">
      <span className={cn("h-10 w-10 shrink-0 rounded-lg flex items-center justify-center", tones[tone])}><Icon size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-lighter mt-0.5 leading-relaxed">{description}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-lighter" />
    </button>
  );
}

export function HubStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 border-l border-border first:border-l-0 px-2 sm:px-4">
      <p className="text-lg font-semibold text-ink truncate">{value}</p>
      <p className="text-[11px] text-ink-lighter mt-0.5 truncate">{label}</p>
    </div>
  );
}
