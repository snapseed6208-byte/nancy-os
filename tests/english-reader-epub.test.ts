import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseEpubFile } from "../src/lib/reader/epubParser";
import { decodeReaderContent, encodeReaderContent } from "../src/lib/reader/content";

async function createEpub(chapterHtml?: string): Promise<File> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file("META-INF/container.xml", `<?xml version="1.0"?>
    <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
      <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
    </container>`);
  zip.file("OEBPS/content.opf", `<?xml version="1.0"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier>reader-fixture</dc:identifier>
        <dc:title>Pride and Practice</dc:title>
        <dc:creator>Nancy Author</dc:creator>
        <dc:language>en</dc:language>
      </metadata>
      <manifest>
        <item id="chapter-one" href="text/chapter-1.xhtml" media-type="application/xhtml+xml"/>
        <item id="chapter-two" href="text/chapter-2.xhtml" media-type="application/xhtml+xml"/>
      </manifest>
      <spine>
        <itemref idref="chapter-one"/>
        <itemref idref="chapter-two"/>
      </spine>
    </package>`);
  zip.file("OEBPS/images/test image.png", "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", { base64: true });
  zip.file("OEBPS/text/chapter-1.xhtml", chapterHtml ?? `
    <html><head><title>Opening</title><script>bad()</script></head><body>
      <h1>Chapter One</h1><p>It is a truth universally acknowledged.</p>
      <p>She wouldn't give up her morning walk.</p>
    </body></html>`);
  zip.file("OEBPS/text/chapter-2.xhtml", `
    <html><body><h2>A New Habit</h2><p>Practice makes difficult sentences feel familiar.</p></body></html>`);
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new File([bytes], "fixture.epub", { type: "application/epub+zip" });
}

describe("English Reader EPUB parser", () => {
  it("reads namespaced metadata and spine chapters in order", async () => {
    const parsed = await parseEpubFile(await createEpub());

    expect(parsed).toMatchObject({
      title: "Pride and Practice",
      author: "Nancy Author",
      language: "en",
      identifier: "reader-fixture",
    });
    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual(["Chapter One", "A New Habit"]);
    expect(parsed.chapters[0].content).toContain("universally acknowledged");
    expect(parsed.chapters[0].content).not.toContain("bad()");
    expect(parsed.chapters[0].wordCount).toBeGreaterThan(10);
  });

  it("rejects files that are not EPUBs", async () => {
    await expect(parseEpubFile(new File(["text"], "notes.txt"))).rejects.toThrow("EPUB");
  });

  it("preserves nested text and packaged images in order across storage round trips", async () => {
    const parsed = await parseEpubFile(await createEpub(`<body><blockquote><p>Before the picture.</p></blockquote>
      <figure><img src="../images/test%20image.png?size=1#cover" alt="A diagram"/><figcaption>Figure one.</figcaption></figure>
      <p>After the <em>picture</em>.</p></body>`));
    const chapter = parsed.chapters[0];
    expect(chapter.blocks?.map((block) => block.type)).toEqual(["text", "image", "text", "text"]);
    expect(chapter.content).toBe("Before the picture.\n\nFigure one.\n\nAfter the picture.");
    expect(chapter.wordCount).toBe(8);
    expect(chapter.blocks?.[1]).toMatchObject({ alt: "A diagram", src: expect.stringMatching(/^data:image\/png;base64,/) });
    expect(decodeReaderContent(encodeReaderContent(chapter.content, chapter.blocks))).toEqual(chapter.blocks);
  });

  it("keeps image-only chapters including SVG cover wrappers", async () => {
    const parsed = await parseEpubFile(await createEpub(`<body><svg><image xlink:href="../images/test%20image.png"/></svg></body>`));
    expect(parsed.chapters).toHaveLength(2);
    expect(parsed.chapters[0].blocks?.[0].type).toBe("image");
    expect(parsed.chapters[0].wordCount).toBe(0);
  });

  it("keeps text readable when images are missing or remote", async () => {
    const parsed = await parseEpubFile(await createEpub(`<body><p>Still readable.</p>
      <img src="../missing.png" alt="Missing diagram"/><img src="https://example.com/tracker.png"/>
      <script>bad()</script></body>`));
    expect(parsed.chapters[0].content).toContain("Still readable.");
    expect(parsed.chapters[0].content).toContain("图片不可用：Missing diagram");
    expect(parsed.chapters[0].blocks?.every((block) => block.type === "text")).toBe(true);
    expect(parsed.chapters[0].content).not.toContain("bad()");
  });

  it("reads legacy text and refuses unsafe image sources in stored blocks", () => {
    expect(decodeReaderContent("First.\n\nSecond.")).toEqual([{ type: "text", text: "First." }, { type: "text", text: "Second." }]);
    const unsafe = '{"format":"english-reader-blocks-v1","blocks":[{"type":"image","src":"javascript:alert(1)","alt":""}]}';
    expect(decodeReaderContent(unsafe)[0].type).toBe("text");
  });
});
