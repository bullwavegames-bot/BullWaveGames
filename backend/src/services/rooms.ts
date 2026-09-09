import { redis } from "../redis.js";
import { sql } from "../db.js";
import { logger } from "../logger.js";

const ROOM_TTL_SEC = 6 * 60 * 60;

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
  const room = await sql<{ id: string; ended_at: Date | null }[]>`SELECT id, ended_at FROM rooms WHERE code = ${code}`;
  if (!room[0]) {
    await redis.del(`room:${code}`, `room:${code}:hb`);
    return;
  }
  if (room[0].ended_at) {
    const hasSnap = await sql<{ room_id: string }[]>`SELECT room_id FROM room_snapshots WHERE room_id = ${room[0].id}`;
    if (hasSnap[0]) {
      await redis.del(`room:${code}`, `room:${code}:hb`);
      return;
    }
  }
  const state = raw ? JSON.parse(raw) : { incomplete: true, code };
  const players = Array.isArray(state.players) ? state.players : [];
  await sql`
    INSERT INTO room_snapshots ${sql({
      room_id: room[0].id,
      close_reason: reason,
      final_state: sql.json(state as never),
      player_count: players.length,
    })}
    ON CONFLICT (room_id) DO NOTHING
  `;
  await sql`
    UPDATE rooms SET ended_at = now(), close_reason = ${reason} WHERE id = ${room[0].id} AND ended_at IS NULL
  `;
  await redis.del(`room:${code}`, `room:${code}:hb`);
  logger.info({ code, reason }, "room closed and snapshotted");
}

export async function touchRoom(code: string, state: unknown) {
  await redis.set(`room:${code}`, JSON.stringify(state), "EX", ROOM_TTL_SEC);
  await redis.set(`room:${code}:hb`, String(Date.now()), "EX", 90);
}

export async function loadRoom(code: string): Promise<Record<string, unknown> | null> {
  const raw = await redis.get(`room:${code}`);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

export async function sweepStaleRooms(): Promise<number> {
  let closed = 0;
  const keys: string[] = await redis.keys("room:*:hb");
  const live = new Set<string>(keys.map((key: string) => key.slice(5, -3)));
  const open = await sql<{ code: string }[]>`SELECT code FROM rooms WHERE ended_at IS NULL`;
  for (const row of open) {
    const hb = await redis.get(`room:${row.code}:hb`);
    const state = await redis.get(`room:${row.code}`);
    if (!hb || !state) {
      await snapshotAndClose(row.code, "crash_recover");
      closed += 1;
    }
  }
  for (const code of live) {
    const ended = await sql<{ ended_at: Date | null }[]>`SELECT ended_at FROM rooms WHERE code = ${code}`;
    if (ended[0]?.ended_at) {
      const snap = await sql<{ n: string }[]>`
        SELECT count(*)::text AS n FROM room_snapshots s JOIN rooms r ON r.id = s.room_id WHERE r.code = ${code}
      `;
      if (Number(snap[0]?.n ?? 0) === 0) await snapshotAndClose(code, "crash_recover");
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
