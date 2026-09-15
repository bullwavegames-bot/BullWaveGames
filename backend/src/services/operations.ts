import { sql } from "../db.js";
import { runtimeMetrics } from "./runtimeMetrics.js";

export type QueueHealth = { pending: number; failed: number; deadLetter: number; oldestAgeSeconds: number };

export function needsOperationalAlert(queue: QueueHealth): boolean {
  return queue.deadLetter > 0 || queue.oldestAgeSeconds > 60;
}

async function durableQueueHealth(table: "webhook_events" | "room_snapshot_outbox" | "identity_deletion_jobs" | "email_outbox"): Promise<QueueHealth> {
  const rows = await sql<{
    pending: string;
    failed: string;
    dead_letter: string;
    oldest_age_seconds: string;
  }[]>`
    SELECT
      count(*) FILTER (WHERE status IN ('pending', 'processing'))::text AS pending,
      count(*) FILTER (WHERE status = 'failed')::text AS failed,
      count(*) FILTER (WHERE status = 'dead_letter')::text AS dead_letter,
      COALESCE(extract(epoch FROM now() - min(created_at) FILTER (WHERE status IN ('pending', 'processing', 'failed'))), 0)::text AS oldest_age_seconds
    FROM ${sql(table)}
  `;
  const row = rows[0];
  return {
    pending: Number(row?.pending ?? 0),
    failed: Number(row?.failed ?? 0),
    deadLetter: Number(row?.dead_letter ?? 0),
    oldestAgeSeconds: Math.max(0, Math.floor(Number(row?.oldest_age_seconds ?? 0))),
  };
}

export async function operationsSnapshot() {
  const [billingWebhooks, roomSnapshots, identityDeletions, emails, leaderboardRows, openRooms] = await Promise.all([
    durableQueueHealth("webhook_events"),
    durableQueueHealth("room_snapshot_outbox"),
    durableQueueHealth("identity_deletion_jobs"),
    durableQueueHealth("email_outbox"),
    sql<{ pending: string; oldest_age_seconds: string }[]>`
      SELECT count(*) FILTER (WHERE published_at IS NULL)::text AS pending,
        COALESCE(extract(epoch FROM now() - min(created_at) FILTER (WHERE published_at IS NULL)), 0)::text AS oldest_age_seconds
      FROM leaderboard_outbox
    `,
    sql<{ n: string }[]>`SELECT count(*)::text AS n FROM rooms WHERE ended_at IS NULL`,
  ]);
  return {
    billingWebhooks,
    roomSnapshots,
    identityDeletions,
    emails,
    leaderboard: {
      pending: Number(leaderboardRows[0]?.pending ?? 0),
      oldestAgeSeconds: Math.max(0, Math.floor(Number(leaderboardRows[0]?.oldest_age_seconds ?? 0))),
    },
    rooms: { open: Number(openRooms[0]?.n ?? 0) },
    runtime: runtimeMetrics(),
  };
}
