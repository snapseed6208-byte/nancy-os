import { describe, expect, it } from "vitest";
import { learningQueue, vocabularyChunks, vocabularyPriority, type VocabularyWord } from "@/lib/english/vocabulary";
import { validateEntries, validateEnrichment } from "../../supabase/functions/tem8-vocabulary-agent/validation";

const word = (id:string,extra:Partial<VocabularyWord>={}):VocabularyWord => ({id,word:id,pos:"v.",meaning:"原义",type:"new",sources:[],enrichment:null,level:"R0",status:"inbox",review_stage:0,due_at:null,error_count:0,version:0,...extra});
describe("vocabulary scheduling and import",()=>{
  it("preserves the whole source including boundary text and limits batch size",()=>{
    const input=Array.from({length:1500},(_,i)=>`term${i} 中文义${i}`).join(" ");
    const chunks=vocabularyChunks(input);
    expect(chunks.every(c=>c.length<=3500)).toBe(true);
    expect(chunks[0]+chunks.slice(1).map(c=>c.slice(200)).join("")).toBe(input);
    expect(vocabularyChunks("")).toEqual([]);
  });
  it("schedules overdue stable words before new words, excludes future reviews, respects limit",()=>{
    const all=[word("new"),word("familiar",{type:"familiar"}),word("future",{due_at:"2030-01-01"}),word("due",{status:"stable",due_at:"2020-01-01"})];
    expect(learningQueue(all,Date.parse("2026-01-01"),3).map(w=>w.id)).toEqual(["due","familiar","new"]);
  });
  it("does not inflate priority for multiple excerpts from the same PDF",()=>{
    const src={import_id:"a",name:"A",original:"word",context:"word 释义"};
    expect(vocabularyPriority(word("a",{sources:[src,src]}))).toBe(vocabularyPriority(word("b",{sources:[src]})));
  });
  it("rejects hallucinated provenance and malformed AI output instead of partially saving",()=>{
    const entry={word:"exacerbate",original:"exacerbated",context:"exacerbated 加剧",meaning:"加剧",pos:"v.",type:"new"};
    expect(validateEntries({entries:[entry]},"exacerbated 加剧")[0].word).toBe("exacerbate");
    expect(()=>validateEntries({entries:[entry]},"unrelated source")).toThrow();
    expect(()=>validateEntries({entries:[{...entry,type:"invented"}]},"exacerbated 加剧")).toThrow();
    expect(()=>validateEntries({},"text")).toThrow();
    expect(validateEntries({entries:[{...entry,word:"cliché",original:"cliché",context:"cliché 陈词滥调",meaning:"陈词滥调"}]},"cliché 陈词滥调")[0].word).toBe("cliché");
  });
  it("rejects incomplete enrichment and permits bounded specialized cards",()=>{
    expect(()=>validateEnrichment({core_meaning:"test"})).toThrow();
    const e={core_meaning:"地址",tem8_meaning:"处理",english_definition:"deal with",pronunciation:"",known_meaning:"地址",trigger:"address + issue",trap:"勿套用地址",register:"formal",recommended_level:"R2",value:"high",collocations:["address an issue"],examples:["We address the issue."]};
    expect(validateEnrichment(e).trigger).toBe("address + issue");
    expect(()=>validateEnrichment({...e,examples:[]})).toThrow();
  });
});
