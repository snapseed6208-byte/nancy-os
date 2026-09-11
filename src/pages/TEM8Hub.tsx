import { useLocation } from "wouter";
import { BookOpen } from "lucide-react";
import { HubHeader, HubLink } from "@/components/english/EnglishHubUI";

export default function TEM8Hub() {
  const [, navigate] = useLocation();
  return <div className="space-y-6 min-w-0">
    <HubHeader namespace="Nancy OS" title="TEM8 OS" subtitle="专八备考" onBack={() => navigate("/")} backLabel="返回 Nancy OS" />
    <p className="text-sm text-ink-light">词汇 · 听力 · 阅读 · 语言运用 · 翻译 · 写作</p>
    <section aria-labelledby="tem8-current" className="space-y-3">
      <h2 id="tem8-current" className="text-lg font-semibold">当前模块</h2>
      <HubLink icon={BookOpen} title="Vocabulary" description="Available · 今日词汇与间隔复习" tone="sage" onClick={() => navigate("/tem8/vocabulary")} />
    </section>
    <section aria-labelledby="tem8-soon" className="space-y-3">
      <h2 id="tem8-soon" className="text-sm font-medium text-ink-light">Coming Soon</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {["Listening", "Reading", "Language Usage", "Translation", "Writing", "Error Bank"].map(title =>
          <button key={title} disabled className="rounded-lg bg-ink/5 p-5 text-left text-ink-light"><span className="block font-medium">{title}</span><span className="block text-xs mt-1">Coming Soon</span></button>)}
      </div>
    </section>
  </div>;
}
