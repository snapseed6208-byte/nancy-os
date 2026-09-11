export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

// Strip credentials a provider or DB driver may embed in an error string before it reaches the client.
const SECRET_PATTERNS: RegExp[] = [
  /\bBearer\s+[\w.\-]+/gi,
  /\bey[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{4,}\b/g,
  /\bsk-[A-Za-z0-9_\-]{8,}\b/g,
  /\b(?:api[-_]?key|access[-_]?token|authorization|apikey)\b\s*[:=]\s*"?[^\s",}]+/gi,
];

export function redact(message: string): string {
  let out = message;
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, "[redacted]");
  out = out.replace(/\s+/g, " ").trim();
  return out.length > 400 ? `${out.slice(0, 400)}…` : out;
}

export function statusOf(error: unknown): number {
  if (error instanceof HttpError) return error.status;
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" && status >= 400 && status < 600 ? status : 500;
}

export function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return redact(error.message);
  const fallback = (error as { message?: unknown })?.message;
  return typeof fallback === "string" && fallback ? redact(fallback) : "词汇处理失败";
}
