import { useEffect, useReducer, useState } from "react";
import type { GameAPI } from "./types";

export const FOLDS = ["peak", "valley", "fan", "twist"] as const;
type Fold = (typeof FOLDS)[number];
type FoldState = { target: Fold; scores: [number, number]; round: number; turn: 0 | 1; time: number; status: string; finished: boolean };
type Action = { type: "tick" } | { type: "pick"; player: 0 | 1; fold: Fold; alternating: boolean };

const nextTarget = (current?: Fold) => {
  const choices = current ? FOLDS.filter((fold) => fold !== current) : FOLDS;
  return choices[Math.floor(Math.random() * choices.length)];
};

export function foldReducer(state: FoldState, action: Action): FoldState {
  if (state.finished) return state;
  if (action.type === "tick") {
    if (state.time > 1) return { ...state, time: state.time - 1 };
    if (state.round >= 6) return { ...state, time: 0, status: "Time. Match complete.", finished: true };
    return { ...state, round: state.round + 1, target: nextTarget(state.target), time: 12, turn: state.turn === 0 ? 1 : 0, status: "Time. Next fold." };
  }
  if (action.alternating && action.player !== state.turn) return { ...state, status: `Player ${state.turn + 1}'s turn.` };
  if (action.fold !== state.target) return { ...state, status: `${action.fold} does not match. Try again.` };
  const scores: [number, number] = [...state.scores];
  scores[action.player] += 1;
  if (state.round >= 6) return { ...state, scores, status: `Player ${action.player + 1} matched the final fold.`, finished: true };
  return { ...state, scores, round: state.round + 1, target: nextTarget(state.target), time: 12, turn: action.alternating ? (action.player === 0 ? 1 : 0) : state.turn, status: `Player ${action.player + 1} scores. Next fold.` };
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)");
    const update = () => setNarrow(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return narrow;
}

export function TwoPlayerFold({ api, paused }: { api: GameAPI; paused: boolean }) {
  const narrow = useNarrow();
  const [state, dispatch] = useReducer(foldReducer, { target: nextTarget(), scores: [0, 0], round: 1, turn: 0, time: 12, status: "Match the fold shown in the center.", finished: false });

  useEffect(() => {
    if (paused || state.finished) return;
    const timer = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(timer);
  }, [paused, state.finished]);

  useEffect(() => {
    if (!state.finished) return;
    const winner = state.scores[0] === state.scores[1] ? "Draw" : state.scores[0] > state.scores[1] ? "Player 1" : "Player 2";
    const margin = Math.abs(state.scores[0] - state.scores[1]);
    api.onFinish({ score: Math.max(...state.scores) * 100 + Math.min(...state.scores) * 10, stars: margin >= 3 ? 3 : 2, metric: `${winner} · ${state.scores[0]}–${state.scores[1]}` });
  }, [api, state.finished, state.scores]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (paused || narrow) return;
      const p1: Record<string, Fold> = { q: "peak", w: "valley", e: "fan", r: "twist" };
      const p2: Record<string, Fold> = { ArrowLeft: "peak", ArrowDown: "valley", ArrowUp: "fan", ArrowRight: "twist" };
      const fold = p1[event.key.toLowerCase()] ?? p2[event.key];
      if (!fold) return;
      event.preventDefault();
      dispatch({ type: "pick", player: p1[event.key.toLowerCase()] ? 0 : 1, fold, alternating: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [narrow, paused]);

  return (
    <section className="board original-game fold-game" aria-label="Two-player Fold">
      <p className="game-status" aria-live="polite">{state.status}</p>
      <div className="fold-target" aria-label={`Target fold: ${state.target}`}><span aria-hidden="true">{foldSymbol(state.target)}</span><strong>{state.target}</strong></div>
      <p className="fold-mode">{narrow ? `Alternating turns · Player ${state.turn + 1}` : "Simultaneous play · Player 1 Q/W/E/R · Player 2 arrow keys"}</p>
      <div className="grid-2 fold-players">
        <PlayerPanel player={0} score={state.scores[0]} disabled={paused || (narrow && state.turn !== 0)} onPick={(fold) => dispatch({ type: "pick", player: 0, fold, alternating: narrow })} />
        <PlayerPanel player={1} score={state.scores[1]} disabled={paused || (narrow && state.turn !== 1)} onPick={(fold) => dispatch({ type: "pick", player: 1, fold, alternating: narrow })} />
      </div>
      <div className="hud-stats"><span className="stat">Round {state.round}/6</span><span className="stat">Time {state.time}s</span><span className="stat">Player 1 {state.scores[0]}</span><span className="stat">Player 2 {state.scores[1]}</span></div>
    </section>
  );
}

function PlayerPanel({ player, score, disabled, onPick }: { player: 0 | 1; score: number; disabled: boolean; onPick: (fold: Fold) => void }) {
  return <fieldset className="panel fold-player" disabled={disabled}><legend>Player {player + 1} · {score} points</legend><div className="fold-buttons">{FOLDS.map((fold) => <button key={fold} onClick={() => onPick(fold)} aria-label={`Player ${player + 1}: ${fold}`}><span aria-hidden="true">{foldSymbol(fold)}</span><small>{fold}</small></button>)}</div></fieldset>;
}
function foldSymbol(fold: Fold) { return fold === "peak" ? "△" : fold === "valley" ? "▽" : fold === "fan" ? "≋" : "◇"; }
