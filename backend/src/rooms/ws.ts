import type { FastifyInstance } from "fastify";
import { redis, redisSub } from "../redis.js";
import { logger } from "../logger.js";
import {
  addRoomMember,
  claimRoomTimer,
  countOpenRooms,
  dueRoomCodes,
  dueRoomReservations,
  loadRoom,
  persistRoomMeta,
  snapshotAndClose,
  touchRoom,
} from "../services/rooms.js";
import {
  applyMessage,
  applyTimeout,
  emptyRoom,
  MODES,
  newCode,
  view,
  type RoomState,
} from "./engine.js";
import { isAllowedRoomOrigin, verifyRoomTicket } from "./tickets.js";
import { enqueueRoomAction } from "./serial.js";
import { clearResumeCredential, consumeResumeCredential, createResumeCredential, resumeReservationExpiry } from "./resume.js";
import { socketIsTooSlow, validActionId } from "./delivery.js";
import { nextVersion } from "./version.js";
import { roomSocketClosed, roomSocketOpened } from "../services/runtimeMetrics.js";
import { hitRateLimit } from "../lib/rate-limit.js";
import { roomMessageSchema } from "./messages.js";
import { priorAction, rememberAction } from "./actions.js";

type Socket = {
  send: (raw: string) => void;
  close: (code?: number, reason?: string) => void;
  bufferedAmount?: number;
  playerId: string;
  roomCode: string | null;
  rateAt: number;
  rate: number;
};

const CHANNEL = "bullwave:rooms";
const local = new Map<string, Set<Socket>>();

function send(socket: Socket, data: unknown) {
  try {
    const raw = JSON.stringify(data);
    if (socketIsTooSlow(socket.bufferedAmount, Buffer.byteLength(raw))) {
      socket.close(1008, "Client is not reading room updates");
      return;
    }
    socket.send(raw);
  } catch {
    /* closed */
  }
}

function acknowledge(socket: Socket, message: Record<string, unknown>, version: number, closed = false) {
  if (message.actionId === undefined) return;
  send(socket, { type: "ack", actionId: message.actionId, version, closed });
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
      const codes = await dueRoomCodes();
      for (const code of codes) {
        if (!(await claimRoomTimer(code))) continue;
        await enqueueRoomAction(code, async () => {
          const room = (await loadRoom(code)) as RoomState | null;
          if (!room) return;
          const next = applyTimeout(room);
          if (!next) return;
          await touchRoom(code, { ...next, version: nextVersion(room.version, room.version) }, room.version);
          if (next.phase === "ended" && room.phase !== "ended") {
            await snapshotAndClose(code, "timeout");
          }
          await publish(code);
        });
      }
      for (const reservation of await dueRoomReservations()) {
        if (!(await claimRoomTimer(reservation.code))) continue;
        await enqueueRoomAction(reservation.code, async () => {
          const room = (await loadRoom(reservation.code)) as RoomState | null;
          if (!room || !room.reservations?.[reservation.playerId] || room.reservations[reservation.playerId] > Date.now()) return;
          const result = applyMessage(room, reservation.playerId, { type: "leave" });
          await clearResumeCredential(reservation.code, reservation.playerId);
          if (result.close) return snapshotAndClose(reservation.code, "all_left");
          const { [reservation.playerId]: _expired, ...reservations } = room.reservations;
          await touchRoom(reservation.code, { ...result.room, reservations, version: nextVersion(room.version, room.version) }, room.version);
          await publish(reservation.code);
        });
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

  app.get("/rooms", { websocket: true }, async (socket, request) => {
    const ws = socket as unknown as Socket;
    const query = request.query as { ticket?: unknown };
    const ticket = typeof query.ticket === "string" ? query.ticket : "";
    if (!isAllowedRoomOrigin(request.headers.origin) || !ticket) {
      ws.close(1008, "Room ticket required");
      return;
    }
    let userId: string;
    try {
      const admission = await verifyRoomTicket(ticket);
      ws.playerId = admission.playerId;
      userId = admission.userId;
      await hitRateLimit(`rl:rooms:connect:${request.ip}`, 30, 60);
    } catch {
      ws.close(1008, "Invalid or expired room ticket");
      return;
    }
    ws.roomCode = null;
    ws.rateAt = Date.now();
    ws.rate = 0;
    roomSocketOpened();

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
          const rawMessage = JSON.parse(raw.toString()) as unknown;
          const parsed = roomMessageSchema.safeParse(rawMessage);
          if (!parsed.success) throw new Error("Invalid room message.");
          const message = parsed.data;
          if (message.actionId !== undefined && !validActionId(message.actionId)) throw new Error("Invalid action ID.");
          // Admission changes membership and capacity, so it shares one queue until a room code exists.
          const resumeCode = message.type === "resume" && typeof message.code === "string" ? message.code.toUpperCase() : null;
          const queueKey = ws.roomCode ?? resumeCode ?? "room-admission";
          await enqueueRoomAction(queueKey, async () => {

          if (message.type === "resume") {
            const playerId = typeof message.playerId === "string" ? message.playerId : "";
            const credential = typeof message.credential === "string" ? message.credential : "";
            if (!resumeCode || !playerId || !credential) throw new Error("Invalid room resume request.");
            const room = (await loadRoom(resumeCode)) as RoomState | null;
            if (!room || !room.reservations?.[playerId] || room.reservations[playerId] <= Date.now()) {
              throw new Error("Your room reservation has expired.");
            }
            if (!(await consumeResumeCredential(resumeCode, playerId, userId, credential))) throw new Error("Invalid room resume credential.");
            const { [playerId]: _reservation, ...reservations } = room.reservations;
            ws.playerId = playerId;
            ws.roomCode = resumeCode;
            locals(resumeCode).add(ws);
            await touchRoom(resumeCode, { ...room, reservations, version: nextVersion(room.version, room.version) }, room.version);
            const nextCredential = await createResumeCredential(resumeCode, playerId, userId);
            send(ws, { type: "resume_credential", code: resumeCode, playerId, ...nextCredential });
            acknowledge(ws, message, room.version + 1);
            await publish(resumeCode);
            return;
          }

          if (message.type === "create" || message.type === "join") {
            if (ws.roomCode) throw new Error("Already joined to a room.");
            if (!MODES.has(String(message.mode))) throw new Error("Unknown room game.");
            const name = typeof message.name === "string" ? message.name.trim().slice(0, 24) : "";
            if (!name) throw new Error("Enter a player name.");
            let code: string;
            let room: RoomState;
            if (message.type === "create") {
              const count = await countOpenRooms();
              if (count >= 50) throw new Error("Room limit reached.");
              do {
                code = newCode();
              } while (await redis.exists(`room:${code}`));
              room = emptyRoom(code, String(message.mode));
              await persistRoomMeta(code, room.mode, userId);
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
            await addRoomMember(code, ws.playerId, name, userId);
            await touchRoom(code, { ...room, version: room.version + 1 }, message.type === "join" ? room.version : undefined);
            const credential = await createResumeCredential(code, ws.playerId, userId);
            send(ws, { type: "resume_credential", code, playerId: ws.playerId, ...credential });
            acknowledge(ws, message, room.version + 1);
            await publish(code);
            return;
          }

          if (!ws.roomCode) return;
          const room = (await loadRoom(ws.roomCode)) as RoomState | null;
          if (!room) return;
          if (message.actionId) {
            const prior = priorAction(room.actionHistory, ws.playerId, message.actionId);
            if (prior) {
              acknowledge(ws, message, prior.version);
              return;
            }
          }
          const result = applyMessage(room, ws.playerId, message);
          if (result.error) {
            send(ws, { type: "error", message: result.error });
            return;
          }
          if (result.close) {
            await clearResumeCredential(ws.roomCode, ws.playerId);
            await snapshotAndClose(ws.roomCode, "all_left");
            acknowledge(ws, message, room.version + 1, true);
            locals(ws.roomCode).delete(ws);
            ws.roomCode = null;
            return;
          }
          const version = nextVersion(room.version, room.version);
          const actionHistory = message.actionId
            ? rememberAction(room.actionHistory, { playerId: ws.playerId, actionId: message.actionId, version })
            : room.actionHistory;
          await touchRoom(ws.roomCode, { ...result.room, actionHistory, version }, room.version);
          acknowledge(ws, message, version);
          if (result.room.phase === "ended" && room.phase !== "ended" && result.room.players.length) {
            /* keep Redis until idle timeout / last leave so rematch in lobby works */
          }
          await publish(ws.roomCode, result.extra);
          if (!result.extra) await publish(ws.roomCode);
          });
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
        roomSocketClosed();
        if (!ws.roomCode) return;
        const roomCode = ws.roomCode;
        await enqueueRoomAction(roomCode, async () => {
          const room = (await loadRoom(roomCode)) as RoomState | null;
          locals(roomCode).delete(ws);
          if (!room) return;
          const reservations = { ...(room.reservations ?? {}), [ws.playerId]: resumeReservationExpiry() };
          await touchRoom(roomCode, { ...room, reservations, version: nextVersion(room.version, room.version) }, room.version);
          await publish(roomCode);
        });
      })();
    });
  });
}
