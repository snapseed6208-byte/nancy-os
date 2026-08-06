// ============================================
// Nancy OS — Chinese Speech Service Factory
// Provider fallback: aliyun-chinese-realtime → browser-zh
// ============================================

import type { SpeechProvider } from "./types";
import { AliyunRealtimeSpeechProvider } from "./providers/aliyunRealtimeSpeech";
import { BrowserChineseSpeechProvider } from "./providers/browserChineseSpeech";

export function createChineseSpeechProvider(): SpeechProvider {
  // Priority 1: Aliyun Chinese realtime (WebSocket)
  const aliyunProvider = new AliyunRealtimeSpeechProvider({
    tokenLanguage: "chinese",
    providerId: "aliyun-chinese-realtime",
  });
  if (aliyunProvider.supported) {
    return aliyunProvider;
  }

  // Priority 2: Browser Web Speech API with zh-CN
  const browserProvider = new BrowserChineseSpeechProvider();
  if (browserProvider.supported) {
    return browserProvider;
  }

  return browserProvider;
}
