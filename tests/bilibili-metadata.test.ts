import { describe, expect, it } from "vitest";
import {
  emptyBilibiliMetadata,
  extractAidFromUrl,
  extractBvidFromUrl,
  extractPageFromBilibiliUrl,
  hasUsableBilibiliMetadata,
  isBilibiliUrl,
  mergeBilibiliMetadata,
  parseBilibiliApiPayload,
  parseBilibiliHtmlMetadata,
} from "../supabase/functions/_shared/bilibili-metadata";

describe("bilibili metadata pipeline", () => {
  it("extracts a BV id and page from a normal Bilibili URL", () => {
    const url = "https://www.bilibili.com/video/BV1Ab411c7mD?p=2";
    expect(extractBvidFromUrl(url)).toBe("BV1Ab411c7mD");
    expect(extractPageFromBilibiliUrl(url)).toBe(2);
    expect(isBilibiliUrl(url)).toBe(true);
  });

  it("extracts an av id", () => {
    expect(extractAidFromUrl("https://www.bilibili.com/video/av170001")).toBe(170001);
  });

  it("rejects a non-Bilibili host containing Bilibili text", () => {
    expect(isBilibiliUrl("https://example.com/?next=https://www.bilibili.com/video/BV123")).toBe(false);
  });

  it("parses a successful Bilibili API response", () => {
    const metadata = parseBilibiliApiPayload({
      code: 0,
      data: {
        bvid: "BV1Pamela123",
        aid: 42,
        cid: 84,
        title: "帕梅拉 - 5min 每日拉伸",
        pic: "https://i.example/cover.jpg",
        desc: "运动后、睡前、清晨拉伸，无器械",
        duration: 300,
        owner: { name: "Pamela" },
      },
    }, null, null);

    expect(metadata).toMatchObject({
      bvid: "BV1Pamela123",
      title: "帕梅拉 - 5min 每日拉伸",
      cover_url: "https://i.example/cover.jpg",
      description: "运动后、睡前、清晨拉伸，无器械",
      author: "Pamela",
      duration_seconds: 300,
    });
  });

  it("falls back to HTML metadata when the API has no usable payload", () => {
    const api = parseBilibiliApiPayload({ code: -412, message: "request blocked" }, "BV1Fallback", null);
    const html = parseBilibiliHtmlMetadata(`
      <html><head>
        <meta content="帕梅拉 - 5min 每日拉伸 无器械" property="og:title">
        <meta property="og:image" content="https://i.example/fallback.jpg">
        <meta name="description" content="运动后｜睡前｜清晨快速拉伸">
      </head></html>
    `, "BV1Fallback", null);
    const final = mergeBilibiliMetadata(api || emptyBilibiliMetadata("BV1Fallback", null), html);

    expect(final.title).toBe("帕梅拉 - 5min 每日拉伸 无器械");
    expect(final.cover_url).toBe("https://i.example/fallback.jpg");
    expect(hasUsableBilibiliMetadata(final)).toBe(true);
  });

  it("treats title-only HTML metadata as success", () => {
    const metadata = parseBilibiliHtmlMetadata(
      '<meta property="og:title" content="韩小四瘦小腿">',
      "BV1TitleOnly",
      null,
    );
    expect(metadata).toMatchObject({ title: "韩小四瘦小腿", cover_url: null, description: null });
    expect(hasUsableBilibiliMetadata(metadata)).toBe(true);
  });
});
