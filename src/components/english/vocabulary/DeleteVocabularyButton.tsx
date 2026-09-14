import { useState } from "react";
import { Trash2 } from "lucide-react";

export default function DeleteVocabularyButton({name,description,onDelete,disabled=false}:{name:string;description:string;onDelete:()=>Promise<void>;disabled?:boolean}) {
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function remove() {
    setBusy(true);setError("");
    try {await onDelete();setConfirm(false);} catch(e){setError((e as Error).message||"删除失败，请重试");} finally {setBusy(false);}
  }
  if(!confirm) return <button type="button" aria-label={`删除${name}`} disabled={disabled} onClick={()=>setConfirm(true)} className="min-h-11 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs text-ink-light hover:bg-red-50 hover:text-red-700 focus-visible:outline-sage-deep disabled:opacity-40"><Trash2 size={15}/>删除</button>;
  return <div role="alertdialog" aria-label={`删除${name}`} className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm space-y-2">
    <p className="font-medium text-red-900">删除“{name}”？</p><p className="text-xs text-red-800 leading-relaxed">{description}</p>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    <div className="flex gap-2"><button disabled={busy||disabled} onClick={()=>void remove()} className="min-h-11 rounded-lg bg-red-700 text-white px-3 disabled:opacity-40">{busy?"删除中…":"确认删除"}</button><button disabled={busy} onClick={()=>setConfirm(false)} className="min-h-11 rounded-lg px-3 text-ink">取消</button></div>
  </div>;
}
