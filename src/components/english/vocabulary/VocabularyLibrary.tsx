import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { currentLevel, levelLabels, statusLabels, targetLabels, targetLevel, vocabularyTypes, type VocabularyWord } from "@/lib/english/vocabulary";

// Three independent dimensions — 学习状态 / 学习目标 / 分类. They used to be one combined select
// that mixed status, R0..P2 codes and specialty tags, so a single choice could not be read back.
// Internal codes stay in the DB; the list only ever shows targetLabels.
export default function VocabularyLibrary({ words, loading, archived = false }: { words: VocabularyWord[]; loading: boolean; archived?: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(archived ? "archived" : "");
  const [goal, setGoal] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [search, status, goal, tag]);
  useEffect(() => { if (archived) setStatus("archived"); }, [archived]);
  const wantArchived = archived || status === "archived";
  const filtered = words.filter(w => {
    if (!!w.archived !== wantArchived) return false;
    if (status === "new" && w.status !== "inbox") return false;
    if (status === "learning" && !["learning", "review", "error"].includes(w.status)) return false;
    if (status === "stable" && w.status !== "stable") return false;
    if (goal && targetLevel(w) !== goal) return false;
    if (tag === "errors" ? w.error_count <= 0 : !!tag && w.type !== tag) return false;
    return `${w.word} ${w.meaning} ${w.sources.map(s => s.name).join(" ")}`.toLowerCase().includes(search.toLowerCase());
  });
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 40) - 1));
  const control = "min-h-11 min-w-0 rounded-lg border border-border p-3 bg-card text-sm";
  return <section className="space-y-4 min-w-0">
    <input aria-label="搜索词汇" placeholder="搜索词汇、释义或来源" value={search} onChange={ev => setSearch(ev.target.value)} className={`${control} w-full`} />
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <label className="block text-xs text-ink-light">学习状态<select aria-label="学习状态" className={`${control} mt-1 w-full`} value={status} onChange={ev => setStatus(ev.target.value)}><option value="">全部</option><option value="new">待学习</option><option value="learning">学习中</option><option value="stable">已掌握</option>{!archived && <option value="archived">已归档</option>}</select></label>
      <label className="block text-xs text-ink-light">学习目标<select aria-label="学习目标筛选" className={`${control} mt-1 w-full`} value={goal} onChange={ev => setGoal(ev.target.value)}><option value="">全部</option>{Object.entries(targetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block text-xs text-ink-light">分类<select aria-label="分类筛选" className={`${control} mt-1 w-full`} value={tag} onChange={ev => setTag(ev.target.value)}><option value="">全部</option>{Object.entries(vocabularyTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="errors">错词</option></select></label>
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
      <p className="text-xs text-ink-light mt-3">当前 {levelLabels[currentLevel(w)]} · 目标 {targetLabels[targetLevel(w)]} · {statusLabels[w.archived ? "archived" : w.status]} · {new Set(w.sources.map(s => s.import_id)).size} 个来源</p>
      <p className="text-xs text-ink-lighter mt-1">{w.archived ? "已暂停复习" : due ? Date.parse(due) <= Date.now() ? "已到期，待复习" : `${new Date(due).toLocaleDateString("zh-CN")} 复习` : "尚未安排复习"}</p>
    </div><ChevronRight size={18} className="shrink-0 text-ink-lighter" />
  </Link>;
}
