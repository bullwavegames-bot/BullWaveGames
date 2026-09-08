import { useEffect, useState } from "react";
import type { GameAPI } from "./types";

const FOLDS = ["peak", "valley", "fan", "twist"] as const;

export function TwoPlayerFold({ api, paused }: { api: GameAPI; paused: boolean }) {
  const narrow = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
  const [target, setTarget] = useState<(typeof FOLDS)[number]>("peak");
  const [scores, setScores] = useState([0, 0]);
  const [round, setRound] = useState(1);
  const [turn, setTurn] = useState<0 | 1>(0);
  const [time, setTime] = useState(12);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (paused) return;
      setTime((value) => {
        if (value <= 1) {
          nextRound(scores);
          return 12;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused, scores]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (paused || narrow) return;
      if (event.key === "a" || event.key === "d" || event.key === "1" || event.key === "2") choose(0, event.key === "a" || event.key === "1" ? "peak" : "valley");
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") choose(1, event.key === "ArrowLeft" ? "peak" : "valley");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const choose = (player: 0 | 1, fold: (typeof FOLDS)[number]) => {
    if (paused) return;
    if (narrow && player !== turn) return;
    if (fold !== target && fold !== "peak" && fold !== "valley") return;
    const hit = fold === target || (target !== "peak" && target !== "valley" ? fold === "peak" : fold === target);
    if (hit) {
      const next = [...scores] as [number, number];
      next[player] += 1;
      setScores(next);
      if (narrow) setTurn(player === 0 ? 1 : 0);
      if (next[0] + next[1] >= 6 || round >= 6) finish(next);
      else nextRound(next);
    }
  };

  const nextRound = (current: number[]) => {
    setRound((value) => value + 1);
    setTarget(FOLDS[Math.floor(Math.random() * FOLDS.length)]);
    setTime(12);
    if (round >= 6) finish(current);
  };

  const finish = (current: number[]) => {
    const winner = current[0] === current[1] ? "Draw" : current[0] > current[1] ? "Player 1" : "Player 2";
    api.onFinish({ score: current[0] + current[1] * 10, stars: 2, metric: `${winner} · ${current[0]}–${current[1]}` });
  };

  return (
    <div className="board" style={{ padding: 16 }}>
      {narrow ? (
        <p className="notice">Alternating-turn mode. This is different from simultaneous desktop play.</p>
      ) : (
        <p>Simultaneous play. Player 1: A/D. Player 2: arrows.</p>
      )}
      <h2 className="display" style={{ fontSize: 40, textAlign: "center" }}>
        Fold: {target}
      </h2>
      <div className="grid-2">
        <div className="panel">
          <h3>Player 1 {narrow && turn === 0 ? "(your turn)" : ""}</h3>
          <p>{scores[0]}</p>
          <ButtonRow onPick={(fold) => choose(0, fold)} />
        </div>
        <div className="panel">
          <h3>Player 2 {narrow && turn === 1 ? "(your turn)" : ""}</h3>
          <p>{scores[1]}</p>
          <ButtonRow onPick={(fold) => choose(1, fold)} />
        </div>
      </div>
      <div className="hud-stats">
        <span className="stat">Round {round}/6</span>
        <span className="stat">Time {time}s</span>
        <span className="stat">
          {scores[0]}–{scores[1]}
        </span>
      </div>
    </div>
  );
}

function ButtonRow({ onPick }: { onPick: (fold: (typeof FOLDS)[number]) => void }) {
  return (
    <div className="filters">
      {FOLDS.map((fold) => (
        <button key={fold} className="chip-btn" onClick={() => onPick(fold)}>
          {fold}
        </button>
      ))}
    </div>
  );
}
