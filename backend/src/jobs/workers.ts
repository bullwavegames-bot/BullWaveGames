import { drainOutbox, rebuildLeaderboards } from "../services/leaderboard.js";
import { expireGraceWindows } from "../services/membership.js";
import { ensureDailyChallenge, sweepStaleRooms } from "../services/rooms.js";
import { logger } from "../logger.js";
import { processIdentityDeletionJobs } from "../services/identity.js";
import { processWebhookEvents } from "../services/billing.js";
import { processRoomSnapshotJobs } from "../services/roomSnapshots.js";
import { needsOperationalAlert, operationsSnapshot } from "../services/operations.js";

export function startWorkers(options: { redisAvailable?: boolean } = {}): () => void {
  const redisAvailable = options.redisAvailable ?? true;
  const timers: NodeJS.Timeout[] = [];
  let billingWebhookRun: Promise<number> | null = null;
  const runBillingWebhooks = () => {
    if (billingWebhookRun) return;
    billingWebhookRun = processWebhookEvents()
      .catch((error) => {
        logger.warn({ err: error }, "billing webhook worker failed");
        return 0;
      })
      .finally(() => {
        billingWebhookRun = null;
      });
  };
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
  const identityDeletion = setInterval(() => {
    void processIdentityDeletionJobs().catch((error) => logger.warn({ err: error }, "identity deletion worker failed"));
  }, 15 * 1000);
  const billingWebhooks = setInterval(() => {
    runBillingWebhooks();
  }, 2 * 1000);
  const roomSnapshots = setInterval(() => {
    void processRoomSnapshotJobs().catch((error) => logger.warn({ err: error }, "room snapshot worker failed"));
  }, 2 * 1000);
  const operations = setInterval(() => {
    void operationsSnapshot()
      .then((snapshot) => {
        if (needsOperationalAlert(snapshot.billingWebhooks) || needsOperationalAlert(snapshot.roomSnapshots)) {
          logger.error({ operations: snapshot }, "durable worker backlog requires attention");
        }
      })
      .catch((error) => logger.warn({ err: error }, "operations health check failed"));
  }, 60 * 1000);
  timers.push(dunning, daily, identityDeletion, billingWebhooks, roomSnapshots, operations);
  void ensureDailyChallenge().catch(() => undefined);
  void processIdentityDeletionJobs().catch(() => undefined);
  runBillingWebhooks();
  void processRoomSnapshotJobs().catch(() => undefined);
  return () => {
    for (const timer of timers) clearInterval(timer);
  };
}
