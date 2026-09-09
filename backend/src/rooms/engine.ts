import { randomBytes, randomInt } from "node:crypto";
import { createLudo, moveLudo, rollLudo } from "../../../shared/ludo.mjs";
import { QUESTIONS } from "../../../shared/questions.mjs";

export const MODES = new Set(["draw-guess", "multiplayer-ludo", "live-trivia", "trivia-battle"]);
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

export type RoomPlayer = { id: string; name: string; score: number; team: string };
export type RoomState = {
  code: string;
  mode: string;
  phase: string;
  players: RoomPlayer[];
  round: number;
  rounds: number;
  deadline: number;
  answers: string[];
  chat: string[];
  strokes: unknown[];
  message: string;
  word?: string | null;
  question?: unknown;
  questions?: unknown[];
  ludo?: ReturnType<typeof createLudo> | null;
};

export function emptyRoom(code: string, mode: string): RoomState {
  return {
    code,
    mode,
    phase: "lobby",
    players: [],
    round: 0,
    rounds: 10,
    deadline: 0,
    answers: [],
    chat: [],
    strokes: [],
    message: "Share this code with friends connected to this server.",
    word: null,
    question: null,
    ludo: null,
  };
}

export function newCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

export function view(room: RoomState, playerId: string) {
  const player = room.players.find((item) => item.id === playerId);
  return {
    type: "state",
    code: room.code,
    mode: room.mode,
    phase: room.phase,
    you: playerId,
    host: room.players[0]?.id,
    players: room.players.map(({ id, name, score, team }) => ({ id, name, score, team })),
    round: room.round,
    rounds: room.rounds,
    deadline: room.deadline,
    now: Date.now(),
    message: room.message,
    ludo: room.ludo,
    drawer: room.mode === "draw-guess" ? room.players[room.round % Math.max(room.players.length, 1)]?.id : null,
    word:
      room.mode === "draw-guess" &&
      (room.phase === "reveal" || room.players[room.round % Math.max(room.players.length, 1)]?.id === playerId)
        ? room.word
        : null,
    wordLength: room.word?.length,
    question: Array.isArray(room.question) ? [room.question[0], room.question[1]] : null,
    correct: room.phase === "reveal" && Array.isArray(room.question) ? room.question[2] : null,
    answered: room.answers.includes(playerId),
    chat: room.chat,
    youName: player?.name,
  };
}

export function nextRound(room: RoomState): RoomState {
  const next = { ...room, answers: [], phase: "playing", message: "" };
  next.deadline = Date.now() + (room.mode === "draw-guess" ? 60000 : 20000);
  if (room.mode === "draw-guess") {
    next.word = WORDS[randomInt(WORDS.length)];
    next.strokes = [];
  } else {
    next.question = next.questions?.[next.round] ?? null;
  }
  return next;
}

export function reveal(room: RoomState): RoomState {
  return {
    ...room,
    phase: "reveal",
    deadline: Date.now() + 4000,
    message:
      room.mode === "draw-guess"
        ? `The word was ${room.word}`
        : `Correct: ${Array.isArray(room.question) ? (room.question[1] as string[])[room.question[2] as number] : ""}`,
  };
}

export function applyTimeout(room: RoomState): RoomState | null {
  if (!room.deadline || Date.now() < room.deadline) return null;
  if (room.phase === "playing") return reveal(room);
  if (room.phase === "reveal") {
    const round = room.round + 1;
    if (round >= room.rounds) {
      return { ...room, round, phase: "ended", deadline: 0, message: "Game complete." };
    }
    return nextRound({ ...room, round });
  }
  return null;
}

export function applyMessage(
  room: RoomState,
  playerId: string,
  message: Record<string, unknown>,
): { room: RoomState; extra?: { type: string; [k: string]: unknown }; error?: string; close?: boolean } {
  const player = room.players.find((item) => item.id === playerId);
  if (!player) return { room, error: "Not in this room." };

  if (message.type === "leave") {
    const players = room.players.filter((item) => item.id !== playerId);
    if (!players.length) return { room: { ...room, players }, close: true };
    const next = { ...room, players };
    if (next.phase !== "lobby") {
      next.phase = "ended";
      next.message = "A player left. Return to the lobby to start a new game.";
    }
    return { room: next };
  }

  if (message.type === "start") {
    if (room.players[0]?.id !== playerId || !["lobby", "ended"].includes(room.phase)) return { room };
    if (room.players.length < 2) return { room, error: "At least two players are required." };
    const players = room.players.map((item) => ({ ...item, score: 0 }));
    const started: RoomState = {
      ...room,
      players,
      round: 0,
      chat: [],
      answers: [],
      question: null,
      word: null,
    };
    if (room.mode === "multiplayer-ludo") {
      started.ludo = createLudo(room.players.length);
      started.phase = "playing";
      started.deadline = 0;
      started.message = "Player 1 rolls.";
      return { room: started };
    }
    started.rounds = room.mode === "draw-guess" ? room.players.length * 2 : 10;
    started.questions = [...QUESTIONS.general, ...QUESTIONS.sports, ...QUESTIONS.movies]
      .map((q) => ({ q, key: Math.random() }))
      .sort((a, b) => a.key - b.key)
      .slice(0, 10)
      .map((item) => item.q);
    return { room: nextRound(started) };
  }

  if (room.phase !== "playing") return { room };

  if (room.mode === "multiplayer-ludo" && room.ludo) {
    if (room.players[room.ludo.turn]?.id !== playerId) return { room };
    let ludo = room.ludo;
    if (message.type === "roll") ludo = rollLudo(ludo, randomInt(1, 7));
    if (message.type === "move" && Number.isInteger(message.index)) ludo = moveLudo(ludo, Number(message.index));
    const next = { ...room, ludo, message: ludo.message };
    if (ludo.winner !== null) {
      next.phase = "ended";
      next.players = next.players.map((item, index) => (index === ludo.winner ? { ...item, score: 1000 } : item));
    }
    return { room: next };
  }

  if (Date.now() > room.deadline) return { room };

  if (room.mode === "draw-guess") {
    const drawer = room.players[room.round % room.players.length];
    if (message.type === "stroke" && playerId === drawer?.id && room.strokes.length < 5000) {
      const line = message.line;
      if (
        !Array.isArray(line) ||
        line.length !== 4 ||
        !line.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1)
      ) {
        return { room };
      }
      const colors = ["#f1f5f9", "#61d6b0", "#43c7e8", "#d5aa50", "#f16f78"];
      const stroke = {
        type: "stroke",
        line,
        color: colors.includes(String(message.color)) ? message.color : "#f1f5f9",
      };
      return { room: { ...room, strokes: [...room.strokes, stroke] }, extra: stroke };
    }
    if (message.type === "clear" && playerId === drawer?.id) {
      return { room: { ...room, strokes: [] }, extra: { type: "clear" } };
    }
    if (message.type === "guess" && playerId !== drawer?.id && !room.answers.includes(playerId) && typeof message.text === "string") {
      const text = message.text.trim().slice(0, 80);
      if (!text) return { room };
      const players = room.players.map((item) => ({ ...item }));
      const chat = [...room.chat];
      const answers = [...room.answers];
      if (text.toUpperCase() === room.word) {
        answers.push(playerId);
        const guesser = players.find((item) => item.id === playerId);
        const host = players.find((item) => item.id === drawer.id);
        if (guesser) guesser.score += 100;
        if (host) host.score += 50;
        chat.push(`${player.name} guessed correctly!`);
      } else chat.push(`${player.name}: ${text}`);
      const next = { ...room, players, chat: chat.slice(-20), answers };
      if (answers.length >= room.players.length - 1) return { room: reveal(next) };
      return { room: next };
    }
    return { room };
  }

  if (
    message.type === "answer" &&
    Number.isInteger(message.answer) &&
    Number(message.answer) >= 0 &&
    Number(message.answer) < 4 &&
    !room.answers.includes(playerId) &&
    message.round === room.round
  ) {
    const answers = [...room.answers, playerId];
    const players = room.players.map((item) => ({ ...item }));
    if (Array.isArray(room.question) && message.answer === room.question[2]) {
      const self = players.find((item) => item.id === playerId);
      if (self) self.score += 100;
    }
    const next = { ...room, answers, players };
    if (answers.length === room.players.length) return { room: reveal(next) };
    return { room: next };
  }

  return { room };
}
