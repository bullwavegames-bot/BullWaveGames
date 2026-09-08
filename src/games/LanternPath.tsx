import { useState } from "react";
import type { GameAPI } from "./types";

const NODES = [
  [1, 0],
  [0, 1],
  [2, 1],
  [1, 2],
  [0, 3],
  [2, 3],
  [1, 4],
];

export function LanternPath({ api, paused }: { api: GameAPI; paused: boolean }) {
  const [path, setPath] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [t0] = useState(() => Date.now());
  const adjacent = (a: number, b: number) => {
    const [x1, y1] = NODES[a];
    const [x2, y2] = NODES[b];
    return Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1 || (Math.abs(x1 - x2) === 1 && Math.abs(y1 - y2) === 1);
  };
  const tap = (index: number) => {
    if (paused) return;
    if (path.includes(index)) return;
    if (path.length && !adjacent(path[path.length - 1], index)) return;
    const next = [...path, index];
    setPath(next);
    setMoves((value) => value + 1);
    if (next.length === NODES.length) {
      const seconds = Math.round((Date.now() - t0) / 1000);
      api.onFinish({
        score: Math.max(50, 400 - moves * 8 - seconds),
        stars: moves <= 8 ? 3 : moves <= 12 ? 2 : 1,
        metric: `${moves + 1} moves · ${seconds}s`,
      });
    }
  };
  return (
    <div className="board" style={{ position: "relative", minHeight: 420 }}>
      {NODES.map(([x, y], index) => (
        <button
          key={index}
          onClick={() => tap(index)}
          style={{
            position: "absolute",
            left: `${18 + x * 32}%`,
            top: `${10 + y * 16}%`,
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "0",
            background: path.includes(index) ? "#ff4f9a" : "#1b2433",
            color: "#05050a",
            cursor: "pointer",
          }}
          aria-label={`Lantern ${index + 1}`}
        />
      ))}
      <div className="hud-stats">
        <span className="stat">Lit {path.length}/{NODES.length}</span>
        <span className="stat">Moves {moves}</span>
        <span className="stat">Continues {api.continues}</span>
        <button className="btn btn-ghost" onClick={() => setPath([])}>
          Restart puzzle
        </button>
      </div>
    </div>
  );
}
