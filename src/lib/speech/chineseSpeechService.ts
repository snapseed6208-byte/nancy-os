// ============================================
// Nancy OS — Chinese Speech Service Factory
// Provider fallback: aliyun-realtime-zh → browser-zh → aliyun-zh
// ============================================

import type { SpeechProvider } from "./types";
import { BrowserChineseSpeechProvider } from "./providers/browserChineseSpeech";

export function createChineseSpeechProvider(): SpeechProvider {
  // Priority:
  // 1. Aliyun realtime (requires Chinese appkey env var) — try aliyun-realtime
  // 2. Browser Web Speech API with zh-CN
  // 3. For now, aliyun-realtime is the default provider imported from speechService
  //    but tokenized with Chinese appkey via aliyun-token?language=chinese

  // Dynamic import of Aliyun providers to avoid bundling issues
  // For now: prefer browser-zh (always available in Chrome/Edge for Chinese)
  const provider = new BrowserChineseSpeechProvider();
  if (provider.supported) {
    return provider;
  }

  // Fallback: return browser-zh anyway (unsupported browsers will show error)
  return provider;
}
