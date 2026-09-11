import { useEffect, useState } from "react";
import { Loader2, Volume2, X } from "lucide-react";
import { testModes, type VocabularyQuestion, type VocabularyFeedback } from "@/lib/english/vocabulary";

export function playVocabularyAudio(text:string,onDone:()=>void,onError:(message:string)=>void) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance==="undefined") { onError("当前浏览器没有语音合成能力，请换用支持语音的浏览器进行听力训练。"); return; }
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang="en-US"; utterance.rate=0.85;
  const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith("en"));
  if(voice) utterance.voice=voice;
  utterance.onend=onDone;
  utterance.onerror=()=>onError("播放失败，请检查设备声音并重新播放。");
  window.speechSynthesis.speak(utterance);
}

export default function VocabularyPractice({test,onSubmit,onClose,onNext}:{test:VocabularyQuestion;onSubmit:(answer:string)=>Promise<VocabularyFeedback>;onClose:()=>void;onNext:()=>void}) {
  const [answer,setAnswer]=useState("");
  const [feedback,setFeedback]=useState<VocabularyFeedback|null>(test.feedback);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [heard,setHeard]=useState(false);
  useEffect(()=>()=>{if("speechSynthesis" in window) window.speechSynthesis.cancel();},[]);
  async function submit() {
    setBusy(true);setError("");
    try{setFeedback(await onSubmit(answer));}catch(e){setError((e as Error).message||"评分失败，答案已保留，请重试");}finally{setBusy(false);}
  }
  return <div className="fixed inset-0 z-50 bg-black/35 flex items-start justify-center p-3 sm:p-8 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="vocabulary-test-title">
    <div className="w-full max-w-2xl bg-card rounded-xl border border-border p-5 sm:p-7 my-auto space-y-5">
      <div className="flex items-center justify-between gap-3"><h2 id="vocabulary-test-title" className="text-lg font-semibold">{testModes[test.mode]}</h2><button aria-label="关闭测试" disabled={busy} onClick={onClose} className="p-2 rounded-lg hover:bg-sage-light"><X size={20}/></button></div>
      <p className="whitespace-pre-wrap text-base leading-relaxed">{test.question.prompt}</p>
      {test.mode==="listening" && <div><button className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-3" onClick={()=>{setError("");playVocabularyAudio(test.question.audio_text,()=>setHeard(true),setError);}}><Volume2 size={18}/>播放英语音频</button><p className="text-xs text-ink-lighter mt-2">可重复播放。设备语音合成读出词形或搭配，听力成绩独立于阅读等级。</p></div>}
      {test.question.options.length ? <fieldset disabled={busy||!!feedback} className="space-y-2"><legend className="sr-only">选择答案</legend>{test.question.options.map((option,i)=><label key={i} className={`flex gap-3 rounded-lg border p-3 cursor-pointer ${answer===String(i) ? "border-sage-deep bg-sage-light/30" : "border-border"}`}><input type="radio" name="vocabulary-answer" value={i} checked={answer===String(i)} onChange={()=>setAnswer(String(i))}/><span>{String.fromCharCode(65+i)}. {option}</span></label>)}</fieldset> : <label className="block text-sm">你的答案<textarea autoFocus value={answer} maxLength={3000} onChange={e=>setAnswer(e.target.value)} disabled={busy||!!feedback} rows={test.mode==="P2"?5:3} className="mt-2 w-full block rounded-lg border border-border p-3 bg-transparent" placeholder={test.mode==="listening" ? "写下听到的英文" : "输入英文答案"}/></label>}
      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
      {!feedback ? <button className="rounded-lg bg-sage-deep text-white px-4 py-3 disabled:opacity-40 inline-flex gap-2 items-center" disabled={busy||!answer.trim()||(test.mode==="listening"&&!heard)} onClick={()=>void submit()}>{busy && <Loader2 size={16} className="animate-spin"/>}{busy ? "评分并保存…" : "提交答案"}</button> : <section role="status" className="border-t border-border pt-4 space-y-3 text-sm">
        <h3 className={`font-semibold text-lg ${feedback.passed ? "text-sage-deep" : "text-amber-700"}`}>{feedback.score} 分 · {feedback.passed ? "通过" : "需要巩固"}</h3>
        <p>{feedback.explanation}</p><p><strong>参考答案：</strong>{feedback.expected_answer}</p>
        {feedback.corrected_answer && <p><strong>修改示例：</strong>{feedback.corrected_answer}</p>}
        {feedback.root_cause && <p><strong>错因：</strong>{feedback.root_cause}</p>}
        {feedback.transferable_rule && <p><strong>迁移规则：</strong>{feedback.transferable_rule}</p>}
        {(test.mode==="P1"||test.mode==="P2") && <p className="text-xs text-ink-light">词义 {feedback.criteria.meaning} · 语法 {feedback.criteria.grammar} · 搭配 {feedback.criteria.collocation} · 语域 {feedback.criteria.register}</p>}
        <p className="text-xs text-ink-lighter">结果已保存 · 阅读掌握 {feedback.level}。{feedback.passed ? "同日重复正确不重复增加掌握证据。" : "已记录错因，后续使用新语境再测。"}</p>
        <button onClick={onNext} className="rounded-lg bg-sage-deep text-white px-4 py-2">返回今日队列</button>
      </section>}
    </div>
  </div>;
}
