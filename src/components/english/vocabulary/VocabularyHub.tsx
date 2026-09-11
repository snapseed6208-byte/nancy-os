import { useLocation } from "wouter";
import { Archive, BarChart3, BookOpen, Brain, Headphones, Library, Upload, BookX } from "lucide-react";
import { HubLink, HubStat } from "@/components/english/EnglishHubUI";
import type { useVocabulary } from "@/lib/hooks/useVocabulary";
import { dailyVocabularyQueue } from "@/lib/english/vocabulary";

export default function VocabularyHub({ model, busy }: { model: ReturnType<typeof useVocabulary>; busy: boolean }) {
  const [, navigate] = useLocation();
  const words = model.words.data || [];
  const queue = dailyVocabularyQueue(words, model.plan.data);
  const ready = !model.words.isLoading && !model.words.isError && !model.plan.isLoading && !model.plan.isError;
  const pendingImport = model.imports.data?.find(imp => imp.completed_chunks.length < imp.chunk_count);
  const go = (path: string) => navigate(`/tem8/vocabulary/${path}`);
  return <>
    <section aria-label="词汇概览" className="grid grid-cols-3 rounded-lg border border-border bg-card py-4">
      <HubStat label="总词汇" value={ready ? words.filter(w => !w.archived).length : "—"} />
      <HubStat label="今日待学" value={ready ? queue.length : "—"} />
      <HubStat label="到期复习" value={ready ? dailyVocabularyQueue(words, null).length : "—"} />
    </section>
    <section className="rounded-lg bg-sage-light/35 p-5 space-y-3">
      <h2 className="font-semibold">今日学习</h2>
      {!ready ? <p className="text-sm text-ink-light">正在获取今日安排…</p> : queue.length > 0 ? <>
        <p className="text-sm text-ink-light">{queue.length} 个词汇等待学习或复习</p>
        <button className="min-h-11 w-full sm:w-auto px-5 rounded-lg bg-sage-deep text-white text-sm font-semibold" onClick={() => go("today")}>开始今日学习</button>
      </> : <p className="text-sm text-sage-deep">{model.plan.data ? "今日学习已完成" : words.length ? "尚未安排今日新词，可在今日学习中生成名单。" : "导入第一份词表，开始积累专八词汇。"}</p>}
    </section>
    {pendingImport && <section aria-label="导入进度" className="rounded-lg bg-card p-4 flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1"><h2 className="text-sm font-medium">{busy ? "正在导入" : "导入待继续"}</h2><p className="text-sm break-all mt-1">{pendingImport.name}</p><p className="text-xs text-ink-light mt-1">{pendingImport.completed_chunks.length} / {pendingImport.chunk_count} 批</p></div>
      <button className="min-h-11 text-sm text-sage-deep px-2" onClick={() => go("import")}>查看详情</button>
    </section>}
    <section aria-label="词汇功能" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {([
        ["today", BookOpen, "今日学习", "查看每日安排与学习进度"],
        ["review", Brain, "到期复习", "巩固今天到期的词汇"],
        ["library", Library, "全部词汇", "搜索、筛选和浏览个人词库"],
        ["import", Upload, "导入词汇", "PDF、粘贴词表与手动摘录"],
        ["errors", BookX, "错词本", "回顾错因，用新语境再测"],
        ["listening", Headphones, "听力专项", "练习辨音与词汇识别"],
        ["analytics", BarChart3, "学习分析", "分层能力与测试记录"],
        ["archive", Archive, "已归档", "查看或恢复暂不学习的词汇"],
      ] as const).map(([path, icon, title, description]) => <HubLink key={path} icon={icon} title={title} description={description} onClick={() => go(path)} />)}
    </section>
  </>;
}
