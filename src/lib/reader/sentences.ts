export function splitReaderSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const matches = normalized.match(/[^.!?]+(?:[.!?]+["'’”)]*|$)/g);
  return (matches || [normalized]).map((item) => item.trim()).filter(Boolean);
}

export function readerProgressPercentage(chapterIndex: number, chapterCount: number): number {
  if (chapterCount <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((chapterIndex + 1) / chapterCount) * 100)));
}
