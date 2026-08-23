import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const knowledgeHooks = readFileSync("src/lib/hooks/useResources.ts", "utf8");
const readerHooks = readFileSync("src/lib/hooks/useEnglishReader.ts", "utf8");
const extractFunction = readFileSync("supabase/functions/resource-extract/index.ts", "utf8");

describe("resource module isolation", () => {
  it("excludes English Reader articles from the Knowledge Resource Inbox", () => {
    expect(knowledgeHooks).toContain('const KNOWLEDGE_RESOURCE_SCOPE = "module.is.null,module.neq.english"');
    expect(knowledgeHooks).toContain('.select("*")\n    .or(KNOWLEDGE_RESOURCE_SCOPE)');
  });

  it("guards Knowledge update, restore, and delete mutations with the same scope", () => {
    expect(knowledgeHooks.match(/\.or\(KNOWLEDGE_RESOURCE_SCOPE\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(knowledgeHooks).toContain('throw new Error("该资源不属于知识库，已阻止删除")');
  });

  it("assigns the module namespace when a resource is first inserted", () => {
    expect(extractFunction).toContain('const resourceModule = body.module === "english" ? "english" : "knowledge"');
    expect(extractFunction).toContain("module: resourceModule");
    expect(knowledgeHooks).toContain('module: "knowledge"');
    expect(readerHooks).toContain('module: "english"');
  });

  it("prevents Reader mutations from touching non-English resources", () => {
    expect(readerHooks.match(/\.eq\("module", "english"\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(readerHooks.match(/\.eq\("resource_type", "article"\)/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
