export const MIN_VALID_EXTRACTED_CHARS = 40;

export type ExtractionCandidate = {
  text: string;
  error?: string;
};

export function getExtractionFailure(candidate: ExtractionCandidate): string | undefined {
  if (candidate.error) return candidate.error;

  const textLength = candidate.text.trim().length;
  if (textLength < MIN_VALID_EXTRACTED_CHARS) {
    return `提取正文过短 (${textLength} chars)`;
  }

  return undefined;
}
