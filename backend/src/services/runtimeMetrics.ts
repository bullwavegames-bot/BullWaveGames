const MAX_SAMPLES = 2_000;
const durations: number[] = [];
let requestCount = 0;
let errorCount = 0;
let activeRoomSockets = 0;

function percentile(samples: number[], ratio: number): number {
  if (!samples.length) return 0;
  const index = Math.min(samples.length - 1, Math.ceil(samples.length * ratio) - 1);
  return samples[index];
}

export function recordHttpRequest(durationMs: number, statusCode: number): void {
  requestCount += 1;
  if (statusCode >= 500) errorCount += 1;
  durations.push(Math.max(0, durationMs));
  if (durations.length > MAX_SAMPLES) durations.splice(0, durations.length - MAX_SAMPLES);
}

export function roomSocketOpened(): void {
  activeRoomSockets += 1;
}

export function roomSocketClosed(): void {
  activeRoomSockets = Math.max(0, activeRoomSockets - 1);
}

export function runtimeMetrics() {
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    http: {
      requests: requestCount,
      errors: errorCount,
      errorRate: requestCount ? errorCount / requestCount : 0,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      p99Ms: percentile(sorted, 0.99),
    },
    rooms: { activeSockets: activeRoomSockets },
  };
}

export function resetRuntimeMetricsForTest(): void {
  durations.length = 0;
  requestCount = 0;
  errorCount = 0;
  activeRoomSockets = 0;
}
