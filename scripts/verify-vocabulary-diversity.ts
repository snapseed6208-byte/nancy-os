import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { QUESTION_PROMPT, assessmentFocus, validateQuestion, validateAssessment, shuffleQuestion, type Mode } from '../supabase/functions/tem8-vocabulary-agent/practice';
// Synthetic lexical fixtures only; no learner content or learning-data writes.
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^\w+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')]}));
const qa = Object.fromEntries(fs.readFileSync('.env.vocabulary-qa.local','utf8').split(/\r?\n/).filter(l=>/^\w+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')]}));
const db=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const {data,error}=await db.auth.signInWithPassword({email:qa.VOCABULARY_QA_EMAIL,password:qa.VOCABULARY_QA_PASSWORD});
if(error) throw new Error('QA login failed');
const results=[];
for(const word of ['disparage','qualify']) {
  const previous_questions: unknown[]=[];
  for(const [i,mode] of (['R1','R2','collocation'] as Mode[]).entries()) {
    for(let retry=0;retry<3;retry++) {
    const response=await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/english-coach`,{method:'POST',headers:{Authorization:`Bearer ${data.session!.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({speaking_feedback:true,inject_context:false,model:'deepseek-chat',maxTokens:2200,temperature:0.35,messages:[{role:'system',content:QUESTION_PROMPT},{role:'user',content:JSON.stringify({word,mode,enrichment:{meaning:word==='disparage'?'belittle or speak of as having little value':'limit or modify the scope of a statement'},assessment_focus:assessmentFocus(mode,i),previous_questions})}]}),signal:AbortSignal.timeout(90000)});
    if(!response.ok) throw new Error(`Generation HTTP ${response.status}`);
    const body=await response.json();
    const raw=body.content.match(/\{[\s\S]*\}/)?.[0];
    let q;
    try { q=shuffleQuestion(validateAssessment(validateQuestion(JSON.parse(raw),mode),mode)); } catch(e) { if(retry===2) throw e; continue; }
    previous_questions.push({mode,prompt:q.prompt,options:q.options});
    results.push({word,mode,question:q});
    console.log(JSON.stringify({word,mode,correct_index:q.correct_index}));
    break;
    }
  }
}
fs.mkdirSync('docs/vocabulary-diversity-acceptance',{recursive:true});
fs.writeFileSync('docs/vocabulary-diversity-acceptance/results.json',JSON.stringify(results,null,2));
