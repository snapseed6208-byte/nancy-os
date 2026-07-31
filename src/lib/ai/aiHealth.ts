// ============================================
// Nancy OS — AI Health Check
// Call history tracking + health computation.
// ============================================

// ── Record types ──

export interface AIHealthRecord {
  id: string;
  timestamp: number;
  functionName: string;
  duration: number;
  success: boolean;
  error?: string;
  status?: number;
}

export interface AIFunctionHealth {
  functionName: string;
  status: "healthy" | "degraded" | "down";
  totalCalls: number;
  successCount: number;
  failCount: number;
  successRate: number;
  avgDuration: number;
  recentFailures: number;
  recentTimeouts: number;
  lastCallAt: number | null;
  lastError?: string;
}

export interface AIHealthSummary {
  overallStatus: "healthy" | "degraded" | "down";
  totalCalls: number;
  overallSuccessRate: number;
  functions: AIFunctionHealth[];
  recentRecords: AIHealthRecord[];
  generatedAt: number;
}

// ── Storage ──

const STORAGE_KEY = "nancy-os-ai-health";
const MAX_RECORDS = 200;

function loadRecords(): AIHealthRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AIHealthRecord[];
  } catch {
    return [];
  }
}

function saveRecords(records: AIHealthRecord[]): void {
  try {
    const trimmed = records.slice(-MAX_RECORDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silently drop
  }
}

// ── Record a call ──

export function recordAICall(record: AIHealthRecord): void {
  const records = loadRecords();
  records.push(record);
  saveRecords(records);
}

// ── Clear history ──

export function clearAIHealthHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Health computation ──

const HEALTHY_THRESHOLD = 0.9; // 90% success rate = healthy
const DEGRADED_THRESHOLD = 0.5; // 50% success rate = degraded, below = down
const RECENT_WINDOW = 10; // look at last N calls for recent failures
const MAX_AVG_DURATION = 30_000; // avg > 30s = at least degraded

function computeStatus(
  successRate: number,
  recentFailures: number,
  avgDuration: number,
  totalCalls: number,
): "healthy" | "degraded" | "down" {
  if (totalCalls === 0) return "healthy";
  if (successRate >= HEALTHY_THRESHOLD && recentFailures <= 1 && avgDuration < MAX_AVG_DURATION) {
    return "healthy";
  }
  if (successRate >= DEGRADED_THRESHOLD) return "degraded";
  return "down";
}

export function computeHealth(): AIHealthSummary {
  const records = loadRecords();
  const generatedAt = Date.now();

  // Group by functionName
  const byFunction = new Map<string, AIHealthRecord[]>();
  for (const r of records) {
    const list = byFunction.get(r.functionName) || [];
    list.push(r);
    byFunction.set(r.functionName, list);
  }

  const functions: AIFunctionHealth[] = [];
  let totalSuccess = 0;
  let totalCallsOverall = records.length;

  for (const [functionName, recs] of byFunction) {
    const totalCalls = recs.length;
    const successCount = recs.filter((r) => r.success).length;
    const failCount = totalCalls - successCount;
    const successRate = totalCalls > 0 ? successCount / totalCalls : 1;
    const avgDuration = totalCalls > 0
      ? recs.reduce((sum, r) => sum + r.duration, 0) / totalCalls
      : 0;

    const recent = recs.slice(-RECENT_WINDOW);
    const recentFailures = recent.filter((r) => !r.success).length;
    const recentTimeouts = recent.filter(
      (r) => !r.success && r.error?.includes("超时"),
    ).length;

    const lastCall = recs[recs.length - 1];
    const status = computeStatus(successRate, recentFailures, avgDuration, totalCalls);

    functions.push({
      functionName,
      status,
      totalCalls,
      successCount,
      failCount,
      successRate,
      avgDuration,
      recentFailures,
      recentTimeouts,
      lastCallAt: lastCall?.timestamp ?? null,
      lastError: recent.find((r) => !r.success)?.error,
    });

    totalSuccess += successCount;
  }

  // Sort: degraded/down first, then by function name
  functions.sort((a, b) => {
    const order = { down: 0, degraded: 1, healthy: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.functionName.localeCompare(b.functionName);
  });

  const overallSuccessRate = totalCallsOverall > 0 ? totalSuccess / totalCallsOverall : 1;
  const overallStatus = functions.length === 0
    ? "healthy"
    : functions.every((f) => f.status === "healthy")
      ? "healthy"
      : functions.some((f) => f.status === "down")
        ? "degraded"
        : "degraded";

  return {
    overallStatus,
    totalCalls: totalCallsOverall,
    overallSuccessRate,
    functions,
    recentRecords: records.slice(-20).reverse(),
    generatedAt,
  };
}
