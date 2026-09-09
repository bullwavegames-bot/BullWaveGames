import { drainOutbox, rebuildLeaderboards } from "../services/leaderboard.js";
import { expireGraceWindows } from "../services/membership.js";
import { ensureDailyChallenge, sweepStaleRooms } from "../services/rooms.js";
import { logger } from "../logger.js";

export function startWorkers(): () => void {
  const outbox = setInterval(() => {
    void drainOutbox().catch((error) => logger.warn({ err: error }, "outbox worker failed"));
  }, 4000);
  const rebuild = setInterval(() => {
    void rebuildLeaderboards().catch((error) => logger.warn({ err: error }, "rebuild worker failed"));
  }, 15 * 60 * 1000);
  const rooms = setInterval(() => {
    void sweepStaleRooms().catch((error) => logger.warn({ err: error }, "room sweeper failed"));
  }, 30 * 1000);
  const dunning = setInterval(() => {
    void expireGraceWindows().catch((error) => logger.warn({ err: error }, "dunning expire failed"));
  }, 60 * 1000);
  const daily = setInterval(() => {
    void ensureDailyChallenge().catch((error) => logger.warn({ err: error }, "daily challenge seed failed"));
  }, 60 * 1000);
  void rebuildLeaderboards().catch(() => undefined);
  void ensureDailyChallenge().catch(() => undefined);
  return () => {
    clearInterval(outbox);
    clearInterval(rebuild);
    clearInterval(rooms);
    clearInterval(dunning);
    clearInterval(daily);
  };
}
