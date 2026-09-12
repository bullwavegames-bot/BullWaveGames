import { useEffect, useRef, useState } from "react";
import type { LudoState } from "../../../shared/ludo.mjs";
import { LudoBoard } from "./Ludo";
import { GameFrame, type Props } from "./common";
type Player = { id: string; name: string; score: number; team: string };
type Room = {
  code: string;
  mode: string;
  phase: string;
  you: string;
  host: string;
  players: Player[];
  round: number;
  rounds: number;
  deadline: number;
  now: number;
  message: string;
  ludo?: LudoState;
  drawer: string;
  word: string | null;
  wordLength: number;
  question: [string, string[]] | null;
  correct: number | null;
  answered: boolean;
  chat: string[];
};
export function RoomGame({ api }: Props) {
  const socket = useRef<WebSocket | null>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    last = useRef<[number, number] | null>(null),
    strokes = useRef<{ line: number[]; color: string }[]>([]);
  const [room, setRoom] = useState<Room | null>(null),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [team, setTeam] = useState("Solo"),
    [error, setError] = useState(""),
    [online, setOnline] = useState(false),
    [guess, setGuess] = useState(""),
    [color, setColor] = useState("#f1f5f9"),
    [time, setTime] = useState(0),
    [retry, setRetry] = useState(0);
  const roomRef = useRef(room);
  roomRef.current = room;
  const paint = (stroke: { line: number[]; color: string }) => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.line[0] * 640, stroke.line[1] * 400);
    ctx.lineTo(stroke.line[2] * 640, stroke.line[3] * 400);
    ctx.stroke();
  };
  useEffect(() => {
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/rooms`,
    );
    socket.current = ws;
    ws.onopen = () => {
      setOnline(true);
      setError("");
    };
    ws.onclose = () => {
      setOnline(false);
      setRoom(null);
      setError("Disconnected. Reconnect, then create or join a new room.");
    };
    ws.onerror = () =>
      setError(
        "Room server unavailable. Run the website with its local dev or preview server.",
      );
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "state") {
        setRoom(m);
        roomRef.current = m;
        setTime(Math.max(0, Math.ceil((m.deadline - m.now) / 1000)));
        setError("");
      }
      if (m.type === "error") setError(m.message);
      if (m.type === "stroke") {
        strokes.current.push(m);
        paint(m);
      }
      if (m.type === "clear") {
        strokes.current = [];
        canvas.current?.getContext("2d")?.clearRect(0, 0, 640, 400);
      }
    };
    return () => {
      ws.onclose = null;
      ws.close();
    };
  }, [retry]);
  useEffect(() => {
    const id = setInterval(() => setTime((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (canvas.current) {
      canvas.current.getContext("2d")?.clearRect(0, 0, 640, 400);
      strokes.current.forEach(paint);
    }
  }, [room?.code, room?.phase]);
  const send = (data: object) => {
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(JSON.stringify(data));
    else setError("Not connected to the room server.");
  };
  const drawer = room?.you === room?.drawer;
  const coordinate = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    ];
  };
  return (
    <GameFrame
      title="Multiplayer room"
      paused={false}
      status={
        room
          ? `Room ${room.code} · ${room.phase} ${room.deadline ? `· ${time}s` : ""}`
          : online
            ? "Connected · Invite friends using a room code"
            : "Connecting to room server…"
      }
    >
      <p className="meta">
        Live room play continues for everyone; it cannot be paused. Rooms and
        scores last until the server restarts. Friends must open the same hosted
        or LAN server.
      </p>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {!online && (
        <button
          className="btn btn-secondary"
          onClick={() => setRetry((n) => n + 1)}
        >
          Reconnect
        </button>
      )}
      {!room ? (
        <div className="room-lobby">
          <label>
            Your name
            <input
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {api.slug === "trivia-battle" && (
            <label>
              Scoring team
              <select value={team} onChange={(e) => setTeam(e.target.value)}>
                <option>Solo</option>
                <option>Blue</option>
                <option>Gold</option>
              </select>
            </label>
          )}
          <button
            className="btn btn-primary"
            disabled={!online || !name.trim()}
            onClick={() => send({ type: "create", mode: api.slug, name, team })}
          >
            Create room
          </button>
          <label>
            Room code
            <input
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          <button
            className="btn btn-secondary"
            disabled={!online || !name.trim() || code.length !== 6}
            onClick={() =>
              send({ type: "join", mode: api.slug, name, code, team })
            }
          >
            Join room
          </button>
        </div>
      ) : (
        <>
          <div className="room-players">
            {[...room.players]
              .sort((a, b) => b.score - a.score)
              .map((p) => (
                <div key={p.id} className="stat">
                  <strong>
                    {p.name}
                    {p.id === room.you ? " (you)" : ""}
                  </strong>
                  <span>
                    {p.score} points{p.team !== "Solo" ? ` · ${p.team}` : ""}
                  </span>
                </div>
              ))}
          </div>
          {api.slug === "trivia-battle" && (
            <p className="meta">
              Blue team:{" "}
              {room.players
                .filter((p) => p.team === "Blue")
                .reduce((n, p) => n + p.score, 0)}{" "}
              · Gold team:{" "}
              {room.players
                .filter((p) => p.team === "Gold")
                .reduce((n, p) => n + p.score, 0)}
            </p>
          )}
          <p aria-live="polite">{room.message}</p>
          {["lobby", "ended"].includes(room.phase) && (
            <>
              {room.you === room.host ? (
                <button
                  className="btn btn-primary"
                  disabled={room.players.length < 2}
                  onClick={() => send({ type: "start" })}
                >
                  {room.phase === "ended" ? "Play again" : "Start game"}
                </button>
              ) : (
                <p>Waiting for the host to start.</p>
              )}
              <p className="meta">
                Share code <strong>{room.code}</strong>. {room.players.length}/{" "}
                {api.slug === "multiplayer-ludo" ? 4 : 12} players.
              </p>
            </>
          )}
          {room.ludo &&
            api.slug === "multiplayer-ludo" &&
            room.phase !== "lobby" && (
              <LudoBoard
                state={room.ludo}
                player={room.players.findIndex((p) => p.id === room.you)}
                disabled={room.phase !== "playing"}
                roll={() => send({ type: "roll" })}
                move={(index) => send({ type: "move", index })}
              />
            )}
          {room.question && ["playing", "reveal"].includes(room.phase) && (
            <>
              <p>
                Question {room.round + 1}/{room.rounds}
              </p>
              <h2 className="quiz-question">{room.question[0]}</h2>
              <div className="quiz-options">
                {room.question[1].map((text, i) => (
                  <button
                    key={text}
                    className={`quiz-option ${room.correct === i ? "correct-answer" : ""}`}
                    disabled={room.answered || room.phase !== "playing"}
                    onClick={() =>
                      send({ type: "answer", answer: i, round: room.round })
                    }
                  >
                    {text}
                  </button>
                ))}
              </div>
              {room.answered && (
                <p>Answer submitted. Waiting for the round to finish.</p>
              )}
            </>
          )}
          {api.slug === "draw-guess" &&
            ["playing", "reveal"].includes(room.phase) && (
              <>
                <h2>
                  {drawer
                    ? `Draw: ${room.word}`
                    : room.word
                      ? `Answer: ${room.word}`
                      : `Guess the ${room.wordLength}-letter word`}
                </h2>
                <canvas
                  ref={canvas}
                  width="640"
                  height="400"
                  className="drawing-canvas"
                  style={{ touchAction: "none" }}
                  aria-label="Shared drawing canvas"
                  onPointerDown={(e) => {
                    if (!drawer || room.phase !== "playing") return;
                    last.current = coordinate(e);
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!last.current || !drawer || room.phase !== "playing")
                      return;
                    const to = coordinate(e);
                    send({
                      type: "stroke",
                      line: [...last.current, ...to],
                      color,
                    });
                    last.current = to;
                  }}
                  onPointerUp={() => (last.current = null)}
                  onPointerCancel={() => (last.current = null)}
                />
                {drawer ? (
                  <div className="actions">
                    {[
                      "#f1f5f9",
                      "#61d6b0",
                      "#43c7e8",
                      "#d5aa50",
                      "#f16f78",
                    ].map((c) => (
                      <button
                        className="btn btn-secondary"
                        style={{ color: c }}
                        aria-pressed={color === c}
                        key={c}
                        onClick={() => setColor(c)}
                      >
                        ●
                      </button>
                    ))}
                    <button
                      className="btn btn-secondary"
                      onClick={() => send({ type: "clear" })}
                    >
                      Clear drawing
                    </button>
                  </div>
                ) : (
                  <form
                    className="game-input-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send({ type: "guess", text: guess });
                      setGuess("");
                    }}
                  >
                    <label>
                      Your guess
                      <input
                        value={guess}
                        maxLength={80}
                        disabled={room.answered || room.phase !== "playing"}
                        onChange={(e) => setGuess(e.target.value)}
                      />
                    </label>
                    <button
                      className="btn btn-primary"
                      disabled={room.answered || room.phase !== "playing"}
                    >
                      Guess
                    </button>
                  </form>
                )}
                <div className="room-chat" aria-live="polite">
                  {room.chat.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </>
            )}
          <button
            className="btn btn-secondary"
            onClick={() => {
              send({ type: "leave" });
              setRoom(null);
              strokes.current = [];
            }}
          >
            Leave room
          </button>
        </>
      )}
    </GameFrame>
  );
}
