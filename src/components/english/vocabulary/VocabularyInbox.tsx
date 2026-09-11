import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { VocabularyImport } from "@/lib/english/vocabulary";
export const sourceKinds={vocabulary:"词汇 PDF／词表",exam:"真题",reading:"阅读材料",listening:"听力材料",writing:"翻译／写作",error:"真实错词"} as const;
const button="min-h-11 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40";
const input="block w-full mt-1 p-2 border border-border rounded-lg bg-card";
function ImportSource({id}:{id:string}) {
  const [open,setOpen]=useState(false);
  const source=useQuery({queryKey:["vocabulary-import-source",id],enabled:open,staleTime:Infinity,queryFn:async()=>{
    const {data,error}=await supabase.from("vocabulary_imports").select("chunks").eq("id",id).single();
    if(error) throw error;return data.chunks as string[];
  }});
  return <details className="mt-3 text-sm" onToggle={ev=>setOpen(ev.currentTarget.open)}><summary className="cursor-pointer text-ink-light">查看保留原文（批次间有重叠）</summary>{source.isLoading&&<p>加载中…</p>}{source.isError&&<p role="alert">原文加载失败<button onClick={()=>void source.refetch()}>重试</button></p>}<pre className="whitespace-pre-wrap break-all max-h-64 overflow-auto mt-2">{source.data?.map(c=>c.normalize("NFKC")).join("\n\n——下一批——\n\n")}</pre></details>;
}
export default function VocabularyInbox({imports,busy,onResume,onCapture,onText}:{imports:VocabularyImport[];busy:boolean;onResume:(imp:VocabularyImport)=>Promise<void>;onCapture:(body:Record<string,unknown>)=>Promise<void>;onText:(name:string,text:string,kind:string)=>Promise<void>}) {
  const [title,setTitle]=useState(""); const [kind,setKind]=useState("reading");
  const [word,setWord]=useState(""); const [meaning,setMeaning]=useState(""); const [context,setContext]=useState("");
  const [interpretation,setInterpretation]=useState(""); const [text,setText]=useState("");const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  async function run(action:()=>Promise<void>) {setSaving(true);setError("");try{await action();}catch(e){setError((e as Error).message||"保存失败");}finally{setSaving(false);}}
  return <section className="space-y-4">
    <p className="text-sm text-ink-light">PDF 支持文字层（20MB 内），扫描件需先转为可选文字。真题、阅读、听力转写、写作和真实错误都可从这里进入同一个词库。</p>
    <details className="rounded-lg border border-border p-4"><summary className="font-medium cursor-pointer">摘录一个词／记录真实错误</summary><form className="grid sm:grid-cols-2 gap-3 mt-4 text-sm" onSubmit={ev=>{ev.preventDefault();void run(async()=>{await onCapture({word,meaning,context,title:title||"手动摘录",kind,interpretation});setWord("");setMeaning("");setContext("");setInterpretation("");});}}>
      <label>来源名称<input className={input} value={title} maxLength={200} onChange={ev=>setTitle(ev.target.value)} placeholder="例如：2021 专八阅读"/></label>
      <label>来源类型<select className={input} value={kind} onChange={ev=>setKind(ev.target.value)}>{Object.entries(sourceKinds).filter(([v])=>v!=="vocabulary").map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
      <label>单词原形／搭配<input required className={input} maxLength={120} value={word} onChange={ev=>setWord(ev.target.value)} placeholder="qualify / pose a threat"/></label>
      <label>当前语境中的含义<input required className={input} maxLength={2000} value={meaning} onChange={ev=>setMeaning(ev.target.value)} placeholder="限定某种说法"/></label>
      <label className="sm:col-span-2">来源原句<textarea className={input} maxLength={3000} value={context} onChange={ev=>setContext(ev.target.value)} placeholder="保留原句，帮助后续分析熟词生义"/></label>
      <label className="sm:col-span-2">当时的错误理解（没有错误可留空）<textarea className={input} maxLength={2000} value={interpretation} onChange={ev=>setInterpretation(ev.target.value)} placeholder={kind==="listening" ? "例如：读得懂 legitimate，但录音里没有辨认出来" : "例如：误以为 qualify 在此处表示使有资格"}/></label>
      <button disabled={busy||saving} className={`${button} justify-self-start`}>保存到词库{interpretation ? "与错词本" : ""}</button>
    </form></details>
    <details className="rounded-lg border border-border p-4"><summary className="font-medium cursor-pointer">批量粘贴词表／学习材料</summary><div className="space-y-3 mt-4 text-sm"><label>资料名称<input className={input} value={title} maxLength={200} onChange={ev=>setTitle(ev.target.value)}/></label><label>材料类型<select className={input} value={kind} onChange={ev=>setKind(ev.target.value)}>{Object.entries(sourceKinds).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><textarea aria-label="批量词汇材料" className={input} rows={7} maxLength={1000000} value={text} onChange={ev=>setText(ev.target.value)} placeholder="粘贴词表、阅读段落、听力转写或错题原文"/><button disabled={busy||saving||!text.trim()} className={button} onClick={()=>void run(async()=>{await onText(title||"粘贴材料",text,kind);setText("");})}>自动提取入库</button></div></details>
    {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}
    <h2 className="font-medium">导入记录</h2>
    {imports.map(imp=><article key={imp.id} className="border border-border rounded-lg p-4"><div className="flex flex-wrap gap-3 justify-between"><h3 className="font-medium break-all">{imp.name}</h3><span className="text-sm">{imp.completed_chunks.length} / {imp.chunk_count} 批</span></div>{imp.completed_chunks.length<imp.chunk_count&&<button disabled={busy||saving} className={`${button} mt-3`} onClick={()=>void run(()=>onResume(imp))}>继续提取</button>}<ImportSource id={imp.id}/></article>)}
    {!imports.length&&<p className="text-ink-lighter py-6">上传词汇 PDF 或粘贴资料，开始建立个人词库。</p>}
  </section>;
}
