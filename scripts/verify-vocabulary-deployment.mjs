// Read-only authenticated deployment smoke check. No AI calls or learning-data writes.
import {createClient} from "@supabase/supabase-js";
const url=process.env.VITE_SUPABASE_URL;
const key=process.env.VITE_SUPABASE_ANON_KEY;
const email=process.env.VOCABULARY_QA_EMAIL;
const password=process.env.VOCABULARY_QA_PASSWORD;
if(!url||!key||!email||!password){
  console.error("请设置 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY、VOCABULARY_QA_EMAIL、VOCABULARY_QA_PASSWORD。可通过 Node --env-file 加载本地忽略文件；不要提交密码。");process.exit(2);
}
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await db.auth.signInWithPassword({email,password});
if(error||!data.session){console.error("登录失败：",error?.message||"未返回会话");process.exit(1);}
let failed=false;
function check(name,error){if(error){failed=true;console.error(`FAIL ${name}: ${error.code||""} ${error.message||error}`);}else console.log(`PASS ${name}`);}
try{
  const checks=await Promise.all([
    db.from("vocabulary_words").select("id,target_level,mastery,listening_due_at,content_version,curated").limit(1),
    db.from("vocabulary_imports").select("id,chunk_count,source_kind").limit(1),
    db.from("vocabulary_daily_plans").select("day,target,new_ids,familiar_ids,production_ids").limit(1),
    db.from("vocabulary_attempts").select("id,mode,score,feedback").limit(1),
    db.from("vocabulary_errors").select("id,resolved_at,mode,source_import_id").limit(1),
    db.rpc("vocabulary_dashboard"),
  ]);
  checks.forEach((r,i)=>check(["词库结构","导入结构","每日计划","测试记录","错因结构","统计 RPC"][i],r.error));
  const privateRead=await db.from("vocabulary_questions").select("payload").limit(1);
  check("标准答案不可直接读取",privateRead.error?.code==="42501"?null:{message:"题库没有返回预期的权限拒绝，请检查 108 迁移"});
  const response=await fetch(`${url}/functions/v1/tem8-vocabulary-agent`,{method:"POST",headers:{Authorization:`Bearer ${data.session.access_token}`,apikey:key,"Content-Type":"application/json"},body:JSON.stringify({action:"deployment-probe"})});
  const body=await response.json();
  check("Edge Function 认证与路由",response.status===400&&body.error==="无效操作"?null:{message:`返回 HTTP ${response.status}，请检查函数版本、JWT 配置和共享认证环境变量`});
  console.log(failed?"部署检查未通过。":"结构、认证和权限检查通过。还需在页面完成真实 PDF、AI 出题、P1/P2 评分与听力播放验收。");
}finally{await db.auth.signOut({scope:"local"});}
process.exitCode=failed?1:0;
