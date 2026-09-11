import { describe, expect, it } from "vitest";
import { learningQueue, vocabularyChunks, vocabularyPriority, type VocabularyWord } from "@/lib/english/vocabulary";
import { validateEnrichment } from "../../supabase/functions/tem8-vocabulary-agent/validation";

const word = (id:string,extra:Partial<VocabularyWord>={}):VocabularyWord => ({id,word:id,pos:"v.",meaning:"原义",type:"new",sources:[],enrichment:null,level:"R0",status:"inbox",review_stage:0,due_at:null,error_count:0,version:0,...extra});
describe("vocabulary scheduling and import",()=>{
  it("preserves the whole source and sizes batches by entry count",()=>{
    const input=Array.from({length:150},(_,i)=>`${i+1}   term${i}   /tɜːm/   n. 中文义${i}`).join(" ");
    const chunks=vocabularyChunks(input);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(input);
    expect(chunks.every(c=>c.length<=6000)).toBe(true);
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
  it("rejects malformed AI output instead of partially saving",()=>{
    expect(()=>validateEnrichment({},"new")).toThrow();
  });
  it("rejects incomplete enrichment and permits bounded specialized cards",()=>{
    expect(()=>validateEnrichment({core_meaning:"test"})).toThrow();
    const e={core_meaning:"地址",tem8_meaning:"处理",english_definition:"deal with",pronunciation:"",known_meaning:"地址",trigger:"address + issue",trap:"勿套用地址",register:"formal",recommended_level:"R2",value:"high",collocations:["address an issue"],examples:["We address the issue."]};
    expect(validateEnrichment(e).trigger).toBe("address + issue");
    expect(()=>validateEnrichment({...e,examples:[]})).toThrow();
  });
});
