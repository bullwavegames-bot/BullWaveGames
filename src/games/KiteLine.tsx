import { useEffect, useRef, useState } from "react";
import type { GameAPI } from "./types";

export function KiteLine({ api, paused }: { api: GameAPI; paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef(api);
  const pausedRef = useRef(paused);
  const [stats, setStats] = useState({ score: 0, time: 45, stability: 100 });
  const [status, setStatus] = useState("Hold to climb. Release to descend.");

  apiRef.current = api;
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let y = 0.5, holding = false, t = 0, score = 0, stability = 100, remaining = 45;
    let frame = 0, previous = performance.now(), lastHud = 0;
    let finished = false;

    const release = () => { holding = false; };
    const press = (event: PointerEvent) => { holding = true; canvas.setPointerCapture?.(event.pointerId); };
    const key = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      holding = event.type === "keydown";
    };
    canvas.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);

    const end = () => {
      if (finished) return;
      finished = true;
      apiRef.current.onFinish({ score: Math.floor(score), stars: score > 400 ? 3 : score > 180 ? 2 : 1, metric: `${Math.floor(score)} distance` });
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      if (!pausedRef.current && !finished) {
        t += dt;
        remaining -= dt;
        y += (holding ? -0.68 : 0.5) * dt;
        y = Math.min(0.9, Math.max(0.1, y));
        const corridor = apiRef.current.reduced ? 0.5 : 0.5 + Math.sin(t * 1.4) * 0.18;
        const inside = Math.abs(y - corridor) < 0.16;
        stability += (inside ? 15 : -54) * dt;
        stability = Math.max(0, Math.min(100, stability));
        if (inside) score += 120 * dt;
        if (now - lastHud > 90) {
          setStats({ score: Math.floor(score), time: Math.max(0, remaining), stability: Math.round(stability) });
          setStatus(inside ? "Riding the wind corridor." : "Outside the corridor — recover stability.");
          lastHud = now;
        }
        if (stability <= 0) {
          if (apiRef.current.onContinue()) { stability = 55; setStatus("Kite recovered. Keep it in the corridor."); }
          else end();
        }
        if (remaining <= 0) end();
      }

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(2, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(2, Math.floor(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      ctx.fillStyle = "#0b121c";
      ctx.fillRect(0, 0, width, height);
      const corridor = apiRef.current.reduced ? 0.5 : 0.5 + Math.sin(t * 1.4) * 0.18;
      ctx.fillStyle = "rgba(166,106,203,0.28)";
      ctx.fillRect(0, (corridor - 0.16) * height, width, 0.32 * height);
      ctx.fillStyle = "#d5aa50";
      ctx.beginPath();
      ctx.moveTo(width * 0.3, y * height - 18);
      ctx.lineTo(width * 0.3 + 18, y * height);
      ctx.lineTo(width * 0.3, y * height + 18);
      ctx.lineTo(width * 0.3 - 18, y * height);
      ctx.closePath();
      ctx.fill();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
    };
  }, []);

  return (
    <section className="board original-game kite-game" aria-label="Kite Line">
      <p id="kite-status" className="game-status" aria-live="polite">{status}</p>
      <canvas ref={canvasRef} className="kite-canvas" aria-label="Kite and moving wind corridor" aria-describedby="kite-status" tabIndex={0} />
      <div className="hud-stats"><span className="stat">Score {stats.score}</span><span className="stat">Time {Math.ceil(stats.time)}s</span><span className="stat">Stability {stats.stability}%</span><span className="stat">Continues {api.continues}</span></div>
    </section>
  );
}
