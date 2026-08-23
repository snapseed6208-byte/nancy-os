import JSZip from "jszip";
import type { ParsedEpub, ParsedEpubChapter } from "./types";

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

function chapterText(html: string): { title: string | null; content: string } {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script,style,nav,svg").forEach((node) => node.remove());
  const title = document.querySelector("h1,h2,h3")?.textContent?.trim()
    || document.querySelector("title")?.textContent?.trim()
    || null;
  const blocks = Array.from(document.querySelectorAll("h1,h2,h3,h4,p,blockquote,li"))
    .map((node) => node.textContent?.replace(/\s+/g, " ").trim() || "")
    .filter(Boolean);
  const content = (blocks.length ? blocks.join("\n\n") : document.body.textContent || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title, content };
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
  const spineItems = Array.from(opf.querySelectorAll("spine > itemref"));
  for (const [index, itemref] of spineItems.entries()) {
    const idref = itemref.getAttribute("idref");
    const item = idref ? manifest.get(idref) : null;
    if (!item || (!item.mediaType.includes("html") && !/\.x?html?$/i.test(item.href))) continue;
    const path = normalizePath(opfDir, item.href);
    const entry = zip.file(path);
    if (!entry) continue;
    const parsed = chapterText(await entry.async("text"));
    if (parsed.content.length < 20) continue;
    chapters.push({
      title: parsed.title || `Chapter ${index + 1}`,
      href: item.href,
      content: parsed.content,
      wordCount: parsed.content.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length || 0,
    });
  }

  if (!chapters.length) throw new Error("EPUB 中没有可阅读的章节");
  return { title, author, language, identifier, chapters };
}
