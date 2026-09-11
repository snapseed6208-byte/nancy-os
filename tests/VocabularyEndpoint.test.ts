import {beforeEach,describe,expect,it,vi} from "vitest";
import {handleLearning} from "../supabase/functions/tem8-vocabulary-agent/learning";
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

