import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { redis, redisSub } from "../redis.js";
import { logger } from "../logger.js";
import { addRoomMember, loadRoom, persistRoomMeta, snapshotAndClose, touchRoom } from "../services/rooms.js";
import {
  applyMessage,
  applyTimeout,
  emptyRoom,
  MODES,
  newCode,
  view,
  type RoomState,
} from "./engine.js";

type Socket = {
  send: (raw: string) => void;
  close: (code?: number, reason?: string) => void;
  playerId: string;
  roomCode: string | null;
  rateAt: number;
  rate: number;
};

const CHANNEL = "bullwave:rooms";
const local = new Map<string, Set<Socket>>();

function send(socket: Socket, data: unknown) {
  try {
    socket.send(JSON.stringify(data));
  } catch {
    /* closed */
  }
}

function locals(code: string): Set<Socket> {
  if (!local.has(code)) local.set(code, new Set());
  return local.get(code)!;
}

async function publish(code: string, extra?: unknown) {
  await redis.publish(CHANNEL, JSON.stringify({ code, extra }));
}

async function fanout(code: string, extra?: unknown) {
  const room = (await loadRoom(code)) as RoomState | null;
  if (!room) return;
  if (extra) {
    for (const socket of locals(code)) send(socket, extra);
    return;
  }
  for (const socket of locals(code)) {
    if (socket.playerId) send(socket, view(room, socket.playerId));
  }
}

export async function attachRooms(app: FastifyInstance): Promise<void> {
  await redisSub.subscribe(CHANNEL);
  redisSub.on("message", (channel: string, raw: string) => {
    if (channel !== CHANNEL) return;
    try {
      const parsed = JSON.parse(raw) as { code: string; extra?: unknown };
      void fanout(parsed.code, parsed.extra);
    } catch (error) {
      logger.warn({ err: error }, "room pubsub parse failed");
    }
  });

  const timer = setInterval(() => {
    void (async () => {
      const keys = await redis.keys("room:*:hb");
      for (const key of keys) {
        const code = key.slice(5, -3);
        const room = (await loadRoom(code)) as RoomState | null;
        if (!room) continue;
        const next = applyTimeout(room);
        if (!next) continue;
        await touchRoom(code, next);
        if (next.phase === "ended" && room.phase !== "ended") {
          await snapshotAndClose(code, "timeout");
        }
        await publish(code);
      }
    })();
  }, 250);

  app.addHook("onClose", async () => {
    clearInterval(timer);
    for (const sockets of local.values()) {
      for (const socket of sockets) socket.close(1012, "Server restarting");
    }
    local.clear();
  });

  app.get("/rooms", { websocket: true }, (socket) => {
    const ws = socket as unknown as Socket;
    ws.playerId = randomBytes(8).toString("hex");
    ws.roomCode = null;
    ws.rateAt = Date.now();
    ws.rate = 0;

    socket.on("message", (raw) => {
      void (async () => {
        try {
          if (Date.now() - ws.rateAt > 1000) {
            ws.rateAt = Date.now();
            ws.rate = 0;
          }
          if (++ws.rate > 120) {
            ws.close(1008, "Too many messages");
            return;
          }
          const message = JSON.parse(raw.toString()) as Record<string, unknown>;
          if (!message || typeof message !== "object") return;

          if (message.type === "create" || message.type === "join") {
            if (!MODES.has(String(message.mode))) throw new Error("Unknown room game.");
            const name = typeof message.name === "string" ? message.name.trim().slice(0, 24) : "";
            if (!name) throw new Error("Enter a player name.");
            let code: string;
            let room: RoomState;
            if (message.type === "create") {
              const count = (await redis.keys("room:*:hb")).length;
              if (count >= 50) throw new Error("Room limit reached.");
              do {
                code = newCode();
              } while (await redis.exists(`room:${code}`));
              room = emptyRoom(code, String(message.mode));
              await persistRoomMeta(code, room.mode, null);
            } else {
              code = String(message.code).toUpperCase();
              room = (await loadRoom(code)) as RoomState;
              if (!room || room.mode !== message.mode) throw new Error("Room not found for this game.");
              if (room.phase !== "lobby") throw new Error("This game has already started.");
              if (room.players.length >= (message.mode === "multiplayer-ludo" ? 4 : 12)) throw new Error("Room is full.");
            }
            if (ws.roomCode) locals(ws.roomCode).delete(ws);
            room.players = [
              ...room.players,
              {
                id: ws.playerId,
                name,
                score: 0,
                team: message.team === "Blue" ? "Blue" : message.team === "Gold" ? "Gold" : "Solo",
              },
            ];
            ws.roomCode = code;
            locals(code).add(ws);
            await addRoomMember(code, ws.playerId, name, null);
            await touchRoom(code, room);
            await publish(code);
            return;
          }

          if (!ws.roomCode) return;
          const room = (await loadRoom(ws.roomCode)) as RoomState | null;
          if (!room) return;
          const result = applyMessage(room, ws.playerId, message);
          if (result.error) {
            send(ws, { type: "error", message: result.error });
            return;
          }
          if (result.close) {
            await snapshotAndClose(ws.roomCode, "all_left");
            locals(ws.roomCode).delete(ws);
            ws.roomCode = null;
            return;
          }
          await touchRoom(ws.roomCode, result.room);
          if (result.room.phase === "ended" && room.phase !== "ended" && result.room.players.length) {
            /* keep Redis until idle timeout / last leave so rematch in lobby works */
          }
          await publish(ws.roomCode, result.extra);
          if (!result.extra) await publish(ws.roomCode);
        } catch (error) {
          send(ws, {
            type: "error",
            message: error instanceof SyntaxError ? "Invalid message." : (error as Error).message || "Unable to process action.",
          });
        }
      })();
    });

    socket.on("close", () => {
      void (async () => {
        if (!ws.roomCode) return;
        const room = (await loadRoom(ws.roomCode)) as RoomState | null;
        locals(ws.roomCode).delete(ws);
        if (!room) return;
        const result = applyMessage(room, ws.playerId, { type: "leave" });
        if (result.close) {
          await snapshotAndClose(ws.roomCode, "all_left");
          return;
        }
        await touchRoom(ws.roomCode, result.room);
        await publish(ws.roomCode);
      })();
    });
  });
}
