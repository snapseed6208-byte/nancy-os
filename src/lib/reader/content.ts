export type ReaderBlock =
  | { type: "text"; text: string }
  | { type: "image"; src: string; alt: string };

const FORMAT = "english-reader-blocks-v1";

export function isReaderImageSource(src: string): boolean {
  return /^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(src);
}

// Keep the existing text column and legacy books compatible, without a schema migration.
export function encodeReaderContent(text: string, blocks?: ReaderBlock[]): string {
  return blocks?.some((block) => block.type === "image")
    ? JSON.stringify({ format: FORMAT, blocks })
    : text;
}

export function decodeReaderContent(content: string): ReaderBlock[] {
  if (content.startsWith('{"format":')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.format === FORMAT && Array.isArray(parsed.blocks) && parsed.blocks.every(
        (block: ReaderBlock) => block && (
          (block.type === "text" && typeof block.text === "string") ||
          (block.type === "image" && typeof block.src === "string" &&
            typeof block.alt === "string" && isReaderImageSource(block.src))
        ),
      )) return parsed.blocks;
    } catch { /* Legacy plain text remains readable. */ }
  }
  return content.split(/\n{2,}/).filter((text) => text.trim()).map((text) => ({ type: "text", text }));
}
