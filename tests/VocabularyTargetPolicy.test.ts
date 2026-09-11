import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {currentLevel,levelLabels,nextPracticeMode,requiredMode,statusLabels,targetLabels,targetLevel,targetMet,targetReason,type TestMode,type VocabularyWord} from "../src/lib/english/vocabulary";

const passes=(d:TestMode,n:number)=>({[d]:{passes:n,last_day:"2026-01-01",score:100}} as VocabularyWord["mastery"]);
const word=(id:string,extra:Partial<VocabularyWord>={}):VocabularyWord=>({id,word:id,pos:"v.",meaning:"原义",type:"new",sources:[],enrichment:null,level:"R0",status:"inbox",review_stage:0,due_at:null,error_count:0,version:0,...extra});
const card=readFileSync(join(process.cwd(),"src/components/english/vocabulary/VocabularyCard.tsx"),"utf8");
const page=readFileSync(join(process.cwd(),"src/components/english/vocabulary/VocabularyLibrary.tsx"),"utf8");
const progress=readFileSync(join(process.cwd(),"src/components/english/vocabulary/VocabularyProgress.tsx"),"utf8");

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
