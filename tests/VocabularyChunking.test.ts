import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {vocabularyChunks,CHUNK_MAX_CHARS} from "../src/lib/english/vocabulary";
import {layoutEntries,buildSpans,locateOriginal,selectCandidates} from "../supabase/functions/tem8-vocabulary-agent/spans";

const full=readFileSync(join(process.cwd(),"tests/fixtures/tem8-pdf-full.txt"),"utf8");

// The chunker as it stood before Phase 2 (HEAD e8376c4): fixed 3500-char window, an
// 80-alpha-token "dense" cut and a 200-char overlap. Kept here only as the before-image
// for the same fixture; production no longer contains it.
function legacyChunks(text:string,size=3500):string[]{
  const chunks:string[]=[];
  for(let start=0;start<text.length;){
    let end=Math.min(start+size,text.length);
    if(end<text.length){const boundary=text.lastIndexOf(" ",end);if(boundary>start+size/2)end=boundary;}
    const terms=[...text.slice(start,end).matchAll(/[A-Za-z][A-Za-z'-]*/g)];
    const denseBoundary=terms.slice(80).find(term=>term.index>=400);
    if(denseBoundary)end=start+denseBoundary.index;
    chunks.push(text.slice(start,end));
    if(end===text.length)break;
    start=end-200;
  }
  return chunks;
}

const entries=(s:string)=>(s.match(/(?:^|\s)\d{1,4}(?=\s)/g)||[]).length;
const alpha=(s:string)=>(s.match(/[A-Za-z][A-Za-z'-]*/g)||[]).length;
const starts=(chunks:string[])=>chunks.map(c=>c.slice(0,12));
const cutOffsets=(text:string,chunks:string[])=>{const out:number[]=[];let n=0;for(let i=0;i<chunks.length-1;i++){n+=chunks[i].length;out.push(n);}return out;};
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;};

describe("entry-boundary chunking on the real 专八 PDF",()=>{
  const after=vocabularyChunks(full);
  const before=legacyChunks(full);

  it("A. every batch starts at a complete entry boundary, never mid-IPA/definition/word",()=>{
    // Chunk 0 owns the file header; every later batch must begin with an index cell "N   ...".
    expect(after[0].startsWith("#")).toBe(true);
    for(const [i,chunk] of after.entries()){
      if(i===0)continue;
      expect(/^\d{1,4}\s/.test(chunk),`batch ${i} starts with ${JSON.stringify(chunk.slice(0,24))}`).toBe(true);
    }
    // No batch begins with a bare lowercase fragment or a lone IPA slash.
    expect(after.slice(1).filter(c=>/^[a-z]/.test(c))).toEqual([]);
    expect(after.filter(c=>c.startsWith("/"))).toEqual([]);
    // The legacy overlap started batches mid-word; this is the regression Phase 2 removes.
    expect(before.slice(1).filter(c=>/^\d{1,4}\s/.test(c)).length).toBeLessThan(before.length-1);
  });

  it("B. packs a batch by entry count and never exceeds the character cap",()=>{
    const words=after.map(entries);
    const chars=after.map(c=>c.length);
    // ~30 entries per batch, capped, and far fewer batches than the 80-token split produced.
    expect(Math.max(...words)).toBeLessThanOrEqual(40);
    expect(after.length).toBeLessThan(before.length);
    expect(Math.max(...chars)).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
    const avgWords=words.reduce((a,b)=>a+b,0)/words.length;
    expect(avgWords).toBeGreaterThanOrEqual(20);
    expect(avgWords).toBeLessThanOrEqual(40);
    console.log("B before:",JSON.stringify({batches:before.length,avgWords:+(before.map(entries).reduce((a,b)=>a+b,0)/before.length).toFixed(1),medianWords:median(before.map(entries)),maxWords:Math.max(...before.map(entries)),avgChars:+(before.reduce((a,c)=>a+c.length,0)/before.length).toFixed(1),maxChars:Math.max(...before.map(c=>c.length)),maxAlpha:Math.max(...before.map(alpha))}));
    console.log("B after :",JSON.stringify({batches:after.length,avgWords:+avgWords.toFixed(1),medianWords:median(words),maxWords:Math.max(...words),avgChars:+(chars.reduce((a,b)=>a+b,0)/chars.length).toFixed(1),maxChars:Math.max(...chars),maxAlpha:Math.max(...after.map(alpha))}));
  });

  it("C. tiles the source losslessly so provenance slices stay verbatim",()=>{
    expect(after.join("")).toBe(full);
    // Every span's context is a byte-exact slice of the uploaded file, and a synthetic
    // entry per span (headword = first Latin token) is accepted with zero rejects.
    for(let i=0;i<Math.min(3,after.length);i++){
      const spans=buildSpans(after[i],i);
      expect(spans.length).toBeGreaterThan(0);
      const list=spans.map(s=>({span_id:s.span_id,word:(/([A-Za-z][A-Za-z'-]*)/.exec(s.text)||[])[1]||"",pos:"",type:"new",meaning_zh:"x"}));
      const {candidates,rejected}=selectCandidates({entries:list},spans);
      expect(rejected,`batch ${i} rejects`).toEqual([]);
      expect(candidates.length).toBeGreaterThan(0);
      for(const c of candidates){
        expect(full.includes(c.context)).toBe(true);
        expect(locateOriginal(c.context,c.word)).not.toBeNull();
      }
    }
  });

  it("E. falls back to separator boundaries when a PDF has no numbered entries",()=>{
    const prose="alpha beta gamma delta epsilon zeta eta theta iota kappa ".repeat(300);
    expect(layoutEntries(prose).indexed).toBe(false);
    const chunks=vocabularyChunks(prose);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(prose);
    expect(Math.max(...chunks.map(c=>c.length))).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
    // Cuts only ever touch whitespace — never the middle of a word.
    for(const k of cutOffsets(prose,chunks)) expect(/\s/.test(prose[k-1])||/\s/.test(prose[k]),`cut at ${k}`).toBe(true);
    // A single cell larger than the cap is split at whitespace, still losslessly.
    const oneCell="token ".repeat(2000);
    const oversized=vocabularyChunks(oneCell);
    expect(oversized.length).toBeGreaterThan(1);
    expect(oversized.join("")).toBe(oneCell);
    expect(Math.max(...oversized.map(c=>c.length))).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
    for(const k of cutOffsets(oneCell,oversized)) expect(/\s/.test(oneCell[k]),`cut at ${k}`).toBe(true);
  });
});
