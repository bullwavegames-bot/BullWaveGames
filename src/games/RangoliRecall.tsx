import { useEffect, useState } from "react";
import type { GameAPI } from "./types";

const SHAPES = ["circle", "diamond", "square", "petal"] as const;

export function RangoliRecall({ api, paused }: { api: GameAPI; paused: boolean }) {
  const [phase, setPhase] = useState<"study" | "rebuild">("study");
  const [round, setRound] = useState(1);
  const [pattern, setPattern] = useState<(typeof SHAPES)[number][]>(() => pick());
  const [guess, setGuess] = useState<Array<(typeof SHAPES)[number] | null>>([null, null, null, null]);
  const [selected, setSelected] = useState(0);
  const [attempts, setAttempts] = useState(3);
  const [correct, setCorrect] = useState(0);
  const [time, setTime] = useState(8);

  useEffect(() => {
    if (paused || phase !== "study") return;
    const timer = window.setInterval(() => {
      setTime((value) => {
        if (value <= 1) {
          setPhase("rebuild");
          return 12;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused, phase]);

  const place = (shape: (typeof SHAPES)[number]) => {
    if (phase !== "rebuild" || paused) return;
      const next: Array<(typeof SHAPES)[number] | null> = [...guess];
    next[selected] = shape;
    setGuess(next);
    if (next.every(Boolean)) {
      const ok = next.every((item, index) => item === pattern[index]);
      if (ok) {
        const nextRound = round + 1;
        setCorrect((value) => value + 4);
        if (nextRound > 3) {
          api.onFinish({ score: 300 + attempts * 20, stars: 3, metric: "3 rounds" });
          return;
        }
        setRound(nextRound);
        setPattern(pick());
        setGuess([null, null, null, null]);
        setPhase("study");
        setTime(8);
      } else {
        const left = attempts - 1;
        setAttempts(left);
        if (left <= 0) api.onFinish({ score: correct * 10, stars: 1, metric: "Pattern faded" });
        else setGuess([null, null, null, null]);
      }
    }
  };

  return (
    <div className="board" style={{ padding: 16 }}>
      <p>{phase === "study" ? "Remember shapes and positions." : "Rebuild the rangoli."}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {(phase === "study" ? pattern : guess).map((item, index) => (
          <button
            key={index}
            className="panel"
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
            style={{ minHeight: 88, textAlign: "center" }}
          >
            {item ?? "empty"}
          </button>
        ))}
      </div>
      {phase === "rebuild" ? (
        <div className="filters">
          {SHAPES.map((shape) => (
            <button key={shape} className="chip-btn" onClick={() => place(shape)}>
              {shape}
            </button>
          ))}
        </div>
      ) : null}
      <div className="hud-stats">
        <span className="stat">Round {round}</span>
        <span className="stat">Time {time}s</span>
        <span className="stat">Correct {correct}</span>
        <span className="stat">Attempts {attempts}</span>
      </div>
    </div>
  );
}

function pick() {
  return [0, 1, 2, 3].map(() => SHAPES[Math.floor(Math.random() * SHAPES.length)]);
}
