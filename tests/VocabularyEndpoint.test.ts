import {beforeEach,describe,expect,it,vi} from "vitest";
import {handleLearning} from "../supabase/functions/tem8-vocabulary-agent/learning";
import {handleExtract} from "../supabase/functions/tem8-vocabulary-agent/extract";
import {buildSpans} from "../supabase/functions/tem8-vocabulary-agent/spans";
const ai=vi.hoisted(()=>vi.fn());
vi.mock("../supabase/functions/_shared/ai.ts",()=>({aiRuntime:ai}));
const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const payload={prompt:"Choose meaning",options:["limit","reject","accept","explain"],correct_index:0,expected_answer:"limit",explanation:"限定",trigger:"abstract object",audio_text:"",rubric:"meaning"};
function fakeDb(mode="R2",overrides:Record<string,unknown>={}) {
  const tables:Record<string,Record<string,unknown>[]>={
    vocabulary_attempts:[{id:"a",user_id:"u",word_id:"w",question_id:"q",mode,completed_at:null,day:day(),...overrides}],
    vocabulary_questions:[{id:"q",user_id:"u",content_version:0,payload}],vocabulary_words:[{id:"w",user_id:"u",word:"qualify",content_version:0,archived:false}],
  };
  const rpc=vi.fn().mockResolvedValue({data:{score:100,passed:true},error:null});
  const db={rpc,from:(table:string)=>{
    const filters:[string,unknown][]=[];
    const query={select:()=>query,eq:(k:string,v:unknown)=>{filters.push([k,v]);return query;},single:async()=>{
      const data=tables[table]?.find(row=>filters.every(([k,v])=>row[k]===v));return {data,error:data?null:{message:"not found"}};
    }};return query;
  }};
  return {db:db as unknown as Parameters<typeof handleLearning>[1],rpc,tables};
}
beforeEach(()=>ai.mockReset());
describe("vocabulary authenticated grading endpoint",()=>{
  it("grades objective answers without paying for another AI call",async()=>{const {db,rpc}=fakeDb();await handleLearning({action:"submit",attemptId:"a",answer:"0"},db,db,"u");expect(ai).not.toHaveBeenCalled();expect(rpc).toHaveBeenCalledWith("complete_vocabulary_attempt",expect.objectContaining({p_user:"u",p_answer:"limit",p_feedback:expect.objectContaining({score:100})}));});
  it("does not write progress when production AI fails",async()=>{const {db,rpc}=fakeDb("P2");ai.mockResolvedValue({success:false,error:"AI unavailable"});await expect(handleLearning({action:"submit",attemptId:"a",answer:"This qualifies the claim."},db,db,"u")).rejects.toThrow("AI unavailable");expect(rpc).not.toHaveBeenCalled();});
  it("returns an already-saved result without regrading",async()=>{const {db,rpc}=fakeDb("P2",{completed_at:"2026-09-10",feedback:{score:83}});expect(await handleLearning({action:"submit",attemptId:"a",answer:"different answer"},db,db,"u")).toEqual({score:83});expect(ai).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();});
  it("prevents a different user from submitting an attempt",async()=>{const {db,rpc}=fakeDb();await expect(handleLearning({action:"submit",attemptId:"a",answer:"0"},db,db,"other")).rejects.toThrow("测试记录不存在");expect(rpc).not.toHaveBeenCalled();});
  it("rejects an expired midnight attempt before spending tokens",async()=>{const {db,rpc}=fakeDb("P2",{day:"2000-01-01"});await expect(handleLearning({action:"submit",attemptId:"a",answer:"answer"},db,db,"u")).rejects.toThrow("日期已变更");expect(ai).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();});
});
const CHUNK="1   qualify   英:/ ˈ kwɒlɪfaɪ/   v. 使⼈合格；限定 2   coarse   /kɔ ː s/   adj. 粗糙的";
function extractDb(chunks=[CHUNK],completed:number[]=[]) {
  const rpc=vi.fn(async (_name:string,p:{p_entries:unknown[]})=>({data:p.p_entries.length,error:null}));
  const db={from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:"imp",chunks,completed_chunks:completed,source_kind:"vocabulary"},error:null})})})}),rpc};
  return {db:db as unknown as Parameters<typeof handleExtract>[1],rpc};
}
describe("vocabulary extract endpoint owns provenance",()=>{
  it("accepts enrichment keyed by span_id without any source quote from the AI",async()=>{
    const {db,rpc}=extractDb();
    const [s0,s1]=buildSpans(CHUNK,0);
    const aiPayload={entries:[{span_id:s0.span_id,word:"qualify",pos:"v.",type:"new",meaning_zh:"使某人合格"},{span_id:s1.span_id,word:"coarse",pos:"adj.",type:"new",meaning_zh:"粗糙的"}]};
    ai.mockResolvedValue({success:true,data:aiPayload});
    const result=await handleExtract({importId:"imp",chunk:0},db);
    expect(result.saved).toBe(2);
    expect(rpc).toHaveBeenCalledTimes(1);
    const sent=rpc.mock.calls[0][1].p_entries as Record<string,string>[];
    expect(sent.map(e=>e.word)).toEqual(["qualify","coarse"]);
    // original/context are reattached from the span slice; the AI never supplied them.
    expect(sent[0].context).toBe(s0.text);
    expect(sent[0].original).toBe("qualify");
    expect(sent[1].original).toBe("coarse");
    const prompt=(ai.mock.calls[0][0] as {content:string}[]).map(m=>m.content).join("\n");
    expect(prompt).toContain("never copy");
    expect(prompt).not.toContain('"original":"exact surface form');
    expect(prompt).toContain(s0.span_id);
  });
  it("ignores AI-supplied original/context and keeps the program slice",async()=>{
    const {db,rpc}=extractDb();
    const [s0]=buildSpans(CHUNK,0);
    ai.mockResolvedValue({success:true,data:{entries:[{span_id:s0.span_id,word:"qualify",pos:"",type:"new",meaning_zh:"使合格",original:"HALLUCINATED",context:"HALLUCINATED CONTEXT"}]}});
    await handleExtract({importId:"imp",chunk:0},db);
    const sent=rpc.mock.calls[0][1].p_entries as Record<string,string>[];
    expect(sent[0].original).toBe("qualify");
    expect(sent[0].context).toBe(s0.text);
    expect(JSON.stringify(sent)).not.toContain("HALLUCINATED");
  });
  it("saves the good entries and reports rejects for the bad ones in the same batch",async()=>{
    const {db,rpc}=extractDb();
    const [s0,s1]=buildSpans(CHUNK,0);
    ai.mockResolvedValue({success:true,data:{entries:[
      {span_id:s1.span_id,word:"coarse",pos:"adj.",type:"new",meaning_zh:"粗糙的"},
      {span_id:"nope",word:"ghost",pos:"",type:"new",meaning_zh:""},
      {span_id:s0.span_id,word:"qualify",pos:"",type:"wrong-type",meaning_zh:""},
      {span_id:s0.span_id,word:"exacerbate",pos:"",type:"new",meaning_zh:""},
    ]}});
    const result=await handleExtract({importId:"imp",chunk:0},db);
    expect(result.saved).toBe(1);
    expect(result.rejected.map(r=>r.reason)).toEqual(["unknown_span","invalid_type","not_in_source_span"]);
    expect(rpc.mock.calls[0][1].p_entries).toHaveLength(1);
  });
  it("marks the chunk complete even when every entry is rejected so the import advances",async()=>{
    const {db,rpc}=extractDb();
    ai.mockResolvedValue({success:true,data:{entries:[{span_id:"nope",word:"ghost",pos:"",type:"new",meaning_zh:""}]}});
    const result=await handleExtract({importId:"imp",chunk:0},db);
    expect(result.saved).toBe(0);
    expect(result.rejected).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("save_vocabulary_chunk",expect.objectContaining({p_chunk:0,p_entries:[]}));
  });
  it("does not regrade an already-completed chunk",async()=>{
    const {db,rpc}=extractDb([CHUNK],[0]);
    const result=await handleExtract({importId:"imp",chunk:0},db);
    expect(result).toEqual({saved:0,rejected:[],notes:[],spans:0});
    expect(ai).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();
  });
  it("surfaces provider failure as a 5xx and writes nothing",async()=>{
    const {db,rpc}=extractDb();
    ai.mockResolvedValue({success:false,error:"AI unavailable"});
    await expect(handleExtract({importId:"imp",chunk:0},db)).rejects.toMatchObject({status:502});
    expect(rpc).not.toHaveBeenCalled();
  });
});

