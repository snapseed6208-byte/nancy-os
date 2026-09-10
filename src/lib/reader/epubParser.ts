import JSZip from "jszip";
import type { ParsedEpub, ParsedEpubChapter } from "./types";
import type { ReaderBlock } from "./content";

const MAX_EPUB_SIZE = 25 * 1024 * 1024;

function parseXml(xml: string, label: string): Document {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error(`${label} 格式无法解析`);
  return document;
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index + 1) : "";
}

function normalizePath(base: string, href: string): string {
  const parts = `${base}${href.split("#")[0]}`.split("/");
  const output: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") output.pop();
    else output.push(part);
  }
  return output.join("/");
}

function textContent(document: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.textContent?.trim();
    if (value) return value;
  }
  return null;
}

async function chapterText(html: string, resolveImage: (src: string) => Promise<string | null>) {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script,style,nav,iframe,object").forEach((node) => node.remove());
  const title = document.querySelector("h1,h2,h3")?.textContent?.trim()
    || document.querySelector("title")?.textContent?.trim()
    || null;
  const blocks: ReaderBlock[] = [];
  let buffer = "";
  const flush = () => {
    const text = buffer.replace(/\s+/g, " ").trim();
    if (text) blocks.push({ type: "text", text });
    buffer = "";
  };
  const walk = async (node: Node): Promise<void> => {
    if (node.nodeType === 3) { buffer += node.textContent || ""; return; }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const tag = element.localName.toLowerCase();
    if (tag === "img" || tag === "image") {
      flush();
      const href = element.getAttribute("src") || element.getAttribute("href") || element.getAttribute("xlink:href");
      const src = href ? await resolveImage(href) : null;
      const alt = element.getAttribute("alt") || element.getAttribute("aria-label") || "";
      if (src) blocks.push({ type: "image", src, alt });
      else blocks.push({ type: "text", text: `[图片不可用${alt ? `：${alt}` : ""}]` });
      return;
    }
    // SVG cover wrappers commonly reference a raster image; don't ingest SVG scripts/text.
    if (tag === "svg") {
      for (const image of Array.from(element.querySelectorAll("image"))) await walk(image);
      return;
    }
    if (tag === "br") { buffer += " "; return; }
    const boundary = /^(h[1-6]|p|div|section|article|blockquote|li|figure|figcaption|tr|hr)$/.test(tag);
    if (boundary) flush();
    for (const child of Array.from(node.childNodes)) await walk(child);
    if (tag === "td" || tag === "th") buffer += " ";
    if (boundary) flush();
  };
  await walk(document.body);
  flush();
  const content = blocks.filter((block) => block.type === "text").map((block) => block.text).join("\n\n");
  return { title, content, blocks };
}

export async function parseEpubFile(file: File): Promise<ParsedEpub> {
  if (!file.name.toLowerCase().endsWith(".epub")) throw new Error("请选择 EPUB 文件");
  if (file.size > MAX_EPUB_SIZE) throw new Error("EPUB 文件不能超过 25MB");

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerEntry = zip.file("META-INF/container.xml");
  if (!containerEntry) throw new Error("EPUB 缺少 container.xml");
  const container = parseXml(await containerEntry.async("text"), "EPUB container");
  const opfPath = container.querySelector("rootfile")?.getAttribute("full-path");
  if (!opfPath) throw new Error("EPUB 缺少 package 路径");

  const opfEntry = zip.file(opfPath);
  if (!opfEntry) throw new Error("EPUB package 文件不存在");
  const opf = parseXml(await opfEntry.async("text"), "EPUB package");
  const opfDir = dirname(opfPath);

  const title = textContent(opf, ["metadata > title", "metadata title"]) || file.name.replace(/\.epub$/i, "");
  const author = textContent(opf, ["metadata > creator", "metadata creator"]);
  const language = textContent(opf, ["metadata > language", "metadata language"]) || "en";
  const identifier = textContent(opf, ["metadata > identifier", "metadata identifier"]);

  const manifest = new Map<string, { href: string; mediaType: string }>();
  opf.querySelectorAll("manifest > item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, { href, mediaType: item.getAttribute("media-type") || "" });
  });

  const chapters: ParsedEpubChapter[] = [];
  const imageCache = new Map<string, string>();
  let embeddedSize = 0;
  const spineItems = Array.from(opf.querySelectorAll("spine > itemref"));
  for (const [index, itemref] of spineItems.entries()) {
    const idref = itemref.getAttribute("idref");
    const item = idref ? manifest.get(idref) : null;
    if (!item || (!item.mediaType.includes("html") && !/\.x?html?$/i.test(item.href))) continue;
    const path = normalizePath(opfDir, item.href);
    const entry = zip.file(path);
    if (!entry) continue;
    const parsed = await chapterText(await entry.async("text"), async (src) => {
      // Only read packaged assets; never fetch remote URLs supplied by a book.
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src)) return null;
      let decoded: string;
      try { decoded = decodeURIComponent(src.split(/[?#]/)[0]); } catch { return null; }
      const imagePath = normalizePath(dirname(path), decoded);
      let data = imageCache.get(imagePath);
      if (!data) {
        const imageEntry = zip.file(imagePath);
        const extension = imagePath.split(".").pop()?.toLowerCase() || "";
        const mime = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", svg: "image/svg+xml" } as Record<string, string>)[extension];
        if (!imageEntry || !mime) return null;
        const bytes = await imageEntry.async("uint8array");
        if (bytes.length > 5 * 1024 * 1024) throw new Error("EPUB 单张图片不能超过 5MB，请压缩图片后重试");
        if (!bytes.length) return null;
        data = `data:${mime};base64,${await imageEntry.async("base64")}`;
        imageCache.set(imagePath, data);
      }
      embeddedSize += data.length;
      if (embeddedSize > 40 * 1024 * 1024) throw new Error("EPUB 图片总量过大，请压缩图片或拆分书籍后重试");
      return data;
    });
    if (!parsed.content && !parsed.blocks.some((block) => block.type === "image")) continue;
    chapters.push({
      title: parsed.title || `Chapter ${index + 1}`,
      href: item.href,
      content: parsed.content,
      blocks: parsed.blocks,
      wordCount: parsed.content.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length || 0,
    });
  }

  if (!chapters.length) throw new Error("EPUB 中没有可阅读的章节");
  return { title, author, language, identifier, chapters };
}
