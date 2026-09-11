import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { useVocabulary } from "@/lib/hooks/useVocabulary";
import { recommendedTest, testModes, vocabularyTypes, type TestMode, type VocabularyWord } from "@/lib/english/vocabulary";
import { playVocabularyAudio } from "./VocabularyPractice";

const button="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40 hover:bg-sage-light/30";
export default function VocabularyCard({word:w,model,onTest}:{word:VocabularyWord;model:ReturnType<typeof useVocabulary>;onTest:(mode:TestMode)=>Promise<void>}) {
  const [error,setError]=useState("");
  const [mode,setMode]=useState<TestMode>(()=>recommendedTest(w));
  const [editing,setEditing]=useState(false);
  const [type,setType]=useState(w.type);
  const [target,setTarget]=useState(w.target_level||"R1");
  const [meaning,setMeaning]=useState(w.meaning);
  const [pos,setPos]=useState(w.pos);
  const attempted=useRef(false);
  const e=w.enrichment;
  const errors=useQuery({queryKey:["vocabulary-errors",w.id,w.version],enabled:w.error_count>0,queryFn:async()=>{
    const {data,error}=await supabase.from("vocabulary_errors").select("*").eq("word_id",w.id).order("created_at",{ascending:false}).limit(50);
    if(error) throw error;return data;
  }});
  async function run(fn:()=>Promise<unknown>){setError("");try{await fn();}catch(e){setError((e as Error).message||"操作失败，请重试");}}
  // Only enrich opened cards, once per mount; a failed call never creates an automatic retry loop.
  useEffect(()=>{if(!w.archived && e?.schema_version!==2 && !attempted.current){attempted.current=true;void run(()=>model.ai.mutateAsync({action:"enrich",wordId:w.id}));}},[w.id]);
  useEffect(()=>setMode(recommendedTest(w)),[w.target_level,w.version]);
  useEffect(()=>{if(!editing){setType(w.type);setTarget(w.target_level||"R1");setMeaning(w.meaning);setPos(w.pos);}},[w.type,w.target_level,w.meaning,w.pos,editing]);
  const pending=model.ai.isPending||model.question.isPending||model.edit.isPending||model.archive.isPending;
  return <article className="rounded-lg border border-border bg-card p-5 space-y-4 min-w-0">
    <header><div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">{w.word}</h2><button className={button} onClick={()=>playVocabularyAudio(w.word,()=>{},setError)}>发音</button></div><p className="text-xs text-ink-lighter mt-2">{w.pos} · 当前 {w.level} → 目标 {w.target_level||"R1"} · {vocabularyTypes[w.type]}</p><p className="text-xs text-ink-light mt-2">听力：{{unknown:"未测试",weak:"薄弱",learning:"巩固中",stable:"稳定"}[w.listening_status||"unknown"]}</p></header>
    {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
    <div className="text-sm"><h3 className="text-xs text-ink-lighter">资料／个人释义</h3><p className="mt-1">{w.meaning||"资料未提供，见学习建议与来源原文"}</p></div>
    {e ? <section className="rounded-lg bg-sage-light/25 p-4 space-y-3 text-sm"><p className="text-xs text-ink-lighter">AI 专八学习卡 · 建议 {e.recommended_level} · 优先价值 {{high:"高",medium:"中",low:"低"}[e.value]}</p><p>{e.pronunciation}</p><p>{e.english_definition}</p><p>核心义：{e.core_meaning}</p><p>语境义：{e.tem8_meaning}</p>{e.known_meaning&&<p>熟悉义：{e.known_meaning}</p>}{e.trigger&&<p>识别线索：{e.trigger}</p>}{e.trap&&<p>常见误区：{e.trap}</p>}{e.contrast_example&&<p>对比例句：{e.contrast_example}</p>}{e.collocations.length>0&&<p>搭配：{e.collocations.join(" / ")}</p>}{e.synonyms?.length ? <p>近义表达：{e.synonyms.join(" / ")}</p> : null}{e.examples.map((ex,i)=><p key={i} className="italic">{ex}</p>)}{e.register&&<p>语域：{e.register}</p>}{e.writing_use&&<p>写作用法：{e.writing_use}</p>}{e.translation_use&&<p>翻译用法：{e.translation_use}</p>}</section> : <div className="text-sm"><p>{model.ai.isPending ? "正在生成学习卡…" : "学习卡尚未生成。原资料已保留。"}</p><button className={`${button} mt-2`} disabled={pending} onClick={()=>void run(()=>model.ai.mutateAsync({action:"enrich",wordId:w.id}))}>生成／重试</button></div>}
    {!w.archived && <section className="border-t border-border pt-4 space-y-3"><h3 className="font-medium text-sm">学习后测试</h3><label className="block text-xs text-ink-light">测试层级<select aria-label="测试层级" value={mode} onChange={ev=>setMode(ev.target.value as TestMode)} className="mt-2 block rounded-lg border border-border p-2 w-full bg-card">{Object.entries(testModes).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button disabled={pending||!e} className="bg-sage-deep text-white rounded-lg px-4 py-2 text-sm disabled:opacity-40" onClick={()=>void run(()=>onTest(mode))}>{model.question.isPending ? "正在准备题目…" : "开始测试"}</button><p className="text-xs text-ink-lighter">80 分通过。R1／R2 需要对应测试证据；P1／P2 各需至少两个不同日期通过，且满足前级。听力独立统计。</p></section>}
    <details className="text-sm"><summary className="cursor-pointer">原文来源（{w.sources.length}）</summary>{w.sources.map((s,i)=><blockquote key={i} className="mt-3 border-l-2 border-border pl-3"><p className="text-xs text-ink-lighter">{s.name} · 原形式 {s.original}</p><p className="whitespace-pre-wrap mt-1">{s.context}</p></blockquote>)}</details>
    {w.error_count>0&&<details className="text-sm" open><summary>错因与再测 · 累计 {w.error_count} 次</summary>{errors.isError&&<p role="alert">错因加载失败<button onClick={()=>void errors.refetch()}>重试</button></p>}{errors.data?.map(err=><div key={err.id} className="mt-3 border-t border-border pt-3 space-y-1"><p className="text-xs text-ink-lighter">{err.mode||"历史自评"} · {err.resolved_at ? "已通过跨日再测" : "待再测"}</p><p>当时理解：{err.interpretation}</p><p>实际含义：{err.actual_meaning}</p><p>错因：{err.root_cause}</p><p>迁移规则：{err.transferable_rule}</p>{err.mode&&!err.resolved_at&&<button disabled={pending||!e} className={`${button} mt-2`} onClick={()=>void run(()=>onTest(err.mode as TestMode))}>用新语境再测</button>}</div>)}</details>}
    <div className="flex flex-wrap gap-2 border-t border-border pt-3"><button className={button} disabled={pending} onClick={()=>setEditing(!editing)}>修订分类／学习目标</button><button className={button} disabled={pending} onClick={()=>void run(()=>model.archive.mutateAsync({id:w.id,archived:!w.archived}))}>{w.archived ? "恢复学习" : "暂不学习，归档"}</button></div>
    {editing&&<form className="space-y-3 text-sm" onSubmit={ev=>{ev.preventDefault();void run(async()=>{await model.edit.mutateAsync({word:w,type,target,meaning,pos});setEditing(false);await model.ai.mutateAsync({action:"enrich",wordId:w.id});});}}><p className="text-xs text-ink-light">原文来源保留。修订后重新加工学习卡，旧题不会继续用于测试。</p><label className="block">分类<select value={type} onChange={ev=>setType(ev.target.value as typeof type)} className="block w-full border border-border rounded-lg p-2 mt-1">{Object.entries(vocabularyTypes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="block">目标<select value={target} onChange={ev=>setTarget(ev.target.value as typeof target)} className="block w-full border border-border rounded-lg p-2 mt-1">{["R1","R2","P1","P2"].map(v=><option key={v}>{v}</option>)}</select></label><label className="block">词性<input value={pos} maxLength={50} onChange={ev=>setPos(ev.target.value)} className="block w-full border border-border rounded-lg p-2 mt-1"/></label><label className="block">个人修订释义<textarea value={meaning} maxLength={3000} onChange={ev=>setMeaning(ev.target.value)} className="block w-full border border-border rounded-lg p-2 mt-1"/></label><button className={button} disabled={pending}>保存修订</button></form>}
  </article>;
}

