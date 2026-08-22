import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type FetchedContent = {
  title: string;
  description: string;
  text: string;
} | null;

function shouldRejectWorkoutSource(input: {
  fetchedContent: FetchedContent;
  preFetchedTitle?: string;
  databaseTitle?: string;
  databaseMetadata?: Record<string, unknown> | null;
  sourceContext?: string;
  sourceContent?: Record<string, unknown> | null;
}): boolean {
  const hasUsableFetchedContent = Boolean(
    input.fetchedContent && (
      input.fetchedContent.text ||
      input.fetchedContent.title ||
      input.fetchedContent.description
    ),
  );

  const hasDatabaseMetadata = Boolean(input.databaseTitle
    || input.databaseMetadata?.title
    || input.databaseMetadata?.description);
  const hasSourceContent = Boolean(input.sourceContent && [
    "title",
    "description",
    "subtitle",
    "transcript",
    "text",
    "source_material",
    "vision_result",
  ].some((field) => input.sourceContent?.[field]));

  return !hasUsableFetchedContent && !input.preFetchedTitle
    && !hasDatabaseMetadata && !input.sourceContext && !hasSourceContent;
}

describe("content-parser-agent source guard", () => {
  it("keeps fetchedContent in scope for workout quality evaluation", () => {
    const source = readFileSync(
      resolve(process.cwd(), "supabase/functions/content-parser-agent/index.ts"),
      "utf8",
    );
    const declaration = source.indexOf("let fetchedContent: UrlContentResult | null = null;");
    const legacyBranch = source.indexOf("// LEGACY PATH");
    const qualityEvaluation = source.indexOf("const analysisSource = videoEvidence?.sourceLevel");

    expect(declaration).toBeGreaterThan(-1);
    expect(declaration).toBeLessThan(legacyBranch);
    expect(declaration).toBeLessThan(qualityEvaluation);
    expect(source).toContain('stage: "content_fetch"');
    expect(source).toContain('error: "缺少可用于判断训练内容的信息"');
    expect(source).toContain('videoAnalysisSource = "database_metadata"');
    expect(source).toContain('videoAnalysisSource = "url_only"');
    expect(source).toContain("const inputIsUrl = isUrl(input);");
    expect(source).toContain("if (isWorkoutPath && bvid)");
    expect(source).toContain('.select("url, title, author, thumbnail_url, platform, video_id, analysis_source, metadata")');
    expect(source).toContain("extractWorkoutFactsFromTitle(videoEvidence.title");
    expect(source).toContain("detectWorkoutFactConflicts(rawAiWorkoutMetadata, lockedWorkoutFacts)");
    expect(source).toContain("metadata = groundWorkoutMetadata(metadata, lockedWorkoutFacts, allowsContentInference)");
  });

  it("continues when URL fetching returns usable content", () => {
    expect(shouldRejectWorkoutSource({
      fetchedContent: { title: "训练视频", description: "", text: "有效页面内容" },
    })).toBe(false);
  });

  it("continues with Bilibili pre-fetched metadata title", () => {
    expect(shouldRejectWorkoutSource({
      fetchedContent: { title: "", description: "", text: "" },
      preFetchedTitle: "B站训练标题",
    })).toBe(false);
  });

  it("continues with a Douyin page metadata title", () => {
    expect(shouldRejectWorkoutSource({
      fetchedContent: { title: "5分钟睡前拉伸", description: "", text: "" },
    })).toBe(false);
  });

  it("continues when platform fetching fails but a database title exists", () => {
    expect(shouldRejectWorkoutSource({
      fetchedContent: { title: "", description: "", text: "" },
      databaseTitle: "弹力带热身臀腿",
    })).toBe(false);
  });

  it("continues with a title supplied by source_content", () => {
    expect(shouldRejectWorkoutSource({
      fetchedContent: null,
      sourceContent: { title: "弹力带热身臀腿" },
    })).toBe(false);
  });

  it("rejects URL-only input even when the URL itself is valid", () => {
    expect(shouldRejectWorkoutSource({
      fetchedContent: { title: "", description: "", text: "" },
    })).toBe(true);
  });

  it("rejects stored platform identifiers without content evidence", () => {
    expect(shouldRejectWorkoutSource({
      fetchedContent: null,
      databaseMetadata: { source: "database", cover: "https://example.com/cover.jpg" },
    })).toBe(true);
  });

  it("returns a content_fetch failure only when every source and URL are empty", () => {
    expect(shouldRejectWorkoutSource({
      fetchedContent: { title: "", description: "", text: "" },
    })).toBe(true);
  });

  it("builds retry payload from the stored workout record", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/hooks/useHealth.ts"),
      "utf8",
    );

    expect(source).toContain('.select("id, url, title, thumbnail_url, platform, video_id, metadata")');
    expect(source).toContain("pre_fetched_title: storedVideo.title || undefined");
    expect(source).toContain("pre_fetched_cover_url: storedVideo.thumbnail_url || undefined");
    expect(source).toContain("platform: storedVideo.platform || undefined");
  });
});
