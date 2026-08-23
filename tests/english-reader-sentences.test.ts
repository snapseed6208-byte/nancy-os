import { describe, expect, it } from "vitest";
import { readerProgressPercentage, splitReaderSentences } from "../src/lib/reader/sentences";

describe("English Reader sentence and progress helpers", () => {
  it("keeps sentence punctuation and handles quoted endings", () => {
    expect(splitReaderSentences(`She said, "Try again." It worked! Why stop now?`)).toEqual([
      `She said, "Try again."`,
      "It worked!",
      "Why stop now?",
    ]);
  });

  it("normalizes whitespace and ignores empty content", () => {
    expect(splitReaderSentences("  Read   this carefully.  ")).toEqual(["Read this carefully."]);
    expect(splitReaderSentences("   ")).toEqual([]);
  });

  it("clamps chapter progress to a valid percentage", () => {
    expect(readerProgressPercentage(0, 4)).toBe(25);
    expect(readerProgressPercentage(3, 4)).toBe(100);
    expect(readerProgressPercentage(9, 4)).toBe(100);
    expect(readerProgressPercentage(0, 0)).toBe(0);
  });
});
