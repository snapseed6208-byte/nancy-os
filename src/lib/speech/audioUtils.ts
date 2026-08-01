// ============================================
// Nancy OS — Audio format conversion
// MediaRecorder → webm/opus → decode → WAV (16kHz mono 16-bit PCM)
// Needed because Aliyun ASR does not accept webm or opus.
// ============================================

/** Convert a webm/opus blob to WAV (16kHz mono 16-bit PCM). */
export async function webmToWav(webmBlob: Blob, targetSampleRate = 16000): Promise<Blob> {
  const audioContext = new AudioContext({ sampleRate: targetSampleRate });
  try {
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Downmix to mono by averaging all channels
    const length = audioBuffer.length;
    const mono = new Float32Array(length);
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const channel = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += channel[i] / audioBuffer.numberOfChannels;
      }
    }

    const wavBuffer = encodeWav(mono, targetSampleRate);
    return new Blob([wavBuffer], { type: "audio/wav" });
  } finally {
    audioContext.close();
  }
}

/** Encode Float32Array PCM as WAV (16-bit, mono). */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, "WAVE");
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return buffer;
}

function writeStr(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
