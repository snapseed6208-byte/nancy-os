import { describe, it, expect } from "vitest";
import { shuffleQuestion, deterministicGrade, publicQuestion, assessmentFocus, validateAssessment, type Question } from "../../supabase/functions/tem8-vocabulary-agent/practice";

const question: Question = {prompt:"Meaning?",options:["correct","near miss","wrong tone","wrong degree"],correct_index:0,expected_answer:"correct",explanation:"Evidence",trigger:"Rule",audio_text:"",rubric:"Meaning"};
describe("persisted vocabulary option permutation", () => {
  it("rejects leaked answers and positional explanations before shuffling",()=>{
    expect(()=>validateAssessment({...question,prompt:"The definition is correct"},"R1")).toThrow();
    expect(()=>validateAssessment({...question,explanation:"第一个选项正确"},"R2")).toThrow();
    expect(validateAssessment(question,"R1")).toBe(question);
  });
  it("covers every answer position and preserves grading for all 24 permutations", () => {
    const positions = new Set<number>();
    const permutations = new Set<string>();
    for(let a=0;a<4;a++) for(let b=0;b<3;b++) for(let c=0;c<2;c++) {
      const draws=[(a+.5)/4,(b+.5)/3,(c+.5)/2];
      const shuffled=shuffleQuestion(question,()=>draws.shift()!);
      positions.add(shuffled.correct_index!);
      permutations.add(shuffled.options.join("|"));
      for(let i=0;i<4;i++) expect(deterministicGrade(shuffled,"R1",String(i))?.score).toBe(shuffled.options[i]==="correct"?100:0);
      expect(publicQuestion(shuffled,"R1")).not.toHaveProperty("correct_index");
      expect(shuffled.expected_answer).toBe("correct");
    }
    expect(positions.size).toBe(4);
    expect(permutations.size).toBe(24);
    expect(question.options[0]).toBe("correct");
  });
  it("leaves production and listening questions unchanged",()=>{
    const production={...question,options:[],correct_index:null};
    expect(shuffleQuestion(production)).toBe(production);
  });
  it("rotates distinct context skills separately from definition skills",()=>{
    const context=[0,1,2].map(i=>assessmentFocus("R2",i));
    expect(new Set(context).size).toBe(3);
    expect(context.some(x=>x===assessmentFocus("R1",0))).toBe(false);
    expect(assessmentFocus("R2",3)).toBe(context[0]);
  });
});
