import { useEffect, useRef, useState } from "react";
import type { GameAPI } from "./types";

const LOOKS = ["↑", "→", "↓", "←"];

export function PaperGharial({ api, paused }: { api: GameAPI; paused: boolean }) {
  const [pos, setPos] = useState({ x: 0, y: 2 });
  const [aware, setAware] = useState(0);
  const [collected, setCollected] = useState(false);
  const [look, setLook] = useState(0);
  const [status, setStatus] = useState("Reach the moonlit bank. Cross the reeds when they look away.");
  const stateRef = useRef({ pos, aware, collected, look, paused, api });
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  stateRef.current = { pos, aware, collected, look, paused, api };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!stateRef.current.paused) setLook((value) => (value + 1) % 4);
    }, api.reduced ? 1300 : 900);
    return () => window.clearInterval(timer);
  }, [api.reduced]);

  const move = (dx: number, dy: number) => {
    const current = stateRef.current;
    if (current.paused) return;
    const next = { x: Math.min(5, Math.max(0, current.pos.x + dx)), y: Math.min(4, Math.max(0, current.pos.y + dy)) };
    if (next.x === current.pos.x && next.y === current.pos.y) { setStatus("The river edge blocks that move."); return; }
    const watched = current.look === 0 && next.x === 2;
    const nextAware = Math.max(0, Math.min(100, current.aware + (watched ? 34 : -4)));
    const foundStar = current.collected || (next.x === 3 && next.y === 1);
    setPos(next);
    setAware(nextAware);
    if (foundStar && !current.collected) { setCollected(true); setStatus("Moon star collected."); }
    else setStatus(watched ? "The reeds spotted you. Awareness rose." : "Quiet move.");
    if (nextAware >= 100) {
      if (current.api.onContinue()) { setAware(40); setStatus("Recovered downstream with 40% awareness."); }
      else current.api.onFinish({ score: next.x * 20, stars: 1, metric: "River disturbed" });
      return;
    }
    if (next.x === 5 && next.y === 2) {
      current.api.onFinish({ score: 200 + (foundStar ? 50 : 0) - nextAware, stars: foundStar ? 3 : 2, metric: foundStar ? "Bank reached · star found" : "Bank reached" });
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const map: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const delta = map[event.key];
      if (!delta) return;
      event.preventDefault();
      move(delta[0], delta[1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="board original-game gharial-game" aria-label="Paper Gharial">
      <p className="game-status" aria-live="polite">{status}</p>
      <p className="reed-status">Reeds are looking <strong>{["up", "right", "down", "left"][look]}</strong> <span aria-hidden="true">{LOOKS[look]}</span></p>
      <div className="river-grid" onPointerDown={(event) => { swipeStart.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={(event) => {
        const start = swipeStart.current; swipeStart.current = null; if (!start) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0); else move(0, dy > 0 ? 1 : -1);
      }}>
        {Array.from({ length: 30 }, (_, index) => {
          const x = index % 6, y = Math.floor(index / 6);
          const here = pos.x === x && pos.y === y, reed = x === 2, bank = x === 5 && y === 2, star = x === 3 && y === 1 && !collected;
          const label = here ? "Paper gharial" : bank ? "Moonlit bank, goal" : star ? "Moon star" : reed ? `Reeds looking ${["up", "right", "down", "left"][look]}` : "Open water";
          return <div key={index} className={`river-cell ${here ? "gharial" : ""} ${reed ? "reeds" : ""} ${bank ? "bank" : ""}`} aria-label={`Row ${y + 1}, column ${x + 1}: ${label}`}>{here ? "◇" : bank ? "◎" : star ? "✦" : reed ? LOOKS[look] : ""}</div>;
        })}
      </div>
      <div className="move-pad" aria-label="Move paper gharial"><button onClick={() => move(0, -1)} disabled={paused}>↑<span className="sr-only">Up</span></button><button onClick={() => move(-1, 0)} disabled={paused}>←<span className="sr-only">Left</span></button><button onClick={() => move(0, 1)} disabled={paused}>↓<span className="sr-only">Down</span></button><button onClick={() => move(1, 0)} disabled={paused}>→<span className="sr-only">Right</span></button></div>
      <div className="hud-stats"><span className="stat">Progress {pos.x}/5</span><span className="stat">Awareness {aware}%</span><span className="stat">Moon star {collected ? "found" : "not found"}</span></div>
    </section>
  );
}
