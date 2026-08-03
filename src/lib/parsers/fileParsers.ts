// ============================================
// Nancy OS — File Parsers for Speaking Import
// Client-side extraction: DOCX, PDF, CSV, MD, TXT
// Heavy libs (mammoth, pdfjs-dist) are dynamically imported
// to keep them out of the main bundle.
// ============================================

import Papa from "papaparse";

export interface ParseResult {
  text: string;
  fileName: string;
  fileType: string;
  charCount: number;
  warning?: string;
}

export type ParseStep = "idle" | "parsing" | "done" | "error";

// ── DOCX ──

async function parseDocx(file: File): Promise<ParseResult> {
  const mammoth = await import("mammoth");
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const text = result.value.trim();
  const warning = result.messages.length > 0
    ? result.messages.map((m: { message: string }) => m.message).join("; ")
    : undefined;
  return {
    text,
    fileName: file.name,
    fileType: "docx",
    charCount: text.length,
    warning,
  };
}

// ── PDF ──

async function parsePdf(file: File): Promise<ParseResult> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  const text = pages.join("\n\n").trim();

  let warning: string | undefined;
  if (!text || text.length < 10) {
    warning = "该 PDF 可能为扫描版或图片格式，无法提取文字。当前不支持 OCR 文字识别，请使用包含可选文字层的 PDF 文件。";
  }

  return {
    text,
    fileName: file.name,
    fileType: "pdf",
    charCount: text.length,
    warning,
  };
}

// ── CSV ──

async function parseCsv(file: File): Promise<ParseResult> {
  const raw = await file.text();
  const result = Papa.parse(raw, { header: true, skipEmptyLines: true });

  const fields: string[] = result.meta.fields || [];
  const questionCol = fields.find(
    (f: string) => f.toLowerCase() === "question" || f.toLowerCase() === "questions" || f.toLowerCase() === "topic"
  );

  let text: string;
  if (questionCol) {
    const questions = (result.data as Array<Record<string, string>>)
      .map((row) => row[questionCol])
      .filter(Boolean);
    text = questions.join("\n");
  } else {
    text = (result.data as Array<Record<string, string>>)
      .map((row) => Object.values(row).join(" "))
      .filter(Boolean)
      .join("\n");
  }

  return {
    text,
    fileName: file.name,
    fileType: "csv",
    charCount: text.length,
  };
}

// ── Markdown / TXT ──

async function parseText(file: File): Promise<ParseResult> {
  const text = (await file.text()).trim();
  return {
    text,
    fileName: file.name,
    fileType: file.name.endsWith(".md") || file.name.endsWith(".markdown") ? "markdown" : "txt",
    charCount: text.length,
  };
}

// ── Unified parser ──

const MAX_FILE_SIZE = 500 * 1024; // 500KB

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `文件过大 (${(file.size / 1024).toFixed(1)}KB)，上限 ${MAX_FILE_SIZE / 1024}KB`;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  const allowed = ["docx", "pdf", "csv", "md", "markdown", "txt"];
  if (!ext || !allowed.includes(ext)) {
    return `不支持的文件格式 .${ext}，支持: ${allowed.join(", ")}`;
  }
  return null;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "docx":
      return parseDocx(file);
    case "pdf":
      return parsePdf(file);
    case "csv":
      return parseCsv(file);
    case "md":
    case "markdown":
    case "txt":
      return parseText(file);
    default:
      throw new Error(`不支持的文件格式: .${ext}`);
  }
}
