import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { vocabularyTypes, type VocabularyWord } from "@/lib/english/vocabulary";

export const statusLabels = { inbox: "待学习", learning: "学习中", review: "待复习", error: "需巩固", stable: "稳定" };
export default function VocabularyLibrary({ words, loading, archived = false }: { words: VocabularyWord[]; loading: boolean; archived?: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [search, filter, type]);
  const filtered = words.filter(w => (archived || filter === "archived" ? !!w.archived : !w.archived)
    && (!type || w.type === type)
    && (!filter || filter === "archived" || w.status === filter || w.level === filter
      || (filter === "familiar" && w.type === "familiar")
      || (filter === "errors" && w.error_count > 0)
      || (filter === "listening" && (w.type === "listening" || !!w.listening_status && w.listening_status !== "unknown")))
    && `${w.word} ${w.meaning} ${w.sources.map(s => s.name).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 40) - 1));
  const control = "min-h-11 min-w-0 rounded-lg border border-border p-3 bg-card text-sm";
  return <section className="space-y-4 min-w-0">
    <input aria-label="搜索词汇" placeholder="搜索词汇、释义或来源" value={search} onChange={ev => setSearch(ev.target.value)} className={`${control} w-full`} />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <select aria-label="学习状态筛选" className={control} value={filter} onChange={ev => setFilter(ev.target.value)}>
        {[["", "All · 全部"], ["inbox", "New · 待学习"], ["learning", "Learning · 学习中"], ["stable", "Stable · 稳定"], ...["R0", "R1", "R2", "P1", "P2"].map(l => [l, l]), ["familiar", "熟词生义"], ["listening", "听力"], ["errors", "错词"], ...(!archived ? [["archived", "已归档"]] : [])].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="分类筛选" className={control} value={type} onChange={ev => setType(ev.target.value)}><option value="">全部分类</option>{Object.entries(vocabularyTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    </div>
    {loading ? <p role="status" className="py-8 text-sm">正在加载词库…</p> : <>
      <p className="text-xs text-ink-light">{filtered.length} 个词汇</p>
      {filtered.length === 0 && <p className="rounded-lg bg-card p-6 text-sm text-ink-light">暂无符合条件的词汇。可以调整筛选或导入词表。</p>}
      <div className="space-y-3">{filtered.slice(currentPage * 40, currentPage * 40 + 40).map(w => <VocabularyListItem key={w.id} word={w} />)}</div>
      {filtered.length > 40 && <div className="flex items-center justify-between gap-2"><button className={control} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><span className="text-sm">{currentPage + 1} / {Math.ceil(filtered.length / 40)}</span><button className={control} disabled={(currentPage + 1) * 40 >= filtered.length} onClick={() => setPage(currentPage + 1)}>下一页</button></div>}
    </>}
  </section>;
}

function VocabularyListItem({ word: w }: { word: VocabularyWord }) {
  const due = [w.due_at, w.listening_due_at].filter((v): v is string => !!v).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  return <Link href={`/tem8/vocabulary/word/${encodeURIComponent(w.id)}`} className="w-full rounded-lg bg-card p-5 flex items-center gap-3 hover:bg-card-hover transition-colors focus-visible:outline-sage-deep">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2"><strong className="text-lg break-all">{w.word}</strong><span className="text-xs text-sage-deep rounded bg-sage-light px-2 py-1">{vocabularyTypes[w.type]}</span></div>
      <p className="text-sm text-ink-light mt-2 line-clamp-2 break-words">{w.meaning || "暂无释义"}</p>
      <p className="text-xs text-ink-light mt-3">{w.level} · {w.archived ? "已归档" : statusLabels[w.status]} · {new Set(w.sources.map(s => s.import_id)).size} 个来源</p>
      <p className="text-xs text-ink-lighter mt-1">{w.archived ? "已暂停复习" : due ? Date.parse(due) <= Date.now() ? "已到期，待复习" : `${new Date(due).toLocaleDateString("zh-CN")} 复习` : "尚未安排复习"}</p>
    </div><ChevronRight size={18} className="shrink-0 text-ink-lighter" />
  </Link>;
}
