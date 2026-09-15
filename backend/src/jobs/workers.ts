import { drainOutbox, rebuildLeaderboards } from "../services/leaderboard.js";
import { expireGraceWindows } from "../services/membership.js";
import { ensureDailyChallenge, sweepStaleRooms } from "../services/rooms.js";
import { logger } from "../logger.js";
import { processIdentityDeletionJobs } from "../services/identity.js";
import { processWebhookEvents } from "../services/billing.js";
import { processRoomSnapshotJobs } from "../services/roomSnapshots.js";
import { needsOperationalAlert, operationsSnapshot } from "../services/operations.js";
import { createScheduler } from "./scheduler.js";
import { processEmailJobs } from '../mailer.js';

export function startWorkers(): () => Promise<void> {
  const scheduler = createScheduler((job, error) => logger.warn({ err: error, job }, "worker job failed"));
  // Keep jobs scheduled through outages; ioredis reconnects and subsequent runs recover.
  scheduler.add("leaderboard-outbox", 4_000, drainOutbox);
  scheduler.add("leaderboard-rebuild", 15 * 60_000, rebuildLeaderboards);
  scheduler.add("room-sweeper", 30_000, sweepStaleRooms);
  scheduler.add("membership-expiry", 60_000, expireGraceWindows);
  scheduler.add("daily-challenge", 60_000, ensureDailyChallenge);
  scheduler.add("identity-deletion", 15_000, processIdentityDeletionJobs);
  scheduler.add("billing-webhooks", 2_000, processWebhookEvents);
  scheduler.add('email-delivery', 5_000, processEmailJobs);
  scheduler.add("room-snapshots", 2_000, processRoomSnapshotJobs);
  scheduler.add("operations", 60_000, async () => {
    const snapshot = await operationsSnapshot();
    if (needsOperationalAlert(snapshot.billingWebhooks) || needsOperationalAlert(snapshot.roomSnapshots)
      || needsOperationalAlert(snapshot.identityDeletions) || needsOperationalAlert(snapshot.emails)
      || snapshot.leaderboard.oldestAgeSeconds > 60) {
      logger.error({ operations: snapshot }, "durable worker backlog requires attention");
    }
  });
  return () => scheduler.stop();
}
