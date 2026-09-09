import { useEffect, useState } from "react";
import type { GameAPI } from "./types";

const SHAPES = ["circle", "diamond", "square", "petal"] as const;
type Shape = (typeof SHAPES)[number];
const SYMBOLS: Record<Shape, string> = { circle: "●", diamond: "◆", square: "■", petal: "✦" };

export function RangoliRecall({ api, paused }: { api: GameAPI; paused: boolean }) {
  const [phase, setPhase] = useState<"study" | "rebuild">("study");
  const [round, setRound] = useState(1);
  const [pattern, setPattern] = useState<Shape[]>(() => pick());
  const [guess, setGuess] = useState<Array<Shape | null>>([null, null, null, null]);
  const [selected, setSelected] = useState(0);
  const [attempts, setAttempts] = useState(3);
  const [correct, setCorrect] = useState(0);
  const [time, setTime] = useState(8);
  const [status, setStatus] = useState("Study the four shapes and their positions.");

  const failAttempt = (message: string) => {
    const left = attempts - 1;
    setAttempts(left);
    setGuess([null, null, null, null]);
    setSelected(0);
    setStatus(message);
    if (left <= 0) api.onFinish({ score: correct * 10, stars: 1, metric: "Pattern faded" });
  };

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setTime((value) => {
        if (value > 1) return value - 1;
        if (phase === "study") {
          setPhase("rebuild");
          setStatus("Rebuild the pattern before time runs out.");
          return Math.max(7, 13 - round);
        }
        failAttempt("Time ran out. Try this pattern again.");
        return Math.max(7, 13 - round);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempts, correct, paused, phase, round]);

  const place = (shape: Shape) => {
    if (phase !== "rebuild" || paused) return;
    const next = [...guess];
    next[selected] = shape;
    setGuess(next);
    const nextEmpty = next.findIndex((item) => item === null);
    if (nextEmpty >= 0) { setSelected(nextEmpty); setStatus(`${shape} placed. ${next.filter(Boolean).length}/4 filled.`); return; }
    const ok = next.every((item, index) => item === pattern[index]);
    if (!ok) { failAttempt("Some positions did not match. The board has been cleared."); return; }
    const nextRound = round + 1;
    setCorrect((value) => value + 4);
    if (nextRound > 3) {
      api.onFinish({ score: 300 + attempts * 20, stars: attempts === 3 ? 3 : attempts === 2 ? 2 : 1, metric: `3 rounds · ${attempts} attempts left` });
      return;
    }
    setRound(nextRound);
    setPattern(pick());
    setGuess([null, null, null, null]);
    setSelected(0);
    setPhase("study");
    setTime(Math.max(5, 9 - nextRound));
    setStatus(`Round ${nextRound}. Study the new pattern.`);
  };

  return (
    <section className="board original-game rangoli-game" aria-label="Rangoli Recall">
      <p className="game-status" aria-live="polite">{status}</p>
      <div className="rangoli-grid" aria-label={phase === "study" ? "Pattern to remember" : "Your rebuilt pattern"}>
        {(phase === "study" ? pattern : guess).map((item, index) => phase === "study" ? (
          <div key={index} className="rangoli-cell study" aria-label={`Position ${index + 1}: ${item}`}><ShapeToken shape={item as Shape} /></div>
        ) : (
          <button key={index} className={`rangoli-cell ${selected === index ? "selected" : ""}`} aria-pressed={selected === index} aria-label={`Position ${index + 1}: ${item ?? "empty"}`} onClick={() => setSelected(index)} disabled={paused}>{item ? <ShapeToken shape={item} /> : <span className="empty-slot">+</span>}</button>
        ))}
      </div>
      {phase === "rebuild" ? <div className="shape-tray" aria-label="Choose a shape">{SHAPES.map((shape) => <button key={shape} onClick={() => place(shape)} disabled={paused} aria-label={`Place ${shape} in position ${selected + 1}`}><ShapeToken shape={shape} /><span>{shape}</span></button>)}</div> : <p className="study-note">The pattern will hide in {time} seconds.</p>}
      <div className="hud-stats"><span className="stat">Round {round}/3</span><span className="stat">Time {time}s</span><span className="stat">Matched {correct}</span><span className="stat">Attempts {attempts}</span></div>
    </section>
  );
}

function ShapeToken({ shape }: { shape: Shape }) { return <span className={`rangoli-token ${shape}`} aria-hidden="true">{SYMBOLS[shape]}</span>; }
function pick(): Shape[] { return [0, 1, 2, 3].map(() => SHAPES[Math.floor(Math.random() * SHAPES.length)]); }
