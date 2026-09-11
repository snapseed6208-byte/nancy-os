import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {currentLevel,dailyQueueMix,dailyVocabularyQueue,levelLabels,nextPracticeMode,requiredMode,statusLabels,targetLabels,targetLevel,targetMet,targetReason,type QueueMode,type TestMode,type VocabularyPlan,type VocabularyWord} from "../src/lib/english/vocabulary";
import {clampLevel} from "../supabase/functions/tem8-vocabulary-agent/practice";

const passes=(d:TestMode,n:number)=>({[d]:{passes:n,last_day:"2026-01-01",score:100}} as VocabularyWord["mastery"]);
const word=(id:string,extra:Partial<VocabularyWord>={}):VocabularyWord=>({id,word:id,pos:"v.",meaning:"原义",type:"new",sources:[],enrichment:null,level:"R0",status:"inbox",review_stage:0,due_at:null,error_count:0,version:0,...extra});
const card=readFileSync(join(process.cwd(),"src/components/english/vocabulary/VocabularyCard.tsx"),"utf8");
const page=readFileSync(join(process.cwd(),"src/components/english/vocabulary/VocabularyLibrary.tsx"),"utf8");
const progress=readFileSync(join(process.cwd(),"src/components/english/vocabulary/VocabularyProgress.tsx"),"utf8");
const edge=readFileSync(join(process.cwd(),"supabase/functions/tem8-vocabulary-agent/index.ts"),"utf8");
const submit=readFileSync(join(process.cwd(),"supabase/functions/tem8-vocabulary-agent/learning.ts"),"utf8");

describe("target depth decides how far each word is pushed",()=>{
  it("stops at R1: a recognition-only word never advances to R2",()=>{
    const w=word("w",{target_level:"R1",mastery:passes("R1",1),status:"review"});
    expect(requiredMode(w)).toBeNull();
    expect(targetMet(w)).toBe(true);
    expect(nextPracticeMode(w)).toMatchObject({mode:"R1",done:true});
    expect(nextPracticeMode(w).reason).toContain("目标已达成");
  });
  it("target R2 auto-selects the contextual test once R1 is proven",()=>{
    const w=word("w",{target_level:"R2",mastery:passes("R1",1)});
    expect(nextPracticeMode(w)).toMatchObject({mode:"R2",done:false});
    const colloc=word("c",{target_level:"R2",type:"collocation",mastery:passes("R1",1)});
    expect(nextPracticeMode(colloc).mode).toBe("collocation");
  });
  it("target P1 does not jump past an unmet R2",()=>{
    const w=word("w",{target_level:"P1",mastery:passes("R1",1)});
    expect(requiredMode(w)).toBe("R2");
    expect(nextPracticeMode(w).mode).toBe("R2");
  });
  it("target P2 advances strictly in order and needs two passes per output level",()=>{
    const base={target_level:"P2"} as const;
    expect(nextPracticeMode(word("w",{...base,mastery:passes("R1",1)})).mode).toBe("R2");
    expect(nextPracticeMode(word("w",{...base,mastery:{...passes("R1",1),...passes("R2",1)}})).mode).toBe("P1");
    const p1Once=word("w",{...base,mastery:{...passes("R1",1),...passes("R2",1),...passes("P1",1)}});
    expect(nextPracticeMode(p1Once).mode).toBe("P1");
    const p1Twice=word("w",{...base,mastery:{...passes("R1",1),...passes("R2",1),...passes("P1",2)}});
    expect(nextPracticeMode(p1Twice).mode).toBe("P2");
    expect(targetMet(p1Twice)).toBe(false);
  });
  it("listening is a separate dimension that never changes the reading target",()=>{
    const w=word("w",{target_level:"R1",mastery:passes("R1",1),status:"review",listening_due_at:"2020-01-01",listening_status:"weak"});
    expect(nextPracticeMode(w,Date.parse("2026-01-01"))).toMatchObject({mode:"listening",done:false});
    // The reading target is still met and unchanged; listening schedules its own check.
    expect(targetLevel(w)).toBe("R1");
    expect(requiredMode(w)).toBeNull();
    // A not-yet-due listening review never displaces the reading step.
    const notDue=word("w",{target_level:"R2",listening_due_at:"2030-01-01"});
    expect(nextPracticeMode(notDue,Date.parse("2026-01-01")).mode).toBe("R1");
  });
  it("prioritizes a fresh-context retest after an error",()=>{
    const w=word("w",{target_level:"R2",status:"error",error_count:1,mastery:passes("R1",1)});
    const next=nextPracticeMode(w);
    expect(next.mode).toBe("R2");
    expect(next.reason).toContain("新语境");
  });
  it("falls back to R1 when a legacy word has no target_level",()=>{
    const w=word("w");
    expect(w.target_level).toBeUndefined();
    expect(targetLevel(w)).toBe("R1");
    expect(nextPracticeMode(w).mode).toBe("R1");
    expect(targetReason(w)).toContain("阅读");
  });
});

describe("display layer never leaks internal codes or over-claims mastery",()=>{
  it("caps the shown level at the target even if the stored level overshot",()=>{
    const w=word("w",{level:"P2",target_level:"R1"});
    expect(currentLevel(w)).toBe("R1");
    expect(levelLabels[currentLevel(w)]).toBe("阅读识别");
  });
  it("renders every internal code as user language",()=>{
    expect(targetLabels).toEqual({R1:"阅读识别",R2:"语境掌握",P1:"提示输出",P2:"主动运用"});
    expect(statusLabels).toMatchObject({inbox:"待学习",learning:"学习中",stable:"已掌握",archived:"已归档"});
    expect(levelLabels.R0).toBe("未开始");
  });
  it("keeps the library filters on three independent dimensions",()=>{
    for(const label of ['aria-label="学习状态"','aria-label="学习目标筛选"','aria-label="分类筛选"']) expect(page,label).toContain(label);
    expect(page).toContain("学习状态<select");
    expect(page).toContain("学习目标<select");
    // Raw codes are gone from the list row.
    expect(page).not.toContain("{w.level} → {w.target_level");
  });
  it("renders the analytics tiles in user language and counts the capped level",()=>{
    expect(progress).toContain("{targetLabels[level]} 当前掌握");
    expect(progress).toContain("currentLevel(w)===level");
    expect(progress).not.toContain("{level} 当前掌握");
  });
  it("hides the test-mode selector behind 更多 while keeping manual tests reachable",()=>{
    expect(card).toContain("自定义测试");
    expect(card).toContain("更多");
    expect(card).toContain("用所选类型出题");
    expect(card).not.toContain('aria-label="测试层级"');
    // The default CTA is the system-chosen next step, not a level picker.
    expect(card).toContain("继续学习");
    expect(card).toContain("开始复习");
    expect(card).toMatch(/onClick=\{\(\)=>void run\(\(\)=>onTest\(next\.mode\)\)\}/);
  });
});

// The stored level is a ceiling, not a free-running maximum. A manual test past the goal is graded
// and recorded, but the persisted level must never climb past target_level, so "stored level" always
// equals real semantic mastery. These mirror the value the edge writes into vocabulary_words.level.
describe("mastery can never be persisted above the word's target",()=>{
  it("target R1 + a passed P1 does not push the stored level past R1",()=>{
    expect(clampLevel("P1","R1")).toBe("R1");
    expect(clampLevel("P2","R1")).toBe("R1");
    // The learner still sees the word where they committed to stop.
    expect(currentLevel(word("w",{level:"R2",target_level:"R1"}))).toBe("R1");
  });
  it("target R2 + a passed P2 does not push the stored level past R2",()=>{
    expect(clampLevel("P2","R2")).toBe("R2");
    expect(clampLevel("P1","R2")).toBe("R2");
  });
  it("target P1 may reach P1 but never P2",()=>{
    expect(clampLevel("R2","P1")).toBe("R2");
    expect(clampLevel("P1","P1")).toBe("P1");
    expect(clampLevel("P2","P1")).toBe("P1");
  });
  it("target P2 is the only case that allows full progression",()=>{
    for(const l of ["R0","R1","R2","P1","P2"]) expect(clampLevel(l,"P2")).toBe(l);
  });
  it("never lowers a level that is already at or below the target",()=>{
    expect(clampLevel("R0","R1")).toBe("R0");
    expect(clampLevel("R1","P2")).toBe("R1");
  });
  it("leaves the stored level untouched when the target is unrecognised",()=>{
    expect(clampLevel("P1","bogus")).toBe("P1");
  });
  it("the submit path actually applies the clamp, so the guard cannot be bypassed",()=>{
    expect(submit).toContain("clampLevel(level");
    expect(submit).toContain("target_level");
    // Listening is its own dimension and must not be clamped by the reading target.
    expect(submit).toContain('a.mode==="listening" ? level : clampLevel');
  });
});

// The plan only decides which words are in scope; nextPracticeMode decides the work. This is the
// core promise of 不同词不同投入: a word is never scheduled for a mode deeper than its own target.
describe("no word is ever scheduled deeper than its own target",()=>{
  const mixed=()=>{
    const r1=Array.from({length:10},(_,i)=>word(`r1-${i}`,{target_level:"R1"}));
    const r2=Array.from({length:4},(_,i)=>word(`r2-${i}`,{target_level:"R2",mastery:passes("R1",1)}));
    const p1=Array.from({length:2},(_,i)=>word(`p1-${i}`,{target_level:"P1",mastery:{...passes("R1",1),...passes("R2",1)}}));
    const p2=Array.from({length:1},(_,i)=>word(`p2-${i}`,{target_level:"P2",mastery:{...passes("R1",1),...passes("R2",1),...passes("P1",2)}}));
    return [...r1,...r2,...p1,...p2];
  };
  const plan=(ids:string[]):VocabularyPlan=>({user_id:"u",day:"2026-01-01",new_ids:ids,familiar_ids:[],production_ids:[],target:25});
  const rank:Record<QueueMode,number>={R1:1,R2:2,P1:3,P2:4,collocation:2,listening:0,review:0};

  it("produces the mode mix each target implies and nothing harder",()=>{
    const words=mixed();
    const p=plan(words.map(w=>w.id));
    expect(dailyQueueMix(words,p,Date.parse("2026-01-01"))).toEqual([
      {mode:"R1",count:10},{mode:"R2",count:4},{mode:"P1",count:2},{mode:"P2",count:1},
    ]);
    for(const w of dailyVocabularyQueue(words,p,Date.parse("2026-01-01"))){
      const next=nextPracticeMode(w,Date.parse("2026-01-01"));
      expect(rank[next.done ? "review" : next.mode]).toBeLessThanOrEqual(rank[targetLevel(w)]);
    }
  });
  it("a word that already met its target counts as review, not as a harder test",()=>{
    const words=[word("done",{target_level:"R1",mastery:passes("R1",1),status:"review"}),...Array.from({length:3},(_,i)=>word(`n-${i}`,{target_level:"R1"}))];
    const p=plan(words.map(w=>w.id));
    expect(dailyQueueMix(words,p,Date.parse("2026-01-01"))).toEqual([{mode:"R1",count:3},{mode:"review",count:1}]);
  });
});

// Re-evaluation is a preview. The server recommends and writes nothing; only the learner's explicit
// confirmation, via the normal edit path (which marks the target as curated), changes target_level.
describe("re-evaluating an old word's target is preview-then-confirm, never a silent overwrite",()=>{
  const recommendBranch=edge.slice(edge.indexOf('body.action === "recommend"'),edge.indexOf('body.action === "enrich"'));
  it("the recommend action is read-only: it selects the word and returns a suggestion",()=>{
    expect(recommendBranch).toContain("recommended_level");
    expect(recommendBranch).toContain("target_reason");
    expect(recommendBranch).toContain("curated");
    expect(recommendBranch).not.toContain(".update(");
    expect(recommendBranch).not.toContain(".insert(");
  });
  it("automatic enrichment still refuses to overwrite a curated target",()=>{
    expect(edge).toContain("!w.curated");
  });
  it("the card only writes a new target through the confirmed edit path",()=>{
    expect(card).toContain("重新评估学习目标");
    expect(card).toContain("保留当前目标");
    expect(card).toContain("采用建议");
    expect(card).toContain("model.edit.mutateAsync({word:w,type,target:rec.recommended_level");
  });
});
