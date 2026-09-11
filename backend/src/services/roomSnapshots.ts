import { sql } from "../db.js";
import { logger } from "../logger.js";

type SnapshotJob = {
  room_id: string;
  close_reason: "all_left" | "host_ended" | "timeout" | "crash_recover";
  final_state: unknown;
  player_count: number;
  attempt_count: number;
};

export function roomSnapshotRetryDelaySeconds(attemptCount: number): number {
  return Math.min(300, 2 ** Math.min(attemptCount + 1, 8));
}

export async function processRoomSnapshotJobs(limit = 20): Promise<number> {
  const jobs = await sql.begin(async (tx) => {
    const rows = await tx<SnapshotJob[]>`
      SELECT room_id, close_reason, final_state, player_count, attempt_count
      FROM room_snapshot_outbox
      WHERE (status IN ('pending', 'failed') AND next_attempt_at <= now())
         OR (status = 'processing' AND processing_started_at < now() - interval '5 minutes')
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    for (const row of rows) {
      await tx`
        UPDATE room_snapshot_outbox
        SET status = 'processing', attempt_count = attempt_count + 1,
            processing_started_at = now(), updated_at = now()
        WHERE room_id = ${row.room_id}
      `;
    }
    return rows;
  });

  for (const job of jobs) {
    try {
      await sql.begin(async (tx) => {
        await tx`
          INSERT INTO room_snapshots ${tx({
            room_id: job.room_id,
            close_reason: job.close_reason,
            final_state: tx.json(job.final_state as never),
            player_count: job.player_count,
          })}
          ON CONFLICT (room_id) DO NOTHING
        `;
        await tx`
          UPDATE room_snapshot_outbox
          SET status = 'completed', completed_at = now(), processing_started_at = NULL,
              last_error = NULL, updated_at = now()
          WHERE room_id = ${job.room_id}
        `;
      });
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 500);
      const nextAttempt = job.attempt_count + 1;
      await sql`
        UPDATE room_snapshot_outbox
        SET status = ${nextAttempt >= 10 ? "dead_letter" : "failed"},
            processing_started_at = NULL,
            next_attempt_at = now() + (${roomSnapshotRetryDelaySeconds(job.attempt_count)} * interval '1 second'),
            last_error = ${message}, updated_at = now()
        WHERE room_id = ${job.room_id}
      `;
      logger.warn({ err: error, roomId: job.room_id }, "room snapshot worker failed");
    }
  }
  return jobs.length;
}
