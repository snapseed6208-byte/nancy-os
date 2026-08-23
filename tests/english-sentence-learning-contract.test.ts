import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const learn = readFileSync("src/pages/EnglishLearn.tsx", "utf8");

describe("English Learn sentence attempt and failure contract", () => {
  it("saves the sentence before starting AI analysis", () => {
    const submit = learn.indexOf("const handleSubmitSentence");
    const save = learn.indexOf("await updateItem.mutateAsync", submit);
    const analyze = learn.indexOf("await runSentenceAI", submit);
    expect(save).toBeGreaterThan(submit);
    expect(analyze).toBeGreaterThan(save);
  });

  it("records each revised submission with an attempt number", () => {
    expect(learn).toContain("sentenceAttemptRef.current + 1");
    expect(learn).toContain("attempt_number: attemptNumber");
    expect(learn).toContain("practiceLogIdRef.current = await insertPracticeLog");
  });

  it("keeps the learner in control after analysis failure", () => {
    expect(learn).toContain("分析暂时失败");
    expect(learn).toContain("你的句子已经保留，不会自动进入下一条");
    expect(learn).toContain("重试 AI 分析");
    expect(learn).toContain("继续修改");
    expect(learn).toContain("稍后再试");
    expect(learn).not.toMatch(/setTimeout\([\s\S]{0,200}(completeCurrent|setCurrentIndex)/);
  });
});
