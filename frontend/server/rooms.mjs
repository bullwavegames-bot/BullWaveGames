import { WebSocketServer } from "ws";
import { randomInt, randomBytes } from "node:crypto";
import { createLudo, rollLudo, moveLudo } from "../shared/ludo.mjs";
import { QUESTIONS } from "../shared/questions.mjs";

const MODES = new Set([
  "draw-guess",
  "multiplayer-ludo",
  "live-trivia",
  "trivia-battle",
]);
const WORDS = [
  "APPLE",
  "HOUSE",
  "SUN",
  "BICYCLE",
  "ELEPHANT",
  "GUITAR",
  "ROCKET",
  "PIZZA",
  "RAINBOW",
  "FLOWER",
  "UMBRELLA",
  "BUTTERFLY",
];
export function attachRooms(server) {
  const rooms = new Map(),
    wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  const send = (ws, data) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
  };
  const view = (room, player) => ({
    type: "state",
    code: room.code,
    mode: room.mode,
    phase: room.phase,
    you: player.id,
    host: room.players[0]?.id,
    players: room.players.map(({ id, name, score, team }) => ({
      id,
      name,
      score,
      team,
    })),
    round: room.round,
    rounds: room.rounds,
    deadline: room.deadline,
    now: Date.now(),
    message: room.message,
    ludo: room.ludo,
    drawer:
      room.mode === "draw-guess"
        ? room.players[room.round % room.players.length]?.id
        : null,
    word:
      room.mode === "draw-guess" &&
      (room.phase === "reveal" ||
        room.players[room.round % room.players.length]?.id === player.id)
        ? room.word
        : null,
    wordLength: room.word?.length,
    question: room.question ? [room.question[0], room.question[1]] : null,
    correct: room.phase === "reveal" ? room.question?.[2] : null,
    answered: room.answers.has(player.id),
    chat: room.chat,
  });
  const broadcast = (room) =>
    room.players.forEach((p) => send(p.ws, view(room, p)));
  const nextRound = (room) => {
    room.answers.clear();
    room.phase = "playing";
    room.deadline = Date.now() + (room.mode === "draw-guess" ? 60000 : 20000);
    room.message = "";
    if (room.mode === "draw-guess") {
      room.word = WORDS[randomInt(WORDS.length)];
      room.strokes = [];
      room.players.forEach((p) => send(p.ws, { type: "clear" }));
    } else room.question = room.questions[room.round];
    broadcast(room);
  };
  const reveal = (room) => {
    room.phase = "reveal";
    room.deadline = Date.now() + 4000;
    room.message =
      room.mode === "draw-guess"
        ? `The word was ${room.word}`
        : `Correct: ${room.question[1][room.question[2]]}`;
    broadcast(room);
  };
  const leave = (ws) => {
    const room = rooms.get(ws.room);
    if (!room) return;
    room.players = room.players.filter((p) => p.ws !== ws);
    ws.room = null;
    if (!room.players.length) {
      rooms.delete(room.code);
      return;
    }
    if (room.phase !== "lobby") {
      room.phase = "ended";
      room.message = "A player left. Return to the lobby to start a new game.";
    }
    broadcast(room);
  };
  const upgrade = (req, socket, head) => {
    if (req.url?.split("?")[0] !== "/rooms") return;
    // Browser rooms are same-origin. Non-browser clients can be used for local testing.
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) {
          socket.destroy();
          return;
        }
      } catch {
        socket.destroy();
        return;
      }
    }
    if (wss.clients.size >= 200) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  };
  server.on("upgrade", upgrade);
  wss.on("connection", (ws) => {
    ws.alive = true;
    ws.on("pong", () => (ws.alive = true));
    ws.rateAt = Date.now();
    ws.rate = 0;
    ws.on("message", (raw) => {
      try {
        if (Date.now() - ws.rateAt > 1000) {
          ws.rateAt = Date.now();
          ws.rate = 0;
        }
        if (++ws.rate > 120) {
          ws.close(1008, "Too many messages");
          return;
        }
        const m = JSON.parse(raw.toString());
        if (!m || typeof m !== "object") return;
        if (m.type === "create" || m.type === "join") {
          if (!MODES.has(m.mode)) throw Error("Unknown room game.");
          const name =
            typeof m.name === "string" ? m.name.trim().slice(0, 24) : "";
          if (!name) throw Error("Enter a player name.");
          let room;
          if (m.type === "create") {
            if (rooms.size >= 50) throw Error("Room limit reached.");
            let code;
            do {
              code = randomBytes(3).toString("hex").toUpperCase();
            } while (rooms.has(code));
            room = {
              code,
              mode: m.mode,
              phase: "lobby",
              players: [],
              round: 0,
              rounds: 10,
              deadline: 0,
              answers: new Set(),
              chat: [],
              strokes: [],
              message: "Share this code with friends connected to this server.",
            };
            rooms.set(code, room);
          } else {
            room = rooms.get(String(m.code).toUpperCase());
            if (!room || room.mode !== m.mode)
              throw Error("Room not found for this game.");
            if (room.phase !== "lobby")
              throw Error("This game has already started.");
            if (room.players.length >= (m.mode === "multiplayer-ludo" ? 4 : 12))
              throw Error("Room is full.");
          }
          leave(ws);
          const p = {
            id: randomBytes(8).toString("hex"),
            name,
            ws,
            score: 0,
            team:
              m.team === "Blue" ? "Blue" : m.team === "Gold" ? "Gold" : "Solo",
          };
          room.players.push(p);
          ws.room = room.code;
          broadcast(room);
          return;
        }
        const room = rooms.get(ws.room),
          p = room?.players.find((x) => x.ws === ws);
        if (!room || !p) return;
        if (m.type === "leave") {
          leave(ws);
          return;
        }
        if (m.type === "start") {
          if (room.players[0] !== p || !["lobby", "ended"].includes(room.phase))
            return;
          if (room.players.length < 2)
            throw Error("At least two players are required.");
          room.players.forEach((x) => (x.score = 0));
          room.round = 0;
          room.chat = [];
          room.answers.clear();
          room.question = null;
          room.word = null;
          if (room.mode === "multiplayer-ludo") {
            room.ludo = createLudo(room.players.length);
            room.phase = "playing";
            room.deadline = 0;
            room.message = "Player 1 rolls.";
            broadcast(room);
          } else {
            room.rounds =
              room.mode === "draw-guess" ? room.players.length * 2 : 10;
            room.questions = [
              ...QUESTIONS.general,
              ...QUESTIONS.sports,
              ...QUESTIONS.movies,
            ]
              .map((q) => ({ q, key: Math.random() }))
              .sort((a, b) => a.key - b.key)
              .slice(0, 10)
              .map((x) => x.q);
            nextRound(room);
          }
          return;
        }
        if (room.phase !== "playing") return;
        if (room.mode === "multiplayer-ludo") {
          if (room.players[room.ludo.turn] !== p) return;
          if (m.type === "roll")
            room.ludo = rollLudo(room.ludo, randomInt(1, 7));
          if (m.type === "move" && Number.isInteger(m.index))
            room.ludo = moveLudo(room.ludo, m.index);
          room.message = room.ludo.message;
          if (room.ludo.winner !== null) {
            room.phase = "ended";
            room.players[room.ludo.winner].score = 1000;
          }
          broadcast(room);
          return;
        }
        if (Date.now() > room.deadline) return;
        if (room.mode === "draw-guess") {
          const drawer = room.players[room.round % room.players.length];
          if (
            m.type === "stroke" &&
            p === drawer &&
            room.strokes.length < 5000
          ) {
            if (
              !Array.isArray(m.line) ||
              m.line.length !== 4 ||
              !m.line.every(
                (n) =>
                  typeof n === "number" &&
                  Number.isFinite(n) &&
                  n >= 0 &&
                  n <= 1,
              )
            )
              return;
            const stroke = {
              type: "stroke",
              line: m.line,
              color: [
                "#f1f5f9",
                "#61d6b0",
                "#43c7e8",
                "#d5aa50",
                "#f16f78",
              ].includes(m.color)
                ? m.color
                : "#f1f5f9",
            };
            room.strokes.push(stroke);
            room.players.forEach((x) => send(x.ws, stroke));
            return;
          }
          if (m.type === "clear" && p === drawer) {
            room.strokes = [];
            room.players.forEach((x) => send(x.ws, { type: "clear" }));
            return;
          }
          if (
            m.type === "guess" &&
            p !== drawer &&
            !room.answers.has(p.id) &&
            typeof m.text === "string"
          ) {
            const text = m.text.trim().slice(0, 80);
            if (!text) return;
            if (text.toUpperCase() === room.word) {
              room.answers.add(p.id);
              p.score += 100;
              drawer.score += 50;
              room.chat.push(`${p.name} guessed correctly!`);
            } else room.chat.push(`${p.name}: ${text}`);
            room.chat = room.chat.slice(-20);
            if (room.answers.size >= room.players.length - 1) reveal(room);
            else broadcast(room);
          }
          return;
        }
        if (
          m.type === "answer" &&
          Number.isInteger(m.answer) &&
          m.answer >= 0 &&
          m.answer < 4 &&
          !room.answers.has(p.id) &&
          m.round === room.round
        ) {
          room.answers.add(p.id);
          if (m.answer === room.question[2]) p.score += 100;
          if (room.answers.size === room.players.length) reveal(room);
          else broadcast(room);
        }
      } catch (error) {
        send(ws, {
          type: "error",
          message:
            error instanceof SyntaxError
              ? "Invalid message."
              : error.message || "Unable to process action.",
        });
      }
    });
    ws.on("close", () => leave(ws));
    ws.on("error", () => leave(ws));
  });
  const timer = setInterval(() => {
    for (const room of rooms.values()) {
      if (!room.deadline || Date.now() < room.deadline) continue;
      if (room.phase === "playing") reveal(room);
      else if (room.phase === "reveal") {
        room.round++;
        if (room.round >= room.rounds) {
          room.phase = "ended";
          room.deadline = 0;
          room.message = "Game complete.";
          broadcast(room);
        } else nextRound(room);
      }
    }
  }, 250);
  const heartbeat = setInterval(
    () =>
      wss.clients.forEach((ws) => {
        if (!ws.alive) return ws.terminate();
        ws.alive = false;
        ws.ping();
      }),
    30000,
  );
  const close = () => {
    clearInterval(timer);
    clearInterval(heartbeat);
    server.off("upgrade", upgrade);
    wss.clients.forEach((ws) => ws.terminate());
    wss.close();
  };
  server.once("close", close);
  return { close, rooms };
}
export function roomPlugin() {
  return {
    name: "bullwave-local-rooms",
    configureServer(server) {
      if (server.httpServer) attachRooms(server.httpServer);
    },
    configurePreviewServer(server) {
      if (server.httpServer) attachRooms(server.httpServer);
    },
  };
}
