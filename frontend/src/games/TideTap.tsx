import { useEffect, useRef, useState } from "react";
import type { GameAPI } from "./types";

const WAVE_COUNT = 12;
const TARGET = 0.72;

export function TideTap({ api, paused }: { api: GameAPI; paused: boolean }) {
  const ringRef = useRef<HTMLSpanElement>(null);
  const radiusRef = useRef(0.15);
  const pausedRef = useRef(paused);
  const apiRef = useRef(api);
  const statsRef = useRef({ score: 0, hits: 0, misses: 0, streak: 0, bestStreak: 0, waves: 0 });
  const finishedRef = useRef(false);
  const readyAnnouncedRef = useRef(false);
  const [stats, setStats] = useState(statsRef.current);
  const [judgement, setJudgement] = useState("Watch the wave approach the gold horizon.");

  pausedRef.current = paused;
  apiRef.current = api;

  const finish = (next = statsRef.current) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const accuracy = next.waves ? next.hits / next.waves : 0;
    apiRef.current.onFinish({
      score: next.score,
      stars: accuracy >= 0.85 ? 3 : accuracy >= 0.55 ? 2 : 1,
      metric: `${Math.round(accuracy * 100)}% accuracy · best streak ${next.bestStreak}`,
    });
  };

  const completeWave = (hit: boolean, points = 0) => {
    const current = statsRef.current;
    const streak = hit ? current.streak + 1 : 0;
    const next = {
      score: current.score + points,
      hits: current.hits + (hit ? 1 : 0),
      misses: current.misses + (hit ? 0 : 1),
      streak,
      bestStreak: Math.max(current.bestStreak, streak),
      waves: current.waves + 1,
    };
    statsRef.current = next;
    setStats(next);
    radiusRef.current = 0.15;
    readyAnnouncedRef.current = false;
    if (next.waves >= WAVE_COUNT) finish(next);
  };

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      if (!pausedRef.current && !finishedRef.current) {
        radiusRef.current += dt * (apiRef.current.reduced ? 0.42 : 0.56);
        const ring = ringRef.current;
        if (ring) ring.style.transform = `scale(${radiusRef.current})`;
        if (Math.abs(radiusRef.current - TARGET) < 0.08 && !readyAnnouncedRef.current) {
          readyAnnouncedRef.current = true;
          setJudgement("Tap now.");
        }
        if (radiusRef.current > 1.05) {
          setJudgement("Miss — follow the next wave.");
          completeWave(false);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const tap = () => {
    if (paused || finishedRef.current) return;
    const delta = Math.abs(radiusRef.current - TARGET);
    if (delta < 0.045) {
      const points = 20 + (statsRef.current.streak + 1) * 2;
      setJudgement("Perfect!");
      completeWave(true, points);
    } else if (delta < 0.1) {
      const points = 10 + statsRef.current.streak + 1;
      setJudgement("Good timing.");
      completeWave(true, points);
    } else {
      setJudgement("Miss — wait for the rings to meet.");
      completeWave(false);
    }
  };

  const accuracy = stats.waves ? Math.round((stats.hits / stats.waves) * 100) : 100;

  return (
    <section className="board original-game tide-game" aria-label="Tide Tap">
      <p className="game-status" aria-live="polite">{judgement}</p>
      <button className="tide-target" onClick={tap} disabled={paused} aria-label="Tap when the purple wave meets the gold horizon">
        <span className="tide-horizon" aria-hidden="true" />
        <span ref={ringRef} className="tide-wave" aria-hidden="true" />
        <span className="tide-center" aria-hidden="true">Tap</span>
      </button>
      <div className="hud-stats" aria-label="Current run">
        <span className="stat">Score {stats.score}</span>
        <span className="stat">Accuracy {accuracy}%</span>
        <span className="stat">Streak {stats.streak}</span>
        <span className="stat">Wave {Math.min(stats.waves + 1, WAVE_COUNT)}/{WAVE_COUNT}</span>
      </div>
    </section>
  );
}
