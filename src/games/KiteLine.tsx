import { useEffect, useRef, useState } from "react";
import type { GameAPI } from "./types";

export function KiteLine({ api, paused }: { api: GameAPI; paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState({ score: 0, time: 45, stability: 100 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let y = 0.5;
    let holding = false;
    let t = 0;
    let score = 0;
    let stability = 100;
    let remaining = 45;
    let raf = 0;
    const onDown = () => {
      holding = true;
    };
    const onUp = () => {
      holding = false;
    };
    const key = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        holding = event.type === "keydown";
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    const loop = () => {
      if (!paused) {
        t += 0.016;
        remaining -= 0.016;
        y += holding ? -0.011 : 0.008;
        y = Math.min(0.9, Math.max(0.1, y));
        const corridor = 0.5 + Math.sin(t * 1.4) * 0.18;
        const inside = Math.abs(y - corridor) < 0.16;
        stability += inside ? 0.25 : -0.9;
        stability = Math.max(0, Math.min(100, stability));
        if (inside) score += 2;
        setStats({ score: Math.floor(score), time: Math.max(0, remaining), stability: Math.round(stability) });
        if (stability <= 0) {
          if (api.onContinue()) {
            stability = 55;
          } else {
            api.onFinish({ score: Math.floor(score), stars: score > 400 ? 3 : score > 180 ? 2 : 1, metric: `${Math.floor(score)} distance` });
            return;
          }
        }
        if (remaining <= 0) {
          api.onFinish({ score: Math.floor(score), stars: score > 400 ? 3 : score > 180 ? 2 : 1, metric: `${Math.floor(score)} distance` });
          return;
        }
      }
      canvas.width = Math.max(2, canvas.clientWidth * 2);
      canvas.height = Math.max(2, canvas.clientHeight * 2);
      ctx.fillStyle = "#05050a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const corridor = 0.5 + Math.sin(t * 1.4) * 0.18;
      ctx.fillStyle = "rgba(255,79,154,0.22)";
      ctx.fillRect(0, (corridor - 0.16) * canvas.height,  canvas.width, 0.32 * canvas.height);
      ctx.fillStyle = "#60a5fa";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.3, y * canvas.height, 18, 0, Math.PI * 2);
      ctx.fill();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
    };
  }, [api, paused]);

  return (
    <>
      <canvas ref={canvasRef} className="board" aria-label="Kite Line playfield" />
      <div className="hud-stats">
        <span className="stat">Score {stats.score}</span>
        <span className="stat">Time {Math.ceil(stats.time)}s</span>
        <span className="stat">Stability {stats.stability}</span>
        <span className="stat">Continues {api.continues}</span>
      </div>
    </>
  );
}
