import { redis } from "../redis.js";
import { sql } from "../db.js";
import { logger } from "../logger.js";
import { deadlineForRoom } from "../rooms/schedule.js";

const ROOM_TTL_SEC = 6 * 60 * 60;
const DEADLINE_SET = "rooms:deadlines";
const RESERVATION_SET = "rooms:reservation-deadlines";
const CAS_ROOM_STATE = `
  local current = redis.call('GET', KEYS[1])
  if ARGV[3] ~= '' then
    if not current then return 0 end
    local parsed = cjson.decode(current)
    if parsed.version ~= tonumber(ARGV[3]) then return 0 end
  end
  redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[2]))
  return 1
`;

function reservationEntries(code: string, state: unknown): string[] {
  const reservations = (state as { reservations?: unknown }).reservations;
  if (!reservations || typeof reservations !== "object") return [];
  return Object.keys(reservations).map((playerId) => `${code}:${playerId}`);
}

export async function persistRoomMeta(code: string, mode: string, hostUserId: string | null) {
  await sql`
    INSERT INTO rooms ${sql({ code, mode, host_user_id: hostUserId })}
    ON CONFLICT (code) DO NOTHING
  `;
}

export async function addRoomMember(code: string, playerId: string, name: string, userId: string | null) {
  const room = await sql<{ id: string }[]>`SELECT id FROM rooms WHERE code = ${code}`;
  if (!room[0]) return;
  await sql`
    INSERT INTO room_members ${sql({
      room_id: room[0].id,
      player_id: playerId,
      user_id: userId,
      display_name: name,
    })}
    ON CONFLICT DO NOTHING
  `;
}

export async function snapshotAndClose(code: string, reason: "all_left" | "host_ended" | "timeout" | "crash_recover") {
  const raw = await redis.get(`room:${code}`);
  const state = raw ? JSON.parse(raw) : { incomplete: true, code };
  const players = Array.isArray(state.players) ? state.players : [];
  const result = await sql.begin(async (tx) => {
    const rooms = await tx<{ id: string; ended_at: Date | null }[]>`
      SELECT id, ended_at FROM rooms WHERE code = ${code} FOR UPDATE
    `;
    const room = rooms[0];
    if (!room) return { exists: false, enqueued: false };
    const snapshots = await tx<{ room_id: string }[]>`SELECT room_id FROM room_snapshots WHERE room_id = ${room.id}`;
    if (snapshots[0]) return { exists: true, enqueued: false };
    await tx`
      INSERT INTO room_snapshot_outbox ${tx({
        room_id: room.id,
        close_reason: reason,
        final_state: tx.json(state as never),
        player_count: players.length,
      })}
      ON CONFLICT (room_id) DO NOTHING
    `;
    await tx`
      UPDATE rooms SET ended_at = now(), close_reason = ${reason}
      WHERE id = ${room.id} AND ended_at IS NULL
    `;
    return { exists: true, enqueued: true };
  });
  if (!result.exists) {
    await redis.del(`room:${code}`, `room:${code}:hb`, `room:${code}:timer-lock`);
    await redis.zrem(DEADLINE_SET, code);
    const entries = reservationEntries(code, state);
    if (entries.length) await redis.zrem(RESERVATION_SET, ...entries);
    return;
  }
  await redis.del(`room:${code}`, `room:${code}:hb`, `room:${code}:timer-lock`);
  await redis.zrem(DEADLINE_SET, code);
  const entries = reservationEntries(code, state);
  if (entries.length) await redis.zrem(RESERVATION_SET, ...entries);
  logger.info({ code, reason, enqueued: result.enqueued }, "room closure snapshot enqueued");
}

export async function touchRoom(code: string, state: unknown, expectedVersion?: number) {
  const previous = await redis.get(`room:${code}`);
  if (previous) {
    const oldEntries = reservationEntries(code, JSON.parse(previous));
    if (oldEntries.length) await redis.zrem(RESERVATION_SET, ...oldEntries);
  }
  const stored = await redis.eval(
    CAS_ROOM_STATE,
    1,
    `room:${code}`,
    JSON.stringify(state),
    String(ROOM_TTL_SEC),
    expectedVersion === undefined ? "" : String(expectedVersion),
  );
  if (Number(stored) !== 1) throw new Error("Room version changed; retry the action.");
  await redis.set(`room:${code}:hb`, String(Date.now()), "EX", 90);
  const deadline = deadlineForRoom(state as Record<string, unknown>);
  if (deadline === null) await redis.zrem(DEADLINE_SET, code);
  else await redis.zadd(DEADLINE_SET, deadline, code);
  const entries = reservationEntries(code, state);
  const reservations = (state as { reservations?: Record<string, unknown> }).reservations ?? {};
  for (const entry of entries) {
    const playerId = entry.slice(code.length + 1);
    const expiresAt = reservations[playerId];
    if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) await redis.zadd(RESERVATION_SET, expiresAt, entry);
  }
}

export async function dueRoomCodes(now = Date.now(), limit = 100): Promise<string[]> {
  return redis.zrangebyscore(DEADLINE_SET, "-inf", now, "LIMIT", 0, limit);
}

export async function dueRoomReservations(now = Date.now(), limit = 100): Promise<Array<{ code: string; playerId: string }>> {
  const entries = await redis.zrangebyscore(RESERVATION_SET, "-inf", now, "LIMIT", 0, limit);
  return entries.flatMap((entry) => {
    const separator = entry.indexOf(":");
    return separator > 0 ? [{ code: entry.slice(0, separator), playerId: entry.slice(separator + 1) }] : [];
  });
}

/** A lease prevents two API instances from advancing the same timed room. */
export async function claimRoomTimer(code: string): Promise<boolean> {
  const result = await redis.set(`room:${code}:timer-lock`, String(Date.now()), "PX", 5_000, "NX");
  return result === "OK";
}

export async function countOpenRooms(): Promise<number> {
  const rows = await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM rooms WHERE ended_at IS NULL`;
  return Number(rows[0]?.n ?? 0);
}

export async function loadRoom(code: string): Promise<Record<string, unknown> | null> {
  const raw = await redis.get(`room:${code}`);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

export async function sweepStaleRooms(): Promise<number> {
  let closed = 0;
  const open = await sql<{ code: string }[]>`SELECT code FROM rooms WHERE ended_at IS NULL`;
  for (const row of open) {
    const hb = await redis.get(`room:${row.code}:hb`);
    const state = await redis.get(`room:${row.code}`);
    if (!hb || !state) {
      await snapshotAndClose(row.code, "crash_recover");
      closed += 1;
    }
  }
  return closed;
}

export async function ensureDailyChallenge(): Promise<void> {
  const { kolkataDateKey } = await import("../lib/kolkata.js");
  const dateKey = kolkataDateKey();
  const existing = await sql`SELECT id FROM daily_challenges WHERE date_key = ${dateKey}`;
  if (existing[0]) return;
  const games = await sql<{ id: string }[]>`
    SELECT id FROM games WHERE published AND rotation_eligible AND NOT maintenance ORDER BY slug
  `;
  if (!games.length) return;
  const dayNumber = Math.floor(new Date(`${dateKey}T00:00:00+05:30`).getTime() / 86400000);
  const game = games[dayNumber % games.length];
  await sql`
    INSERT INTO daily_challenges ${sql({
      date_key: dateKey,
      game_id: game.id,
      rules: "One accepted session on today’s featured game.",
      cosmetic_id: "badge-challenge",
    })}
    ON CONFLICT (date_key) DO NOTHING
  `;
}
