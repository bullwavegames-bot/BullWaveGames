import { useEffect, useRef, type ReactNode } from "react";
import type { GameAPI } from "../types";
export type Props = { api: GameAPI; paused: boolean };
export const random = (n: number) => Math.floor(Math.random() * n);
export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function useTick(callback: () => void, ms: number, paused: boolean) {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => ref.current(), ms);
    return () => clearInterval(timer);
  }, [ms, paused]);
}
export function GameFrame({
  title,
  status,
  children,
  paused,
  className = "",
}: {
  title: string;
  status?: ReactNode;
  children: ReactNode;
  paused: boolean;
  className?: string;
}) {
  return (
    <section className={`collection-game ${className}`.trim()} aria-label={title}>
      <div className="collection-status" aria-live="polite">
        {status}
      </div>
      <fieldset disabled={paused} className="game-controls">
        {children}
      </fieldset>
    </section>
  );
}
export function finish(
  api: GameAPI,
  score: number,
  won: boolean,
  metric: string,
) {
  api.onFinish({
    score: Math.max(0, Math.round(score)),
    stars: won ? 3 : score > 0 ? 1 : 0,
    metric,
  });
}
export const directions = [
  ["↑", 0, -1],
  ["←", -1, 0],
  ["↓", 0, 1],
  ["→", 1, 0],
] as const;
export function DirectionPad({
  move,
}: {
  move: (x: number, y: number) => void;
}) {
  return (
    <div className="direction-pad">
      {directions.map(([label, x, y]) => (
        <button
          key={label}
          className="btn btn-secondary"
          aria-label={
            { "↑": "Up", "↓": "Down", "←": "Left", "→": "Right" }[label]
          }
          onClick={() => move(x, y)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
