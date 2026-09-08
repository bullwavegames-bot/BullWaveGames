import { useEffect, useState } from "react";
import type { GameAPI } from "./types";

export function TideTap({ api, paused }: { api: GameAPI; paused: boolean }) {
  const [radius, setRadius] = useState(0.2);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    let r = 0.15;
    const tick = () => {
      if (!paused) {
        r += 0.008;
        if (r > 1.05) {
          r = 0.15;
          setStreak(0);
        }
        setRadius(r);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  const tap = () => {
    if (paused) return;
    const delta = Math.abs(radius - 0.72);
    if (delta < 0.08) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBestStreak((value) => Math.max(value, nextStreak));
      setHits((value) => value + 1);
      setScore((value) => value + 10 + nextStreak);
      setProgress((value) => {
        const next = value + 1;
        if (next >= 12) {
          api.onFinish({
            score: score + 10 + nextStreak,
            stars: nextStreak >= 6 ? 3 : 2,
            metric: `Accuracy visual · streak ${Math.max(bestStreak, nextStreak)}`,
          });
        }
        return next;
      });
      setRadius(0.15);
    } else {
      setStreak(0);
    }
  };

  return (
    <div className="board" style={{ display: "grid", placeItems: "center", minHeight: 420 }} onPointerDown={tap}>
      <button
        className="btn btn-ghost"
        onKeyDown={(event) => {
          if (event.code === "Space") {
            event.preventDefault();
            tap();
          }
        }}
        style={{
          width: 220,
          height: 220,
          borderRadius: "50%",
          border: "2px solid #43c7e8",
          position: "relative",
        }}
        aria-label="Tap when the ring meets the horizon"
      >
        <span
          style={{
            position: "absolute",
            inset: `${(1 - radius) * 42}%`,
            border: "2px solid #a66acb",
            borderRadius: "50%",
          }}
        />
      </button>
      <div className="hud-stats">
        <span className="stat">Score {score}</span>
        <span className="stat">Accuracy {hits}</span>
        <span className="stat">Streak {streak}</span>
        <span className="stat">Track {progress}/12</span>
      </div>
    </div>
  );
}
