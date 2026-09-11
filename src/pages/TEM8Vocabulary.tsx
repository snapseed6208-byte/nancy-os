import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { Upload } from "lucide-react";
import { HubHeader } from "@/components/english/EnglishHubUI";
import { useVocabulary } from "@/lib/hooks/useVocabulary";
import { getSavedLearnTarget, saveLearnTarget } from "@/lib/hooks/useReviewSession";
import { parseFile } from "@/lib/parsers/fileParsers";
import { dailyVocabularyQueue, type VocabularyImport, type VocabularyReject } from "@/lib/english/vocabulary";
import VocabularyHub from "@/components/english/vocabulary/VocabularyHub";
import VocabularyLibrary from "@/components/english/vocabulary/VocabularyLibrary";
import VocabularyWordDetail from "@/components/english/vocabulary/VocabularyWordDetail";
import VocabularyInbox, { sourceKinds } from "@/components/english/vocabulary/VocabularyInbox";
import VocabularyProgress from "@/components/english/vocabulary/VocabularyProgress";

const button = "min-h-11 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40 hover:bg-sage-light/30";
const titles: Record<string, string> = { "": "专八词汇", today: "今日学习", review: "到期复习", library: "全部词汇", import: "导入词汇", errors: "错词本", listening: "听力专项", analytics: "学习分析", archive: "已归档" };
export default function TEM8Vocabulary() {
  const model = useVocabulary();
  const [location, navigate] = useLocation();
  const view = location.replace(/^\/tem8\/vocabulary\/?/, "").replace(/\/$/, "");
  const wordId = view.startsWith("word/") ? decodeURIComponent(view.slice(5)) : null;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rejects, setRejects] = useState<VocabularyReject[]>([]);
  const [sourceKind, setSourceKind] = useState("vocabulary");
  const [target, setTarget] = useState(() => { try { return localStorage.getItem("english_learning_target") ? getSavedLearnTarget() : 25; } catch { return 25; } });
  const stop = useRef(false);
  const mounted = useRef(true);
  const plannedDay = useRef("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current = true; }; }, []);
  useEffect(() => { window.scrollTo?.(0, 0); }, [location]);
  const words = model.words.data || [];
  const queue = dailyVocabularyQueue(words, model.plan.data);
  useEffect(() => {
    if (view !== "today" || busy || !words.length || model.plan.isLoading || model.plan.isError || model.plan.data || plannedDay.current === model.day) return;
    plannedDay.current = model.day;
    void model.startDay.mutateAsync(target).catch(e => setError(e.message || "今日名单生成失败，可手动重试"));
  }, [model.day, model.plan.data, model.plan.isLoading, model.plan.isError, words.length, busy, view]);
  async function run(action:()=>Promise<unknown>){setError("");try{await action();}catch(e){setError((e as Error).message||"操作失败，请重试");}}
  async function processImport(imp:VocabularyImport){
    setBusy(true);stop.current=false;setRejects([]);
    let saved=0;const rejected:VocabularyReject[]=[];
    try{
      for(let i=0;i<imp.chunk_count;i++){
        if(stop.current) break;if(imp.completed_chunks.includes(i)) continue;
        setMessage(`正在提取 ${imp.name}：第 ${i+1} / ${imp.chunk_count} 批`);
        const data=await model.ai.mutateAsync({action:"extract",importId:imp.id,chunk:i});
        saved+=data?.saved||0;
        rejected.push(...(data?.rejected||[]));
        if(mounted.current&&rejected.length) setRejects([...rejected]);
      }
      if(mounted.current) setMessage(stop.current
        ? `已暂停；完成批次保留，可继续导入。已保存 ${saved} 条${rejected.length?`，${rejected.length} 条被拒绝`:"."}`
        : `导入完成：新增／合并 ${saved} 条${rejected.length?`，${rejected.length} 条被拒绝（见下方原因）`:"。"}可生成今日名单，打开词卡时自动加工学习内容。`);
    }finally{if(mounted.current){setBusy(false);void model.refresh();}}
  }
  async function importText(name:string,text:string,kind:string){
    if(!text.trim()||text.length>1000000) throw new Error("请输入材料，单次不超过 100 万字符");
    const imp=await model.createImport.mutateAsync({name,text,kind});await processImport(imp);
  }
  async function upload(file:File){
    setBusy(true);
    try{
      if(!/\.(pdf|txt|md)$/i.test(file.name)) throw new Error("请选择 PDF、TXT 或 Markdown 文件");
      if(file.size>20*1024*1024) throw new Error("文件上限 20MB，请拆分后导入");
      setMessage("正在读取文件文字…");const result=await parseFile(file);
      if(result.warning||!result.text.trim()) throw new Error(result.warning||"未提取到文字");
      await importText(file.name,result.text,sourceKind);
    }finally{if(mounted.current) setBusy(false);}
  }

  function exportWords(){
    const blob=new Blob([JSON.stringify({format:"nancy-tem8-vocabulary",version:2,exported_at:new Date().toISOString(),words},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`tem8-vocabulary-${model.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  const loadError = model.words.error || model.imports.error || model.plan.error || (view === "analytics" && (model.dashboard.error || model.history.error));
  const current = words.find(w => w.id === wordId);
  const listWords = view === "today" ? queue : view === "review" ? dailyVocabularyQueue(words, null) : view === "errors" ? words.filter(w => w.error_count > 0) : view === "listening" ? words.filter(w => w.type === "listening" || !!w.listening_status && w.listening_status !== "unknown") : words;
  return <div className="space-y-6 min-w-0 [overflow-wrap:anywhere]">
    <HubHeader namespace="TEM8 OS" title={wordId ? "词汇详情" : titles[view] || "页面未找到"} subtitle={view === "" ? "真题词汇 · 熟词生义 · 间隔复习" : wordId ? "理解语境，再练习运用" : "专八词汇"} onBack={() => navigate(wordId ? "/tem8/vocabulary/library" : view ? "/tem8/vocabulary" : "/tem8")} backLabel={wordId ? "返回全部词汇" : view ? "返回 Vocabulary" : "返回 TEM8 OS"} />
    {(error || loadError) && <div role="alert" className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error || (loadError && loadError.message)}<button className="ml-3 underline min-h-11" onClick={() => void model.refresh()}>重新加载</button></div>}
    {view === "" ? <VocabularyHub model={model} busy={busy} /> : wordId ? <>
      {current ? <VocabularyWordDetail key={current.id} word={current} model={model} /> : <p className="rounded-lg bg-card p-6 text-sm">{model.words.isLoading ? "正在加载词条…" : model.words.isError ? "词条加载失败，请重试。" : "未找到该词条，请返回词库。"}</p>}
    </> : view === "import" ? <>
      <section className="rounded-lg bg-card p-4 space-y-3">
        <h2 className="font-semibold">导入 PDF 或文本文件</h2>
        <select aria-label="文件来源类型" className="w-full min-h-11 rounded-lg border border-border bg-card p-2 text-sm" value={sourceKind} onChange={ev => setSourceKind(ev.target.value)}>{Object.entries(sourceKinds).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
        <div className="flex flex-wrap gap-2">
          <label className={button + " inline-flex gap-2 items-center cursor-pointer"}><Upload size={16}/>{busy ? "处理中…" : "导入 PDF"}<input aria-label="导入词汇文件" type="file" accept=".pdf,.txt,.md" disabled={busy || model.ai.isPending} className="sr-only" onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ""; if(f) void run(() => upload(f)); }}/></label>
          <button disabled={!words.length} className={button} onClick={exportWords}>导出词库</button>
          {busy && <button className={button} onClick={() => { stop.current = true; setMessage("当前批次完成后暂停…"); }}>暂停导入</button>}
        </div>
      </section>
      {message && <p role="status" className="text-sm text-sage-deep">{message}</p>}
    {rejects.length>0&&<details className="rounded-lg border border-border p-3 text-sm"><summary className="cursor-pointer text-ink-light">被拒绝的词条（{rejects.length}）</summary><ul className="mt-2 space-y-1 text-xs text-ink-lighter">{rejects.slice(0,200).map((r,i)=><li key={`${r.span_id}-${r.index}-${i}`}>第 {r.span_id?.split(":")[0]??"?"} 批 · 条目 {r.index} · {r.span_id??"无 span"} · {r.field} · {r.reason}</li>)}</ul></details>}
      <VocabularyInbox imports={model.imports.data || []} busy={busy} onResume={processImport} onText={importText} onCapture={async body => { const data = await model.capture.mutateAsync(body); navigate("/tem8/vocabulary/word/" + encodeURIComponent(data.wordId)); }} />
    </> : view === "analytics" ? <VocabularyProgress dashboard={model.dashboard.data} history={model.history.data || []} words={words} onWord={id => navigate("/tem8/vocabulary/word/" + encodeURIComponent(id))} /> : view in titles ? <>
      {view === "today" && <section className="rounded-lg bg-sage-light/25 p-5 space-y-3">
        <h2 className="font-medium">{model.day} · 今日安排</h2>
        {model.plan.data ? <p className="text-sm text-ink-light">阅读识别 {model.plan.data.new_ids.length} · 语境掌握 {model.plan.data.familiar_ids.length} · 提示输出 {model.plan.data.production_ids.length}{queue.length === 0 && " · 今日学习已完成"}</p> : <div className="flex flex-wrap items-center gap-3"><label className="text-sm">每日词数 <input aria-label="每日新词名额" type="number" min={0} max={100} value={target} onChange={ev => setTarget(Math.max(0, Math.min(100, Number(ev.target.value))))} className="w-20 ml-2 p-2 border border-border rounded-lg" /></label><button disabled={model.startDay.isPending || !words.length} className={button} onClick={() => void run(async () => { if(target >= 1 && target <= 30) saveLearnTarget(target); await model.startDay.mutateAsync(target); })}>生成今日学习</button></div>}
        <p className="text-xs text-ink-lighter">系统按每个词的学习目标与当前进度自动安排内容与题型，打开词卡直接作答即可，不必自己选择测试类型。名单跨设备保存，刷新不增加新词；到期复习独立加入。</p>
      </section>}
      <VocabularyLibrary key={view} words={listWords} loading={model.words.isLoading} archived={view === "archive"} />
    </> : <Link href="/tem8/vocabulary" className="text-sage-deep">返回 Vocabulary</Link>}
  </div>;
}
