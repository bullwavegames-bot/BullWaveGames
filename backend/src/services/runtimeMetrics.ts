import { monitorEventLoopDelay } from 'node:perf_hooks';

const eventLoop = monitorEventLoopDelay({ resolution: 20 });
let monitorUsers = 0;
export function startRuntimeMonitoring(): () => void {
  if (monitorUsers++ === 0) eventLoop.enable();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    if (--monitorUsers === 0) eventLoop.disable();
  };
}

const MAX_SAMPLES = 2_000;
const actionDurations: number[] = [];
export function recordRoomAction(durationMs: number): void {
  actionDurations.push(Math.max(0, durationMs));
  if (actionDurations.length > MAX_SAMPLES) actionDurations.shift();
}
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
  const actions = [...actionDurations].sort((a, b) => a - b);
  return {
    http: {
      requests: requestCount,
      errors: errorCount,
      errorRate: requestCount ? errorCount / requestCount : 0,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      p99Ms: percentile(sorted, 0.99),
    },
    rooms: { activeSockets: activeRoomSockets,
      actionP50Ms: percentile(actions, 0.5), actionP95Ms: percentile(actions, 0.95), actionP99Ms: percentile(actions, 0.99) },
    eventLoop: {
      p95Ms: eventLoop.count ? eventLoop.percentile(95) / 1_000_000 : 0,
      maxMs: eventLoop.count ? eventLoop.max / 1_000_000 : 0,
    },
  };
}

export function resetRuntimeMetricsForTest(): void {
  durations.length = 0;
  requestCount = 0;
  errorCount = 0;
  activeRoomSockets = 0;
  actionDurations.length = 0;
  eventLoop.reset();
}
