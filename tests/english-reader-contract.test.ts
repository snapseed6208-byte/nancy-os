import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/101_english_reader.sql", "utf8");
const agent = readFileSync("supabase/functions/english-reader-agent/index.ts", "utf8");
const sharedAi = readFileSync("supabase/functions/_shared/ai.ts", "utf8");
const routes = readFileSync("src/App.tsx", "utf8");

describe("English Reader database and AI contracts", () => {
  it.each(["books", "chapters", "reading_progress", "saved_reading_expressions"])(
    "creates and protects the %s table",
    (table) => {
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
      expect(migration).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    },
  );

  it("saves a reading expression and its library record in one RPC", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.save_reading_expression");
    expect(migration).toContain("INSERT INTO public.expressions");
    expect(migration).toContain("INSERT INTO public.saved_reading_expressions");
    expect(migration).toContain("SECURITY INVOKER");
  });

  it("requires authentication and uses the shared DeepSeek runtime", () => {
    expect(agent).toContain("authenticateOrRespond");
    expect(agent).toContain("aiRuntime<ReaderAnalysis>");
    expect(sharedAi).toContain('const DEFAULT_MODEL = "deepseek-chat"');
    expect(agent).toContain("chinese_understanding");
    expect(agent).toContain("speaking_examples");
    expect(agent).not.toContain("DEEPSEEK_API_KEY =");
  });

  it("exposes both library and book reader routes", () => {
    expect(routes).toContain('path="/english/reader"');
    expect(routes).toContain('path="/english/reader/:bookId"');
  });
});
