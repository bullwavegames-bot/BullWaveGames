import { useEffect, useState } from "react";
import type { GameAPI } from "./types";

export function PaperGharial({ api, paused }: { api: GameAPI; paused: boolean }) {
  const [pos, setPos] = useState({ x: 0, y: 2 });
  const [aware, setAware] = useState(0);
  const [stars, setStars] = useState(0);
  const [look, setLook] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!paused) setLook((value) => (value + 1) % 4);
    }, 900);
    return () => window.clearInterval(timer);
  }, [paused]);

  const move = (dx: number, dy: number) => {
    if (paused) return;
    const next = { x: Math.min(5, Math.max(0, pos.x + dx)), y: Math.min(4, Math.max(0, pos.y + dy)) };
    const reedFacing = look === 0 && next.x === 2;
    const nextAware = Math.min(100, aware + (reedFacing ? 34 : -4));
    setPos(next);
    setAware(Math.max(0, nextAware));
    if (next.x === 3 && next.y === 1) setStars(1);
    if (nextAware >= 100) {
      if (api.onContinue()) setAware(40);
      else api.onFinish({ score: next.x * 20, stars: 0, metric: "Disturbed the river" });
    }
    if (next.x === 5 && next.y === 2) {
      api.onFinish({ score: 200 + stars * 50 - aware, stars: stars ? 3 : 2, metric: "Route complete" });
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };
      const delta = map[event.key];
      if (delta) {
        event.preventDefault();
        move(delta[0], delta[1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="board" style={{ padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, minHeight: 280 }}>
        {Array.from({ length: 30 }, (_, index) => {
          const x = index % 6;
          const y = Math.floor(index / 6);
          const here = pos.x === x && pos.y === y;
          const reed = x === 2;
          const bank = x === 5 && y === 2;
          return (
            <div
              key={index}
              style={{
                borderRadius: 10,
                minHeight: 44,
                background: here ? "#d5aa50" : bank ? "#61d6b0" : reed ? "#151f2d" : "#1d2b3a",
              }}
            />
          );
        })}
      </div>
      <div className="filters" aria-label="Move">
        <button className="chip-btn" onClick={() => move(0, -1)}>
          Up
        </button>
        <button className="chip-btn" onClick={() => move(-1, 0)}>
          Left
        </button>
        <button className="chip-btn" onClick={() => move(1, 0)}>
          Right
        </button>
        <button className="chip-btn" onClick={() => move(0, 1)}>
          Down
        </button>
      </div>
      <div className="hud-stats">
        <span className="stat">Progress {pos.x}/5</span>
        <span className="stat">Awareness {aware}</span>
        <span className="stat">Stars {stars}</span>
      </div>
    </div>
  );
}
