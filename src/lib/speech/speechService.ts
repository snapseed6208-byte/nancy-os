// ============================================
// Nancy OS — Speech Service Factory
// Selects the active ASR provider based on env config.
// ============================================

import type { SpeechProvider, SpeechProviderType } from "./types";
import { BrowserSpeechProvider } from "./providers/browserSpeech";
import { AliyunSpeechProvider } from "./providers/aliyunSpeech";
import { OpenAIWhisperProvider } from "./providers/openaiWhisper";

const PROVIDER_TYPE: SpeechProviderType =
  (import.meta.env.VITE_SPEECH_PROVIDER as SpeechProviderType) || "browser";

export function createSpeechProvider(): SpeechProvider {
  switch (PROVIDER_TYPE) {
    case "aliyun":
      return new AliyunSpeechProvider();
    case "openai-whisper":
      return new OpenAIWhisperProvider();
    case "browser":
    default:
      return new BrowserSpeechProvider();
  }
}
