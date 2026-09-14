import { describe,it,expect } from "vitest";
import { extractResponse } from "../../supabase/functions/tem8-vocabulary-agent/partial";
import { selectCandidates } from "../../supabase/functions/tem8-vocabulary-agent/spans";
describe("partial extraction without losing valid vocabulary",()=>{
  it("keeps complete entries but never repairs an incomplete entry",()=>{
    const entry={word:"qualify",meaning_zh:'quote " and brace }',type:"new",span_id:"0:0-8"};
    const result=extractResponse('{"entries":['+JSON.stringify(entry)+',{"word":"unfinished');
    expect(result).toEqual({partial:true,data:{entries:[entry]}});
  });
  it("does not treat complete JSON as partial or accept entirely unusable output",()=>{
    expect(extractResponse('```json\n{"entries":[]}\n```').partial).toBe(false);
    expect(()=>extractResponse('{"entries":[{"word":"unfinished')).toThrow();
    expect(()=>extractResponse('nonsense')).toThrow();
  });
  it("validates and keeps more than 150 unique sourced words for bounded persistence",()=>{
    const entries=Array.from({length:170},(_,i)=>({word:'word'+String.fromCharCode(97+Math.floor(i/26),97+i%26),span_id:'source',type:'new',meaning_zh:'词义'}));
    const source=entries.map(e=>e.word).join(' ');
    const result=selectCandidates({entries},[{span_id:'source',text:source}]);
    expect(result.candidates).toHaveLength(170);expect(result.rejected).toHaveLength(0);
  });
});
