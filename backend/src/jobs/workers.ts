import { drainOutbox, rebuildLeaderboards } from "../services/leaderboard.js";
import { expireGraceWindows } from "../services/membership.js";
import { ensureDailyChallenge, sweepStaleRooms } from "../services/rooms.js";
import { logger } from "../logger.js";

export function startWorkers(options: { redisAvailable?: boolean } = {}): () => void {
  const redisAvailable = options.redisAvailable ?? true;
  const timers: NodeJS.Timeout[] = [];
  if (redisAvailable) {
    timers.push(setInterval(() => {
      void drainOutbox().catch((error) => logger.warn({ err: error }, "outbox worker failed"));
    }, 4000));
    timers.push(setInterval(() => {
      void rebuildLeaderboards().catch((error) => logger.warn({ err: error }, "rebuild worker failed"));
    }, 15 * 60 * 1000));
    timers.push(setInterval(() => {
      void sweepStaleRooms().catch((error) => logger.warn({ err: error }, "room sweeper failed"));
    }, 30 * 1000));
    void rebuildLeaderboards().catch(() => undefined);
  }
  const dunning = setInterval(() => {
    void expireGraceWindows().catch((error) => logger.warn({ err: error }, "dunning expire failed"));
  }, 60 * 1000);
  const daily = setInterval(() => {
    void ensureDailyChallenge().catch((error) => logger.warn({ err: error }, "daily challenge seed failed"));
  }, 60 * 1000);
  timers.push(dunning, daily);
  void ensureDailyChallenge().catch(() => undefined);
  return () => {
    for (const timer of timers) clearInterval(timer);
  };
}
