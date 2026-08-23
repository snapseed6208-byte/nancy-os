import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import ReadingExperience, { ReadingAIPanel } from "@/components/english/reading/ReadingExperience";
import { parseEpubFile } from "@/lib/reader/epubParser";
import { readerProgressPercentage } from "@/lib/reader/sentences";
import type { ReaderSentenceAnalysis } from "@/lib/reader/types";
import {
  getExtractionFailure,
  MIN_VALID_EXTRACTED_CHARS,
} from "../../supabase/functions/resource-extract/extraction-result";

const analyzeSentence = vi.fn();

vi.mock("@/lib/hooks/useEnglishReader", () => ({
  useAnalyzeReaderSentence: () => ({ mutateAsync: analyzeSentence }),
}));

const analysis: ReaderSentenceAnalysis = {
  chinese_understanding: "我无法让自己告诉他。",
  language_explanation: "bring oneself to 表示设法鼓起勇气做某事。",
  key_expressions: [{
    expression: "bring myself to",
    source_expression: "bring myself to",
    chinese: "让自己下定决心",
    explanation: "常用于否定句。",
    contextual_meaning: "鼓起勇气去做",
    usage_note: "常见结构是 cannot bring oneself to do。",
    register: "neutral",
    speaking_example: "I couldn't bring myself to say no.",
  }],
  speaking_examples: ["I couldn't bring myself to say no."],
};

afterEach(cleanup);
beforeEach(() => analyzeSentence.mockReset());

describe("English Reading shared sentence engine", () => {
  it("sends exactly one request while the same sentence is in flight", async () => {
    let resolveAnalysis!: (value: ReaderSentenceAnalysis) => void;
    analyzeSentence.mockReturnValue(new Promise<ReaderSentenceAnalysis>((resolve) => { resolveAnalysis = resolve; }));
    render(<ReadingExperience content="I couldn't bring myself to tell him." fontSize={19} sourceKey="book:1:chapter:1" sourceKind="epub" sourceTitle="A Man Called Ove" onSaveExpression={vi.fn()} />);

    const sentence = screen.getByRole("button", { name: /bring myself/ });
    fireEvent.click(sentence);
    fireEvent.click(sentence);
    expect(analyzeSentence).toHaveBeenCalledTimes(1);

    resolveAnalysis(analysis);
    expect(await screen.findByText("我无法让自己告诉他。")).toBeInTheDocument();
  });

  it("keeps reading content visible and allows retry after AI failure", async () => {
    analyzeSentence.mockRejectedValueOnce(new Error("DeepSeek timeout")).mockResolvedValueOnce(analysis);
    render(<ReadingExperience content="I couldn't bring myself to tell him." fontSize={19} sourceKey="article:1" sourceKind="article" sourceTitle="Test article" onSaveExpression={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /bring myself/ }));
    expect(await screen.findByText("AI 解析失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bring myself/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新分析" }));
    expect(await screen.findByText("我无法让自己告诉他。")).toBeInTheDocument();
    expect(analyzeSentence).toHaveBeenCalledTimes(2);
  });

  it("saves the exact source expression and reports an existing expression", async () => {
    analyzeSentence.mockResolvedValue(analysis);
    const save = vi.fn().mockResolvedValue({ expression_id: "expression-1", created: false, linked: true });
    render(<ReadingExperience content="I couldn't bring myself to tell him." fontSize={19} sourceKey="book:1:chapter:1" sourceKind="epub" sourceTitle="A Man Called Ove" onSaveExpression={save} />);

    fireEvent.click(screen.getByRole("button", { name: /bring myself/ }));
    await screen.findByText("bring myself to");
    fireEvent.click(screen.getByTitle("加入表达库"));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ source_expression: "bring myself to" }), analysis, "I couldn't bring myself to tell him."));
    expect(await screen.findByText("已在表达库中，来源已关联")).toBeInTheDocument();
  });

  it("keeps long article text and AI panel content inside the shared width contract", () => {
    const longToken = `https://example.com/${"unbreakable".repeat(20)}`;
    const overflowAnalysis: ReaderSentenceAnalysis = {
      ...analysis,
      chinese_understanding: `中文理解 ${longToken}`,
      key_expressions: [{
        ...analysis.key_expressions[0],
        expression: longToken,
        source_expression: longToken,
        contextual_meaning: `语境解释 ${longToken}`,
      }],
    };
    render(
      <ReadingAIPanel
        sentence={`You are standing inside your own body, yet you cannot feel your center. ${longToken}`}
        analysis={overflowAnalysis}
        loading={false}
        error=""
        saveStates={{}}
        onClose={vi.fn()}
        onRetry={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const panel = screen.getByRole("complementary");
    expect(panel).toHaveClass("max-w-full", "min-w-0", "box-border");
    expect(screen.getByText(/You are standing inside/)).toHaveClass("whitespace-normal", "[overflow-wrap:anywhere]");
    expect(screen.getByTitle("加入表达库")).toHaveClass("shrink-0");
  });
});

describe("English Reader compatibility contracts", () => {
  it("keeps EPUB parsing and chapter-based progress behavior", async () => {
    const zip = new JSZip();
    zip.file("META-INF/container.xml", `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" /></rootfiles></container>`);
    zip.file("OEBPS/content.opf", `<?xml version="1.0"?><package><metadata><title>Test Book</title><creator>Nancy</creator><language>en</language></metadata><manifest><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>`);
    zip.file("OEBPS/chapter1.xhtml", `<html><body><h1>Chapter One</h1><p>This is a complete English sentence for the reader.</p></body></html>`);
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const epubBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const parsed = await parseEpubFile(new File([epubBuffer], "test.epub", { type: "application/epub+zip" }));

    expect(parsed.title).toBe("Test Book");
    expect(parsed.author).toBe("Nancy");
    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0].content).toContain("complete English sentence");
    expect(readerProgressPercentage(0, 4)).toBe(25);
  });

  it("registers canonical routes while preserving old reader URLs", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    for (const route of [
      "/english/reading",
      "/english/reading/library",
      "/english/reading/book/:bookId",
      "/english/reading/articles",
      "/english/reading/article/:resourceId",
      "/english/reading/history",
      "/english/reader",
      "/english/reader/:bookId",
    ]) expect(app).toContain(`path="${route}"`);
  });

  it("shares a viewport-safe width contract between Article and EPUB readers", () => {
    const article = readFileSync("src/pages/EnglishArticleReader.tsx", "utf8");
    const epub = readFileSync("src/pages/EnglishReader.tsx", "utf8");
    const experience = readFileSync("src/components/english/reading/ReadingExperience.tsx", "utf8");

    expect(article).toContain('className="w-full max-w-full min-w-0 -mt-2 pb-20"');
    expect(epub).toContain('className="w-full max-w-full min-w-0 -mt-2 pb-20"');
    expect(article).toContain("w-full max-w-xl min-w-0");
    expect(epub).toContain("w-full max-w-xl min-w-0");
    expect(experience).toContain("fixed inset-x-0 bottom-0 z-50 w-auto max-w-full min-w-0 box-border");
    expect(experience).toContain("[overflow-wrap:anywhere]");
    expect(`${article}\n${epub}\n${experience}`).not.toContain("w-screen");
  });

  it("uses an idempotent, ownership-checked direct-save RPC", () => {
    const migration = readFileSync("supabase/migrations/102_reading_expression_provenance.sql", "utf8");
    const agent = readFileSync("supabase/functions/english-reader-agent/index.ts", "utf8");
    expect(migration).toContain("save_reading_expression_v2");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("book_id = p_book_id AND user_id = v_user_id");
    expect(migration).toContain("saved_reading_expressions_source_invariant_check");
    expect(migration.match(/ON DELETE CASCADE/g)).toHaveLength(2);
    expect(migration).toContain("idx_saved_reading_expressions_epub_sentence_unique");
    expect(migration).toContain("idx_saved_reading_expressions_article_sentence_unique");
    expect(migration).toContain("v_sentence_normalized");
    expect(migration).toContain("'association_id', v_link_id");
    expect(agent).toContain("normalized(sentence).includes(normalized(item.source_expression))");
    expect(agent).toContain(".slice(0, 3)");
  });

  it("enforces exactly one legal EPUB or article source", () => {
    const migration = readFileSync("supabase/migrations/102_reading_expression_provenance.sql", "utf8");
    expect(migration).toContain("source_kind = 'epub'\n      AND book_id IS NOT NULL\n      AND resource_id IS NULL");
    expect(migration).toContain("source_kind = 'article'\n      AND resource_id IS NOT NULL\n      AND book_id IS NULL\n      AND chapter_id IS NULL");
    expect(migration).not.toContain("REFERENCES public.books(id) ON DELETE SET NULL");
    expect(migration).not.toContain("REFERENCES public.resources(id) ON DELETE SET NULL");
  });

  it("uses normalized sentence text in both provenance identities", () => {
    const migration = readFileSync("supabase/migrations/102_reading_expression_provenance.sql", "utf8");
    const normalizedSentence = "LOWER(REGEXP_REPLACE(TRIM(sentence_text), '\\s+', ' ', 'g'))";
    expect(migration.split(normalizedSentence)).toHaveLength(4);
    expect(migration).toContain("chapter_id IS NOT DISTINCT FROM p_chapter_id");
    expect(migration).toContain("resource_id = p_resource_id");
    expect(migration).toContain("'expression_created', v_created");
    expect(migration).toContain("'association_created', v_linked");
  });
});

describe("Resource extraction success contract", () => {
  it("accepts valid non-empty extracted HTML text", () => {
    const text = "A complete article body with enough readable English content for the reading experience.";
    expect(text.length).toBeGreaterThanOrEqual(MIN_VALID_EXTRACTED_CHARS);
    expect(getExtractionFailure({ text })).toBeUndefined();
  });

  it.each([
    ["timeout", "页面请求超时 (10s)"],
    ["parser error", "HTML parser failed"],
    ["network error", "网络错误: connection refused"],
  ])("marks %s as failed", (_caseName, error) => {
    expect(getExtractionFailure({ text: "", error })).toBe(error);
  });

  it("rejects a short body", () => {
    expect(getExtractionFailure({ text: "Too short." })).toContain("正文过短");
  });

  it("rejects empty extracted text", () => {
    expect(getExtractionFailure({ text: "   " })).toContain("(0 chars)");
  });
});
