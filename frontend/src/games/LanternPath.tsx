import { useCallback, useEffect, useRef, useState } from "react";
import type { GameAPI } from "./types";

const NODES = [
  [50, 10], [18, 27], [82, 27], [50, 44], [18, 61], [82, 61], [50, 78],
] as const;

export function lanternsAreAdjacent(a: number, b: number) {
  const [x1, y1] = NODES[a];
  const [x2, y2] = NODES[b];
  return Math.abs(x1 - x2) <= 32 && Math.abs(y1 - y2) <= 18;
}

export function LanternPath({ api, paused }: { api: GameAPI; paused: boolean }) {
  const [path, setPath] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState("Choose any lantern to begin.");
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [paused]);

  const restart = useCallback(() => {
    setPath([]);
    setMoves(0);
    setMistakes(0);
    setElapsed(0);
    startedAt.current = Date.now();
    setStatus("Path cleared. Choose any lantern.");
  }, []);

  const extend = useCallback((index: number) => {
    if (paused) return;
    setPath((current) => {
      if (current.includes(index)) {
        setMistakes((value) => value + 1);
        setStatus("That lantern is already lit.");
        return current;
      }
      if (current.length && !lanternsAreAdjacent(current[current.length - 1], index)) {
        setMistakes((value) => value + 1);
        setStatus("Choose a connected lantern.");
        return current;
      }
      const next = [...current, index];
      setMoves((value) => value + 1);
      setStatus(`Lantern ${index + 1} lit. ${NODES.length - next.length} remaining.`);
      if (next.length === NODES.length) {
        const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
        const stars = mistakes === 0 && seconds <= 18 ? 3 : mistakes <= 2 && seconds <= 35 ? 2 : 1;
        api.onFinish({ score: Math.max(80, 500 - seconds * 5 - mistakes * 25), stars, metric: `${seconds}s · ${mistakes} mistakes` });
      }
      return next;
    });
  }, [api, mistakes, paused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (paused) return;
      if (event.key.toLowerCase() === "r") { event.preventDefault(); restart(); return; }
      if (event.key === "Backspace") {
        event.preventDefault();
        setPath((current) => current.slice(0, -1));
        setStatus("Last lantern removed.");
        return;
      }
      const directions: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      if (!path.length) { extend(0); return; }
      const [x, y] = NODES[path[path.length - 1]];
      const candidate = NODES.map(([nx, ny], index) => ({ index, dx: nx - x, dy: ny - y }))
        .filter(({ index, dx, dy }) => !path.includes(index) && lanternsAreAdjacent(path[path.length - 1], index) && dx * direction[0] + dy * direction[1] > 0)
        .sort((a, b) => (b.dx * direction[0] + b.dy * direction[1]) - (a.dx * direction[0] + a.dy * direction[1]))[0];
      if (candidate) extend(candidate.index);
      else setStatus("No unlit lantern in that direction.");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [extend, path, paused, restart]);

  return (
    <section className="board original-game lantern-game" aria-label="Lantern Path">
      <p className="game-status" aria-live="polite">{status}</p>
      <div className="lantern-map">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          {path.slice(1).map((node, index) => {
            const from = NODES[path[index]], to = NODES[node];
            return <line key={`${path[index]}-${node}`} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />;
          })}
        </svg>
        {NODES.map(([x, y], index) => (
          <button key={index} className={`lantern-node ${path.includes(index) ? "lit" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => extend(index)} disabled={paused} aria-label={`Lantern ${index + 1}${path.includes(index) ? ", lit" : ", unlit"}`} />
        ))}
      </div>
      <div className="original-actions">
        <button className="btn btn-secondary" onClick={() => { setPath((current) => current.slice(0, -1)); setStatus("Last lantern removed."); }} disabled={paused || !path.length}>Undo</button>
        <button className="btn btn-ghost" onClick={restart} disabled={paused}>Restart puzzle</button>
      </div>
      <div className="hud-stats"><span className="stat">Lit {path.length}/{NODES.length}</span><span className="stat">Moves {moves}</span><span className="stat">Mistakes {mistakes}</span><span className="stat">Time {elapsed}s</span></div>
    </section>
  );
}
