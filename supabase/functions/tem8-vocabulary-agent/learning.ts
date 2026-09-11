import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { aiRuntime } from "../_shared/ai.ts";
import { MODES, QUESTION_PROMPT, GRADE_PROMPT, validateQuestion, publicQuestion, deterministicGrade, validateGrade, clampLevel, type Mode } from "./practice.ts";

export async function handleLearning(body: Record<string, unknown>, db: SupabaseClient, userDb: SupabaseClient, userId: string) {
  if (body.action === "capture") {
    const word=String(body.word||"").normalize("NFKC").replace(/[’‘]/g,"'").replace(/[‐‑–]/g,"-").trim().toLowerCase().replace(/\s+/g," ");
    const meaning=String(body.meaning||"").trim();
    const context=String(body.context||"").trim();
    const title=String(body.title||"手动摘录").trim();
    const kind=String(body.kind||"reading");
    const interpretation=String(body.interpretation||"").trim();
    if (!/^\p{Script=Latin}[\p{Script=Latin}\p{M} '\-]{0,119}$/u.test(word) || !meaning || meaning.length>2000 || context.length>3000 || title.length>200 || interpretation.length>2000 ||
      !["reading","exam","listening","error","writing"].includes(kind)) throw new Error("请填写有效词条、释义和来源");
    const original=`${word}\n${meaning}\n${context}`;
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify({word,meaning,context,title,kind,interpretation})));
    const fingerprint=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
    const inserted=await userDb.from("vocabulary_imports").upsert({user_id:userId,name:title,fingerprint,source_kind:kind,chunks:[original]}, {onConflict:"user_id,fingerprint",ignoreDuplicates:true});
    if(inserted.error) throw inserted.error;
    const imp=await userDb.from("vocabulary_imports").select("id,completed_chunks").eq("user_id",userId).eq("fingerprint",fingerprint).single();
    if(imp.error) throw imp.error;
    const type=kind==="listening" ? "listening" : word.includes(" ") ? "collocation" : "new";
    const saved=await userDb.rpc("save_vocabulary_chunk",{p_import:imp.data.id,p_chunk:0,p_entries:[{word,meaning,original:word,context:original,pos:"",type}]});
    if(saved.error) throw saved.error;
    const result=await db.from("vocabulary_words").select("id").eq("user_id",userId).eq("word",word).single();
    if(result.error) throw result.error;
    if(interpretation) {
      const recorded=await db.rpc("record_vocabulary_observation",{p_user:userId,p_word:result.data.id,p_interpretation:interpretation,p_meaning:meaning,p_listening:kind==="listening",p_source:imp.data.id});
      if(recorded.error) throw recorded.error;
    }
    return {wordId:result.data.id};
  }
  if (body.action === "question") {
    const mode=String(body.mode) as Mode;
    if (!MODES.includes(mode)) throw new Error("无效测试类型");
    const {data:w,error}=await db.from("vocabulary_words").select("*").eq("id",body.wordId).eq("user_id",userId).single();
    if(error || !w || w.archived) throw new Error("词条不存在或已归档");
    if(!w.enrichment) throw new Error("请先生成学习卡，再开始测试");
    const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
    // Reopen a pending attempt after reload. Completed attempts only reused for exact same version/day.
    const existing=await db.from("vocabulary_attempts").select("*").eq("user_id",userId).eq("word_id",w.id).eq("mode",mode).eq("word_version",w.version).eq("day",day).maybeSingle();
    if(existing.error) throw existing.error;
    let attempt=existing.data;
    let question;
    if(attempt) {
      const found=await db.from("vocabulary_questions").select("*").eq("id",attempt.question_id).eq("user_id",userId).single();
      if(found.error) throw found.error;
      question=found.data;
    } else {
      // Three rotating variants per error epoch; new mistakes generate fresh contextual retests.
      const variant=w.error_count*3+(Math.floor(Date.now()/86400000)%3);
      const cached=await db.from("vocabulary_questions").select("*").eq("word_id",w.id).eq("user_id",userId).eq("mode",mode).eq("content_version",w.content_version).eq("variant",variant).maybeSingle();
      if(cached.error) throw cached.error;
      question=cached.data;
      if(!question) {
        const prior=await db.from("vocabulary_errors").select("interpretation,actual_meaning,root_cause,transferable_rule").eq("word_id",w.id).eq("user_id",userId).eq("mode",mode).is("resolved_at",null).order("created_at",{ascending:false}).limit(1);
        if(prior.error) throw prior.error;
        const result=await aiRuntime([{role:"system",content:QUESTION_PROMPT},{role:"user",content:JSON.stringify({word:w.word,mode,enrichment:w.enrichment,previous_error:prior.data?.[0]||null,variant})}],
          {agentName:"tem8-question",maxInputLength:10000,maxTokens:2200,dynamicTokens:false,temperature:0.35});
        if(!result.success) throw new Error(result.error);
        const payload=validateQuestion(result.data,mode);
        const stored=await db.from("vocabulary_questions").insert({user_id:userId,word_id:w.id,mode,content_version:w.content_version,variant,payload}).select("*").single();
        if(stored.error) throw stored.error;
        question=stored.data;
      }
      const saved=await db.from("vocabulary_attempts").insert({user_id:userId,word_id:w.id,question_id:question.id,mode,word_version:w.version,day}).select("*").single();
      if(saved.error) throw saved.error;
      attempt=saved.data;
    }
    return {attemptId:attempt.id,mode,question:publicQuestion(question.payload,mode),feedback:attempt.feedback};
  }
  if(body.action === "submit") {
    const answer=String(body.answer||"").trim();
    if(!answer || answer.length>3000) throw new Error("请输入答案（最多 3000 字符）");
    const {data:a,error}=await db.from("vocabulary_attempts").select("*").eq("id",body.attemptId).eq("user_id",userId).single();
    if(error || !a) throw new Error("测试记录不存在");
    if(a.completed_at) return a.feedback;
    if(a.day!==new Date(Date.now()+8*3600000).toISOString().slice(0,10)) throw new Error("日期已变更，请关闭测试并重新出题");
    const q=await db.from("vocabulary_questions").select("*").eq("id",a.question_id).eq("user_id",userId).single();
    if(q.error) throw q.error;
    const w=await db.from("vocabulary_words").select("word,content_version,archived,target_level").eq("id",a.word_id).eq("user_id",userId).single();
    if(w.error || w.data.archived || w.data.content_version!==q.data.content_version) throw new Error("词条内容已修改，请重新出题");
    let grade=deterministicGrade(q.data.payload,a.mode,answer);
    if(!grade) {
      const result=await aiRuntime([{role:"system",content:GRADE_PROMPT},{role:"user",content:JSON.stringify({mode:a.mode,word:w.data.word,task:q.data.payload,learner_answer:answer})}],
        {agentName:"tem8-grading",maxInputLength:10000,maxTokens:1500,dynamicTokens:false,temperature:0.1});
      if(!result.success) throw new Error(result.error);
      grade=validateGrade(result.data,q.data.payload);
    }
    const submitted=a.mode==="R1" || a.mode==="R2" || a.mode==="collocation" ? q.data.payload.options[Number(answer)] : answer;
    const saved=await db.rpc("complete_vocabulary_attempt",{p_user:userId,p_attempt:a.id,p_answer:submitted,p_feedback:grade});
    if(saved.error) throw saved.error;
    // The RPC promotes purely on evidence. The word's target is the ceiling, so a manual test
    // past the goal (自定义测试) is graded and recorded but cannot push persisted mastery higher.
    // Listening is its own dimension and never rewrites the reading level.
    const level=String(saved.data?.level||"R0");
    const capped=a.mode==="listening" ? level : clampLevel(level,String(w.data.target_level||"R1"));
    if(capped!==level) {
      const fixed=await db.from("vocabulary_words").update({level:capped}).eq("id",a.word_id).eq("user_id",userId);
      if(fixed.error) throw fixed.error;
      return {...saved.data,level:capped};
    }
    return saved.data;
  }
  throw new Error("未知学习操作");
}
