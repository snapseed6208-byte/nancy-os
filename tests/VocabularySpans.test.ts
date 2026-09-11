import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {buildSpans,locateOriginal,normalizeWord,selectCandidates} from "../supabase/functions/tem8-vocabulary-agent/spans";

const realChunk=readFileSync(join(process.cwd(),"tests/fixtures/tem8-pdf-chunk0.txt"),"utf8");
const entry=(over:Record<string,unknown>,spanId:string)=>({span_id:spanId,word:"qualify",pos:"v.",type:"new",meaning_zh:"使合格",...over});

describe("deterministic span provenance",()=>{
  it("splits a PDF row into a stable span id and slices context from the raw chunk",()=>{
    const chunk="1   qualify   英:/ ˈ kwɒlɪfaɪ/ 美:/ ˈ kwɑ ː lɪfaɪ/ v. ⼈使合格；限定 2   coarse   英:/kɔ ː s/ 美:/kɔ ː rs/ adj. 粗糙的；粗俗的";
    const spans=buildSpans(chunk,7);
    expect(spans).toHaveLength(2);
    expect(buildSpans(chunk,7)).toEqual(spans); // deterministic for the same batch
    expect(spans[0].span_id.startsWith("7:")).toBe(true);
    expect(spans[1].span_id.startsWith("7:")).toBe(true);
    expect(spans[0].text).toBe(chunk.slice(Number(spans[0].span_id.split(":")[1].split("-")[0]),Number(spans[0].span_id.split(":")[1].split("-")[1])));
    expect(spans[0].text).toContain("qualify");
    // The trailing "2" belongs to the next entry, not to entry 1's definition.
    expect(spans[0].text).not.toMatch(/2\s*$/);
  });

  it("does not treat split IPA spacing as an entry boundary",()=>{
    const chunk="2   coarse   英:/kɔ ː s/ 美:/kɔ ː rs/ adj. 粗糙的";
    const spans=buildSpans(chunk,0);
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toContain("kɔ ː s");
    expect(locateOriginal(spans[0].text,"coarse")?.original).toBe("coarse");
  });

  it("folds Kangxi-radical homoglyphs for matching while keeping the raw slice intact",()=>{
    expect(normalizeWord("⼈")).toBe("人");
    expect(normalizeWord("蓝⾊")).toBe("蓝色");
    const chunk="11   blue   英:/blu ː / 美:/blu ː / adj. 蓝⾊的；悲伤的";
    const spans=buildSpans(chunk,0);
    const {candidates,rejected}=selectCandidates({entries:[entry({word:"blue",meaning_zh:"蓝色的；悲伤的"},spans[0].span_id)]},spans);
    expect(rejected).toEqual([]);
    expect(candidates[0].meaning).toBe("蓝色的；悲伤的");
    // Raw audit trail keeps the extracted homoglyph; only the display layer normalizes it.
    expect(candidates[0].context).toContain("⾊");
  });

  it("locates inflected surface forms as the original",()=>{
    const inflected="5   scared   /skεəd/   adj. 害怕的";
    expect(locateOriginal(inflected,"scare")?.original).toBe("scared");
    expect(locateOriginal(inflected,"scared")?.original).toBe("scared");
    // An exact token wins over an inflection elsewhere in the span.
    const both="5   scared   adj. 害怕的（scare 的过去分词）";
    expect(locateOriginal(both,"scare")?.original).toBe("scare");
  });

  it("rejects a word that is not actually present in its span instead of accepting AI provenance",()=>{
    const spans=buildSpans("1   qualify   v. 限定",0);
    const {candidates,rejected}=selectCandidates({entries:[entry({word:"exacerbate"},spans[0].span_id)]},spans);
    expect(candidates).toEqual([]);
    expect(rejected[0]).toMatchObject({field:"word",reason:"not_in_source_span"});
  });

  it("drops a single malformed entry without failing the rest of the batch",()=>{
    const spans=buildSpans("1   qualify   v. 限定 2   coarse   adj. 粗糙的",0);
    const id0=spans[0].span_id,id1=spans[1].span_id;
    const {candidates,rejected,notes}=selectCandidates({entries:[
      entry({word:"qualify"},id0),
      {span_id:"9:0-9",word:"ghost",pos:"",type:"new",meaning_zh:""},
      entry({word:"",pos:"",type:"new",meaning_zh:""},id1),
      entry({word:"invented",pos:"",type:"made-up",meaning_zh:""},id1),
      null,
      entry({word:"coarse"},id1),
    ]},spans);
    expect(candidates.map(c=>c.word)).toEqual(["qualify","coarse"]);
    expect(rejected.map(r=>r.reason)).toEqual(["unknown_span","missing_word","invalid_type","not_an_object"]);
    expect(rejected.map(r=>r.index)).toEqual([1,2,3,4]);
    expect(notes).toEqual([]);
  });

  it("regresses the real 专八 PDF chunk: every headword gets a program-owned source slice",()=>{
    const spans=buildSpans(realChunk,0);
    // header span + 11 entries
    expect(spans).toHaveLength(12);
    const byWord=["agonizingly","course","prime","chronological","scared","theory","hump","perspective","principal","brisk","blue"];
    const entries=byWord.map(word=>{
      const span=spans.find(s=>locateOriginal(s.text,word));
      expect(span,`span for ${word}`).toBeDefined();
      return {span_id:span!.span_id,word,pos:"",type:"new",meaning_zh:`${word} 的中文释义`};
    });
    const {candidates,rejected}=selectCandidates({entries},spans);
    expect(rejected).toEqual([]);
    expect(candidates).toHaveLength(11);
    for(const c of candidates){
      // Provenance is a verbatim slice of the uploaded file, not AI text.
      expect(realChunk.includes(c.context)).toBe(true);
      expect(c.original.length).toBeGreaterThan(0);
    }
    expect(candidates.find(c=>c.word==="blue")!.context).toContain("⾊");
  });
});
