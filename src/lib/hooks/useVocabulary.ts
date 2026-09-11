import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { invokeAI } from "@/lib/ai/aiService";
import { CHUNKER_VERSION, vocabularyChunks, type VocabularyExtractResult, type VocabularyImport, type VocabularyWord } from "@/lib/english/vocabulary";
import type { VocabularyPlan, VocabularyQuestion, VocabularyFeedback, VocabularyAttempt, VocabularyDashboard, TestMode } from "@/lib/english/vocabulary";
import { useShanghaiDateKey } from "@/lib/hooks/useShanghaiDateKey";

export function useVocabulary() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const day=useShanghaiDateKey();
  const key = ["tem8-vocabulary", user?.id];
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const words = useQuery({ queryKey: [...key,"words"], enabled: !!user, queryFn: async () => {
    // Supabase caps each response at 1000 rows; paginate rather than silently dropping large word lists.
    const all: VocabularyWord[] = [];
    for (let offset = 0;; offset += 500) {
      const {data,error} = await supabase.from("vocabulary_words").select("*").eq("user_id",user!.id).order("id").range(offset,offset+499);
      if (error) throw error;
      all.push(...data as VocabularyWord[]);
      if (data.length < 500) return all;
    }
  }});
  const imports = useQuery({queryKey:[...key,"imports"],enabled:!!user,queryFn:async () => {
    const {data,error} = await supabase.from("vocabulary_imports").select("id,name,chunk_count,completed_chunks,created_at").eq("user_id",user!.id).order("created_at",{ascending:false});
    if (error) throw error;
    return data as VocabularyImport[];
  }});
  const createImport = useMutation({mutationFn:async ({name,text,kind="vocabulary"}:{name:string;text:string;kind?:string}) => {
    const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(kind==="vocabulary" ? `${CHUNKER_VERSION}\n${text}` : `${CHUNKER_VERSION}\n${kind}\n${text}`));
    const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
    const {error} = await supabase.from("vocabulary_imports").upsert({user_id:user!.id,name,fingerprint,source_kind:kind,chunks:vocabularyChunks(text)},
      {onConflict:"user_id,fingerprint",ignoreDuplicates:true});
    if (error) throw error;
    const result = await supabase.from("vocabulary_imports").select("id,name,chunk_count,completed_chunks,created_at").eq("user_id",user!.id).eq("fingerprint",fingerprint).single();
    if (result.error) throw result.error;
    return result.data as VocabularyImport;
  },onSuccess:refresh});
  const ai = useMutation({mutationFn:async (payload:Record<string,unknown>) => {
    const result = await invokeAI<VocabularyExtractResult>("tem8-vocabulary-agent",payload,{timeout:90000});
    if (!result.success) throw new Error(result.error);
    return result.data;
  },onSuccess:(_,payload)=>payload.action === "extract" ? qc.invalidateQueries({queryKey:[...key,"imports"]}) : refresh()});
  async function call<T>(body:Record<string,unknown>):Promise<T> {
    const result=await invokeAI<T>("tem8-vocabulary-agent",body,{timeout:90000});
    if(!result.success) throw new Error(result.error);
    return result.data;
  }
  const plan=useQuery({queryKey:[...key,"day",day],enabled:!!user,queryFn:async()=>{
    const {data,error}=await supabase.from("vocabulary_daily_plans").select("*").eq("user_id",user!.id).eq("day",day).maybeSingle();
    if(error) throw error; return data as VocabularyPlan|null;
  }});
  const startDay=useMutation({mutationFn:async(target:number)=>{
    const {data,error}=await supabase.rpc("ensure_vocabulary_day",{p_target:target});
    if(error) throw error; return (Array.isArray(data)?data[0]:data) as VocabularyPlan;
  },onSuccess:refresh});
  const question=useMutation({mutationFn:({wordId,mode}:{wordId:string;mode:TestMode})=>call<VocabularyQuestion>({action:"question",wordId,mode})});
  const submit=useMutation({mutationFn:({attemptId,answer}:{attemptId:string;answer:string})=>call<VocabularyFeedback>({action:"submit",attemptId,answer}),onSuccess:()=>{
    void qc.invalidateQueries({queryKey:["vocabulary-errors"]}); return refresh();
  }});
  const capture=useMutation({mutationFn:(body:Record<string,unknown>)=>call<{wordId:string}>({action:"capture",...body}),onSuccess:refresh});
  const edit=useMutation({mutationFn:async({word,type,target,meaning,pos}:{word:VocabularyWord;type:string;target:string;meaning:string;pos:string})=>{
    const {error}=await supabase.rpc("edit_vocabulary_word",{p_word:word.id,p_type:type,p_target:target,p_meaning:meaning,p_pos:pos});
    if(error) throw error;
  },onSuccess:refresh});
  const archive=useMutation({mutationFn:async({id,archived}:{id:string;archived:boolean})=>{
    const {error}=await supabase.from("vocabulary_words").update({archived}).eq("id",id).eq("user_id",user!.id);
    if(error) throw error;
  },onSuccess:refresh});
  const dashboard=useQuery({queryKey:[...key,"dashboard",day],enabled:!!user,queryFn:async()=>{
    const {data,error}=await supabase.rpc("vocabulary_dashboard"); if(error) throw error; return data as VocabularyDashboard;
  }});
  const history=useQuery({queryKey:[...key,"history",day],enabled:!!user,queryFn:async()=>{
    const {data,error}=await supabase.from("vocabulary_attempts").select("*").eq("user_id",user!.id).not("completed_at","is",null).order("completed_at",{ascending:false}).limit(100);
    if(error) throw error; return data as VocabularyAttempt[];
  }});
  return {words,imports,createImport,ai,plan,startDay,question,submit,capture,edit,archive,dashboard,history,day,refresh};
}
