import assert from "node:assert/strict";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { attachRooms } from "../server/rooms.mjs";
const server = createServer();
const engine = attachRooms(server);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `ws://127.0.0.1:${server.address().port}/rooms`;
const clients = [];
async function client() {
  const ws = new WebSocket(url);
  clients.push(ws);
  ws.messages = [];
  ws.on("message", (data) => ws.messages.push(JSON.parse(data)));
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return ws;
}
const send = (ws, data) => ws.send(JSON.stringify(data));
async function wait(ws, predicate) {
  const end = Date.now() + 4000;
  while (Date.now() < end) {
    const index = ws.messages.findIndex(predicate);
    if (index >= 0) return ws.messages.splice(index, 1)[0];
    await new Promise((r) => setTimeout(r, 10));
  }
  throw Error("Timed out waiting for room message");
}
try {
  for (const mode of [
    "live-trivia",
    "trivia-battle",
    "draw-guess",
    "multiplayer-ludo",
  ]) {
    const a = await client(),
      b = await client();
    send(a, { type: "create", mode, name: "Alice", team: "Blue" });
    const lobby = await wait(a, (m) => m.type === "state");
    send(b, {
      type: "join",
      mode,
      name: "Bob",
      code: lobby.code,
      team: "Gold",
    });
    await wait(a, (m) => m.players?.length === 2);
    await wait(b, (m) => m.players?.length === 2);
    send(b, { type: "start" });
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(engine.rooms.get(lobby.code).phase, "lobby");
    send(a, { type: "start" });
    const started = await wait(a, (m) => m.phase === "playing");
    await wait(b, (m) => m.phase === "playing");
    const room = engine.rooms.get(lobby.code);
    if (mode === "multiplayer-ludo") {
      const before = JSON.stringify(room.ludo);
      send(b, { type: "roll" });
      await new Promise((r) => setTimeout(r, 30));
      assert.equal(JSON.stringify(room.ludo), before);
      send(a, { type: "roll" });
      await wait(a, (m) => m.ludo?.message?.includes("rolled"));
    } else if (mode === "draw-guess") {
      assert.ok(started.word);
      const opponent = await (async () => {
        send(b, { type: "guess", text: "WRONG" });
        return wait(b, (m) => m.chat?.length > 0);
      })();
      assert.equal(opponent.word, null);
      send(a, { type: "stroke", line: [0.1, 0.2, 0.3, 0.4], color: "#61d6b0" });
      assert.equal(
        (await wait(b, (m) => m.type === "stroke")).color,
        "#61d6b0",
      );
      send(b, { type: "guess", text: room.word });
      const result = await wait(b, (m) => m.phase === "reveal");
      assert.equal(result.players.find((p) => p.name === "Bob").score, 100);
    } else {
      assert.equal(started.correct, null);
      assert.equal(started.question.length, 2);
      const answer = room.question[2];
      send(a, { type: "answer", round: 0, answer });
      await wait(a, (m) => m.answered);
      send(a, { type: "answer", round: 0, answer });
      send(b, { type: "answer", round: 0, answer });
      const result = await wait(b, (m) => m.phase === "reveal");
      assert.ok(result.players.every((p) => p.score === 100));
    }
    a.close();
    await wait(b, (m) => m.phase === "ended");
    b.close();
  }
  console.log(
    "PASS: four room modes, create/join, host authorization, turn authorization, secret-word privacy, drawing relay, correct guesses, server quiz scoring, duplicate-answer protection, disconnect handling.",
  );
} finally {
  clients.forEach((ws) => ws.terminate());
  engine.close();
  await new Promise((r) => server.close(r));
}
