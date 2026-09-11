import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { BookOpen, Upload, Loader2 } from "lucide-react";
import { useVocabulary } from "@/lib/hooks/useVocabulary";
import { getSavedLearnTarget, saveLearnTarget } from "@/lib/hooks/useReviewSession";
import { parseFile } from "@/lib/parsers/fileParsers";
import { dailyVocabularyQueue, vocabularyTypes, type VocabularyImport, type VocabularyQuestion, type TestMode } from "@/lib/english/vocabulary";
import VocabularyCard from "@/components/english/vocabulary/VocabularyCard";
import VocabularyPractice from "@/components/english/vocabulary/VocabularyPractice";
import VocabularyInbox, { sourceKinds } from "@/components/english/vocabulary/VocabularyInbox";
import VocabularyProgress from "@/components/english/vocabulary/VocabularyProgress";

const button="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40 hover:bg-sage-light/30";
const statusLabels={inbox:"待学习",learning:"学习中",review:"待复习",error:"需巩固",stable:"稳定"};
const tabs={today:"今日学习",review:"到期复习",all:"全部词汇",familiar:"熟词生义",listening:"听力专项",error:"错词本",inbox:"导入收件箱",progress:"学习分析",archived:"已归档"} as const;
export default function EnglishVocabulary() {
  const model=useVocabulary();
  const [tab,setTab]=useState<keyof typeof tabs>("today");
  const [search,setSearch]=useState("");const [type,setType]=useState("");const [selected,setSelected]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
  const [sourceKind,setSourceKind]=useState("vocabulary");
  const [target,setTarget]=useState(()=>{try{return localStorage.getItem("english_learning_target") ? getSavedLearnTarget() : 25;}catch{return 25;}});
  const [test,setTest]=useState<VocabularyQuestion|null>(null);
  const stop=useRef(false);const mounted=useRef(true);
  const plannedDay=useRef("");
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
  const words=model.words.data||[];
  const current=words.find(w=>w.id===selected);
  const queue=dailyVocabularyQueue(words,model.plan.data);
  const filtered=(tab==="today" ? queue : tab==="review" ? dailyVocabularyQueue(words,null) : words).filter(w=>(tab==="archived" ? !!w.archived : !w.archived)&&
    (tab!=="familiar"||w.type==="familiar")&&(tab!=="error"||w.error_count>0)&&
    (tab!=="listening"||w.type==="listening"||w.listening_status!==undefined&&w.listening_status!=="unknown")&&
    (!type||w.type===type)&&`${w.word} ${w.meaning} ${w.sources.map(s=>s.name).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const [page,setPage]=useState(0);
  useEffect(()=>setPage(0),[tab,search,type]);
  useEffect(()=>{
    if(tab!=="today"||busy||!words.length||model.plan.isLoading||model.plan.isError||model.plan.data||plannedDay.current===model.day) return;
    plannedDay.current=model.day;
    void model.startDay.mutateAsync(target).catch(e=>setError(e.message||"今日名单生成失败，可手动重试"));
  },[model.day,model.plan.data,model.plan.isLoading,model.plan.isError,words.length,busy,tab]);
  async function run(action:()=>Promise<unknown>){setError("");try{await action();}catch(e){setError((e as Error).message||"操作失败，请重试");}}
  async function processImport(imp:VocabularyImport){
    setBusy(true);stop.current=false;
    try{
      for(let i=0;i<imp.chunk_count;i++){
        if(stop.current) break;if(imp.completed_chunks.includes(i)) continue;
        setMessage(`正在提取 ${imp.name}：第 ${i+1} / ${imp.chunk_count} 批`);
        await model.ai.mutateAsync({action:"extract",importId:imp.id,chunk:i});
      }
      if(mounted.current) setMessage(stop.current ? "已暂停；完成批次保留，可继续导入。" : "导入完成。可生成今日名单，打开词卡时自动加工学习内容。");
    }finally{if(mounted.current){setBusy(false);void model.refresh();}}
  }
  async function importText(name:string,text:string,kind:string){
    if(!text.trim()||text.length>1000000) throw new Error("请输入材料，单次不超过 100 万字符");
    const imp=await model.createImport.mutateAsync({name,text,kind});setTab("inbox");await processImport(imp);
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
  async function startTest(mode:TestMode){if(!current)return;setError("");setTest(await model.question.mutateAsync({wordId:current.id,mode}));}
  function exportWords(){
    const blob=new Blob([JSON.stringify({format:"nancy-tem8-vocabulary",version:2,exported_at:new Date().toISOString(),words},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`tem8-vocabulary-${model.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const loadError=model.words.error||model.imports.error||model.plan.error||model.dashboard.error||model.history.error;
  return <div className="space-y-5 min-w-0">
    <header><Link href="/english" className="text-sm text-ink-lighter">← 英语学习</Link><h1 className="text-2xl font-semibold mt-3 flex gap-2 items-center"><BookOpen size={24}/>专八词汇</h1><p className="text-sm text-ink-light mt-2">提取 · 语境学习 · 分层测试 · 间隔复习 · 错因迁移</p></header>
    <div className="flex flex-wrap gap-3 items-center rounded-lg bg-sage-light/30 border border-border p-4">
      <span className="text-sm flex-1">{words.filter(w=>!w.archived).length} 个词条 · {queue.length} 个今日待学／待复习</span>
      <select aria-label="文件来源类型" className="rounded-lg border border-border bg-card p-2 text-sm" value={sourceKind} onChange={ev=>setSourceKind(ev.target.value)}>{Object.entries(sourceKinds).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      <label className={`${button} inline-flex gap-2 items-center cursor-pointer`}><Upload size={16}/>{busy ? "处理中…" : "导入 PDF"}<input aria-label="导入词汇文件" type="file" accept=".pdf,.txt,.md" disabled={busy||model.ai.isPending} className="sr-only" onChange={ev=>{const f=ev.target.files?.[0];ev.target.value="";if(f)void run(()=>upload(f));}}/></label>
      <button disabled={!words.length} className={button} onClick={exportWords}>导出词库</button>
      {busy&&<button className={button} onClick={()=>{stop.current=true;setMessage("当前批次完成后暂停…");}}>暂停导入</button>}
    </div>
    {message&&<p role="status" className="text-sm text-sage-deep">{message}</p>}
    {(error||loadError)&&<div role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error||loadError?.message}<button className="ml-3 underline" onClick={()=>void model.refresh()}>重新加载</button></div>}
    <nav aria-label="词汇视图" className="flex flex-wrap gap-2">{Object.entries(tabs).map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id as keyof typeof tabs);setSelected(null);}} className={`${button} ${tab===id?"bg-sage-light text-sage-deep":""}`}>{label}</button>)}</nav>
    {tab==="inbox" ? <VocabularyInbox imports={model.imports.data||[]} busy={busy} onResume={processImport} onText={importText} onCapture={async(body)=>{const data=await model.capture.mutateAsync(body);setMessage("来源与词条已保存；已有词条合并来源。");setTab("all");setSelected(data.wordId);}}/> : tab==="progress" ? <VocabularyProgress dashboard={model.dashboard.data} history={model.history.data||[]} words={words} onWord={id=>{setTab("all");setSelected(id);}}/> : <>
      {tab==="today"&&<section className="rounded-lg border border-border p-4 space-y-3"><div className="flex flex-wrap gap-3 items-center"><h2 className="font-medium">{model.day} · 今日安排</h2>{model.plan.data ? <span className="text-xs text-ink-light">新词 {model.plan.data.new_ids.length} · 熟词生义 {model.plan.data.familiar_ids.length} · 输出词 {model.plan.data.production_ids.length}</span> : <><label className="text-sm">新词名额 <input aria-label="每日新词名额" type="number" min={0} max={100} value={target} onChange={ev=>setTarget(Math.max(0,Math.min(100,Number(ev.target.value))))} className="w-20 ml-2 p-2 border border-border rounded-lg"/></label><button disabled={model.startDay.isPending||!words.length} className={button} onClick={()=>void run(async()=>{if(target>=1&&target<=30)saveLearnTarget(target);await model.startDay.mutateAsync(target);})}>生成今日名单</button></>}</div><p className="text-xs text-ink-lighter">按 60% 新词、20% 熟词生义、20% 输出词安排，类别不足时补足。名单跨设备保存，刷新不增加新词；所有到期复习独立加入。词卡按需自动加工。</p></section>}
      <div className="flex flex-wrap gap-2"><input aria-label="搜索词汇" placeholder="搜索词汇、释义或来源" value={search} onChange={ev=>setSearch(ev.target.value)} className="flex-1 min-w-40 rounded-lg border border-border p-3 bg-card text-sm"/><select aria-label="分类筛选" value={type} onChange={ev=>setType(ev.target.value)} className="rounded-lg border border-border p-2 bg-card text-sm"><option value="">全部分类</option>{Object.entries(vocabularyTypes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"><section className="space-y-2">
        {model.words.isLoading ? <p className="flex gap-2"><Loader2 className="animate-spin" size={16}/>正在加载词库…</p> : filtered.length===0&&<p className="rounded-lg border border-dashed border-border p-8 text-sm text-ink-lighter">{words.length ? "暂无待处理词汇。可生成今日名单、查看全部词库或等待复习到期。" : "上传词汇 PDF 或粘贴材料，建立个人词库。"}</p>}
        {filtered.slice(page*40,page*40+40).map(w=><button key={w.id} className={`w-full text-left rounded-lg border p-4 ${selected===w.id?"border-sage-deep bg-sage-light/20":"border-border bg-card"}`} onClick={()=>setSelected(w.id)}><div className="flex justify-between gap-3"><strong>{w.word}</strong><span className="text-xs text-ink-light">{w.level} → {w.target_level||"R1"} · {statusLabels[w.status]}</span></div><p className="text-xs text-ink-lighter mt-2">{vocabularyTypes[w.type]} · {new Set(w.sources.map(s=>s.import_id)).size} 个来源{w.due_at?` · ${new Date(w.due_at).toLocaleDateString("zh-CN")} 复习`:""}{w.listening_status==="weak"?" · 听力薄弱":""}</p></button>)}
        {filtered.length>40&&<div className="flex justify-between"><button className={button} disabled={page===0} onClick={()=>setPage(page-1)}>上一页</button><span>{page+1} / {Math.ceil(filtered.length/40)}</span><button className={button} disabled={(page+1)*40>=filtered.length} onClick={()=>setPage(page+1)}>下一页</button></div>}
      </section>{current ? <VocabularyCard key={current.id} word={current} model={model} onTest={startTest}/> : <p className="text-sm text-ink-lighter p-5">选择一个词条，学习语境、搭配与迁移规则，再进入分层测试。</p>}</div>
    </>}
    {test&&<VocabularyPractice key={test.attemptId} test={test} onSubmit={answer=>model.submit.mutateAsync({attemptId:test.attemptId,answer})} onClose={()=>setTest(null)} onNext={()=>{setTest(null);setSelected(null);setTab("today");}}/>}
  </div>;
}

