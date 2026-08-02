// ============================================
// Nancy OS — Speech Service Factory
// Provider fallback: browser → aliyun-realtime → aliyun (file-based)
// ============================================

import type { SpeechProvider, SpeechProviderType } from "./types";
import { BrowserSpeechProvider } from "./providers/browserSpeech";
import { AliyunRealtimeSpeechProvider } from "./providers/aliyunRealtimeSpeech";
import { AliyunSpeechProvider } from "./providers/aliyunSpeech";
import { OpenAIWhisperProvider } from "./providers/openaiWhisper";

const PROVIDER_TYPE: SpeechProviderType =
  (import.meta.env.VITE_SPEECH_PROVIDER as SpeechProviderType) || "browser";

// Fallback order: try preferred first, cascade to next if unsupported
const FALLBACK_ORDER: SpeechProviderType[] = [
  "browser",
  "aliyun-realtime",
  "aliyun",
  "openai-whisper",
];

function createProvider(type: SpeechProviderType): SpeechProvider {
  switch (type) {
    case "aliyun-realtime":
      return new AliyunRealtimeSpeechProvider();
    case "aliyun":
      return new AliyunSpeechProvider();
    case "openai-whisper":
      return new OpenAIWhisperProvider();
    case "browser":
    default:
      return new BrowserSpeechProvider();
  }
}

export function createSpeechProvider(): SpeechProvider {
  // Find the index of the preferred provider in the fallback order
  const startIdx = FALLBACK_ORDER.indexOf(PROVIDER_TYPE);
  const order = startIdx >= 0
    ? [...FALLBACK_ORDER.slice(startIdx), ...FALLBACK_ORDER.slice(0, startIdx)]
    : FALLBACK_ORDER;

  for (const type of order) {
    const provider = createProvider(type);
    if (provider.supported) {
      if (type !== PROVIDER_TYPE) {
        console.warn(
          `[speechService] Preferred provider "${PROVIDER_TYPE}" unavailable, ` +
          `falling back to "${type}"`,
        );
      }
      return provider;
    }
  }

  // Ultimate fallback — should never happen
  return new BrowserSpeechProvider();
}
