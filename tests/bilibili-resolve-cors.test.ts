import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("bilibili-resolve CORS and response contract", () => {
  const resolverSource = readFileSync(
    resolve(process.cwd(), "supabase/functions/bilibili-resolve/index.ts"),
    "utf8",
  );
  const corsSource = readFileSync(
    resolve(process.cwd(), "supabase/functions/_shared/nancy-context.ts"),
    "utf8",
  );

  it("returns OPTIONS before entering resolver business logic", () => {
    const optionsIndex = resolverSource.indexOf('req.method === "OPTIONS"');
    const bodyIndex = resolverSource.indexOf("await req.json()");
    expect(optionsIndex).toBeGreaterThan(-1);
    expect(optionsIndex).toBeLessThan(bodyIndex);
    expect(resolverSource).toContain("status: 204");
  });

  it("uses the shared CORS helper that permits Supabase invoke headers", () => {
    expect(resolverSource).toContain('getCorsHeaders(req)');
    expect(corsSource).toContain('"Access-Control-Allow-Origin": allowed');
    expect(corsSource).toContain('"Access-Control-Allow-Methods": "POST, OPTIONS"');
    expect(corsSource).toContain('"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"');
  });

  it("returns the normalized success envelope and request id", () => {
    expect(resolverSource).toContain("success: true");
    expect(resolverSource).toContain("data: responseData");
    expect(resolverSource).toContain("requestId");
    expect(resolverSource).toContain('source: "bilibili_api" | "html_metadata"');
  });

  it("tries the official WBI API before falling back to page HTML", () => {
    const standardApi = resolverSource.indexOf("/x/web-interface/view?");
    const wbiApi = resolverSource.indexOf("/x/web-interface/wbi/view?");
    const htmlFallback = resolverSource.indexOf("fetchHtmlMetadata(htmlUrl");
    expect(standardApi).toBeGreaterThan(-1);
    expect(wbiApi).toBeGreaterThan(standardApi);
    expect(htmlFallback).toBeGreaterThan(wbiApi);
  });
});
