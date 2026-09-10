import { runSpeakingPipeline } from "../src/lib/ai/speakingPipeline";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SPEAKING_FEEDBACK_PROMPT, buildFeedbackPrompt, buildRetryFeedbackPrompt } from "../src/lib/ai/prompts";
import { parseSpeakingResponse, normalizeSpeakingFeedback, speakingFeedbackStorage } from "../src/lib/english/speakingFeedback";
import { speakingCases } from "../src/__tests__/fixtures/speaking-feedback-cases";

const config = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^\w+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')]}));
const url = config.VITE_SUPABASE_URL;
const secretFile = '.env.speaking-qa.local';
const outDir = 'docs/speaking-independent-acceptance';
fs.mkdirSync(outDir,{recursive:true});
const auth = createClient(url, config.VITE_SUPABASE_ANON_KEY, {auth:{persistSession:false}});
const mode = process.argv[2] || 'semantic';
if (mode === 'setup') {
  if (fs.existsSync(secretFile)) { console.log('QA credentials already exist; reusing.'); process.exit(0); }
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false}});
  const email = `speaking-qa-${Date.now()}@example.com`;
  const password = crypto.randomUUID() + 'Aa1!';
  const {data,error} = await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:'Speaking QA',purpose:'speaking-feedback-acceptance'}});
  if(error) throw new Error(error.message);
  fs.writeFileSync(secretFile,JSON.stringify({email,password,userId:data.user!.id}));
  console.log(JSON.stringify({created:true,userId:data.user!.id}));
  process.exit(0);
}
const credentials = JSON.parse(fs.readFileSync(secretFile,'utf8'));
const {data,error} = await auth.auth.signInWithPassword(credentials);
if(error) throw new Error(error.message);
const token = data.session!.access_token;
if(mode==='ui-seed') {
  const question='Do you prefer living in big cities?';
  const normalized=question.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized)).then(buf=>Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''));
  const existing=await auth.from('speaking_questions').select('id').eq('user_id',credentials.userId).eq('content_hash',hash);
  if(existing.error) throw existing.error;
  if(!existing.data?.length) {
    const inserted=await auth.from('speaking_questions').insert({user_id:credentials.userId,question,normalized_question:normalized,content_hash:hash,mode:'ielts',topic:'life_routine',part:'part1',source_type:'manual',source_ref:'speaking-browser-acceptance'}).select('id').single();
    if(inserted.error) throw inserted.error;
    console.log(JSON.stringify(inserted.data));
  } else console.log(JSON.stringify(existing.data));
}
async function call(system:string,user:string,maxTokens=4096,model='deepseek-chat') {
  const started=Date.now();
  const res=await fetch(`${url}/functions/v1/english-coach`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({messages:[{role:'system',content:system},{role:'user',content:user}],speaking_feedback:true,inject_context:false,maxTokens,model,temperature:0.3}),signal:AbortSignal.timeout(150000)});
  if(!res.ok) throw new Error(`english-coach HTTP ${res.status}: ${(await res.text()).slice(0,120)}`);
  const body=await res.json();
  return {elapsedMs:Date.now()-started,model:body.model,raw:body.content,feedback:parseSpeakingResponse(body.content)};
}
async function fullFeedback(question:string, transcript:string) {
 const calls:unknown[]=[]; const started=Date.now();
 const feedback=await runSpeakingPipeline(async options=>{
   const r=await call(options.messages[0].content, options.messages[1].content,options.maxTokens,options.model);
   calls.push({kind:options.messages[0].content.includes('audit gate')?'fidelity-review':options.messages[0].content.includes('reviewer')?'independence-review':options.messages[0].content.includes('strong conversational English speaker')?'model-answer':'my-best-version',...r});
   return {content:r.raw,model:r.model||'unknown'};
 },question,transcript,[],token);
 return {elapsedMs:Date.now()-started,feedback,calls};
}
if(mode==='semantic') {
  const only=(process.argv[3]||'').split(',').map(s=>s.trim()).filter(Boolean);
  const cases=only.length?speakingCases.filter(c=>only.includes(c.id)):speakingCases;
  for(const c of cases) {
    const output=await fullFeedback(c.question,c.input);
    fs.writeFileSync(`${outDir}/${c.id}.json`,JSON.stringify({id:c.id,input:c.input,question:c.question,expectedMode:c.mode,...output},null,2));
    console.log(JSON.stringify({id:c.id,mode:output.feedback.revision_mode,expected:c.mode,elapsedMs:output.elapsedMs,answer:!!output.feedback.final_upgraded_answer,reference:!!output.feedback.reference_answer}));
  }
}
if(mode==='retry') {
  const c=speakingCases[6];
  const first=JSON.parse(fs.readFileSync(`${outDir}/${c.id}.json`,'utf8'));
  const output=await call(buildRetryFeedbackPrompt({originalAnswer:c.input,final_upgraded_answer:first.feedback.final_upgraded_answer,takeaway_expressions:first.feedback.takeaway_expressions}),buildFeedbackPrompt(c.question,first.feedback.final_upgraded_answer,[]));
  fs.writeFileSync(`${outDir}/retry.json`,JSON.stringify(output,null,2));
  console.log(JSON.stringify({checks:output.feedback.retry_checks.length,generatedAnswer:!!output.feedback.final_upgraded_answer,elapsedMs:output.elapsedMs}));
}
if(mode==='audio') {
  const wav=fs.readFileSync('backups/speaking-qa/input.wav');
  let pcm:Buffer|undefined;
  for(let offset=12;offset+8<wav.length;) {
    const size=wav.readUInt32LE(offset+4);
    if(wav.toString('ascii',offset,offset+4)==='data') { pcm=wav.subarray(offset+8,offset+8+size);break; }
    offset+=8+size+(size%2);
  }
  if(!pcm?.length) throw new Error('Missing WAV PCM data');
  const tokenResponse=await fetch(`${url}/functions/v1/aliyun-token`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({language:'english'}),signal:AbortSignal.timeout(30000)});
  if(!tokenResponse.ok) throw new Error(`ASR token HTTP ${tokenResponse.status}`);
  const asr=await tokenResponse.json();
  const taskId=crypto.randomUUID().replaceAll('-','');
  const transcript=await new Promise<string>((resolve,reject)=>{
    const ws=new WebSocket(`wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1?token=${asr.token}`);
    let result=''; let interval:ReturnType<typeof setInterval>|undefined;
    const timer=setTimeout(()=>{ws.close();reject(new Error('ASR timeout'));},90000);
    const send=(name:string,payload={})=>ws.send(JSON.stringify({header:{message_id:crypto.randomUUID().replaceAll('-',''),task_id:taskId,namespace:'SpeechTranscriber',name,appkey:asr.appkey},payload,context:{}}));
    ws.onopen=()=>send('StartTranscription',{format:'pcm',sample_rate:16000,enable_intermediate_result:true,enable_punctuation_prediction:true,max_sentence_silence:1800});
    ws.onerror=()=>{clearTimeout(timer);if(interval)clearInterval(interval);reject(new Error('ASR websocket error'));};
    ws.onmessage=event=>{
      const message=JSON.parse(String(event.data));
      if(message.header.status && message.header.status!==20000000){clearTimeout(timer);if(interval)clearInterval(interval);ws.close();reject(new Error(`ASR status ${message.header.status}`));return;}
      if(message.header.name==='TranscriptionStarted') {
        let offset=0;
        interval=setInterval(()=>{ if(offset>=pcm!.length){clearInterval(interval);send('StopTranscription');return;} ws.send(pcm!.subarray(offset,offset+3200));offset+=3200;},100);
      }
      if(message.header.name==='SentenceEnd') result+=message.payload.result+' ';
      if(message.header.name==='TranscriptionCompleted'){clearTimeout(timer);if(interval)clearInterval(interval);ws.close();resolve(result.trim());}
    };
  });
  if(!transcript) throw new Error('ASR returned empty transcript');
  console.log(JSON.stringify({stage:'ASR',transcript,duration:pcm.length/32000}));
  const question='Do you prefer living in big cities?';
  const output=await fullFeedback(question,transcript);
  if(!output.feedback.final_upgraded_answer) throw new Error('Missing final answer');
  const {data:session,error:sessionError}=await auth.from('speaking_sessions').insert({user_id:credentials.userId,prompt:question,title:'[QA] Speaking audio acceptance',is_test:true,mode:'free_speaking'}).select().single();
  if(sessionError) throw new Error(sessionError.message);
  const path=`${session.id}/acceptance.wav`;
  const upload=await auth.storage.from('speaking-audio').upload(path,wav,{contentType:'audio/wav',upsert:false});
  if(upload.error) throw new Error(upload.error.message);
  const audioUrl=auth.storage.from('speaking-audio').getPublicUrl(path).data.publicUrl;
  const details=output.feedback.detailed_analysis;
  const row={session_id:session.id,user_id:credentials.userId,answer:transcript,transcribed_text:transcript,natural_version:'',combined_feedback:output.feedback.optimization_summary,fluency_score:details.fluencyScore,grammar_score:details.grammarScore,vocabulary_score:details.vocabularyScore,naturalness_score:details.naturalnessScore,audio_url:audioUrl,audio_duration:pcm.length/32000,attempt_round:1,is_retry:false,stt_provider:'aliyun-realtime',stt_mode:'realtime_websocket',...speakingFeedbackStorage(output.feedback)};
  const {data:attempt,error:saveError}=await auth.from('speaking_attempts').insert(row).select().single();
  if(saveError) throw new Error(saveError.message);
  const {data:read,error:readError}=await auth.from('speaking_attempts').select('*').eq('id',attempt.id).single();
  if(readError) throw new Error(readError.message);
  if(normalizeSpeakingFeedback(read).final_upgraded_answer!==output.feedback.final_upgraded_answer || read.transcribed_text!==transcript)throw new Error('Database roundtrip mismatch');
  const downloaded=await fetch(audioUrl);
  if(!downloaded.ok || Buffer.compare(wav,Buffer.from(await downloaded.arrayBuffer()))!==0) throw new Error('Audio roundtrip mismatch');
  fs.writeFileSync(`${outDir}/audio-e2e.json`,JSON.stringify({source:'Synthetic speech WAV; real Aliyun ASR and authenticated Supabase APIs; not physical microphone UI coverage',sessionId:session.id,attemptId:attempt.id,transcript,audioUrl,audioBytes:wav.length,durationSeconds:pcm.length/32000,storageRoundtrip:true,databaseRoundtrip:true,...output},null,2));
  console.log(JSON.stringify({stage:'database',sessionId:session.id,attemptId:attempt.id,audioBytes:wav.length,roundtrip:true}));
}
