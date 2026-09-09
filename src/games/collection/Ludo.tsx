import { useState } from "react";
import {
  createLudo,
  HOME,
  legalTokens,
  moveLudo,
  rollLudo,
  type LudoState,
} from "../../../shared/ludo.mjs";
import { finish, GameFrame, random, useTick, type Props } from "./common";
const COLORS = ["#61d6b0", "#f16f78", "#43c7e8", "#d5aa50"];
export function LudoBoard({
  state,
  player,
  move,
  roll,
  disabled = false,
}: {
  state: LudoState;
  player?: number;
  move: (i: number) => void;
  roll: () => void;
  disabled?: boolean;
}) {
  const allowed =
    !disabled &&
    state.winner === null &&
    (player === undefined || player === state.turn);
  const legal = legalTokens(state);
  const pos = (square: number, radius = 175) => ({
    x: 240 + radius * Math.cos((square / 40 - 0.25) * Math.PI * 2),
    y: 240 + radius * Math.sin((square / 40 - 0.25) * Math.PI * 2),
  });
  return (
    <>
      <svg
        className="ludo-board"
        viewBox="0 0 480 480"
        role="img"
        aria-label="Compact Ludo track with forty squares and four-step home lanes"
      >
        <rect width="480" height="480" rx="24" fill="#101e2c" />
        {Array.from({ length: 40 }, (_, i) => {
          const p = pos(i);
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r="12"
                fill={i % 10 === 0 ? COLORS[i / 10] : "#243849"}
                stroke="#587083"
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize="10"
                fill="#fff"
              >
                {i % 10 === 0 ? "★" : i + 1}
              </text>
            </g>
          );
        })}
        <text x="240" y="232" textAnchor="middle" fill="#61d6b0" fontSize="22">
          BULLWAVE
        </text>
        <text x="240" y="260" textAnchor="middle" fill="#93a4b8" fontSize="14">
          LUDO · FIRST HOME WINS
        </text>
        {state.tokens.map((row, p) =>
          row.map((step, i) => {
            const base =
              step < 0
                ? pos(p * 10, 95)
                : step >= 40
                  ? pos(p * 10, 150 - (step - 39) * 20)
                  : pos((step + p * 10) % 40);
            return (
              <g
                key={`${p}-${i}`}
                transform={`translate(${base.x + (i % 2) * 9 - 4},${base.y + Math.floor(i / 2) * 9 - 4})`}
              >
                <circle
                  r="9"
                  fill={COLORS[p]}
                  stroke="#07121b"
                  strokeWidth="2"
                />
                <text
                  textAnchor="middle"
                  y="3"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#07121b"
                >
                  {i + 1}
                </text>
              </g>
            );
          }),
        )}
      </svg>
      <div className="ludo-players">
        {state.tokens.map((row, p) => (
          <div
            className={state.turn === p ? "active-player" : ""}
            style={{ borderColor: COLORS[p] }}
            key={p}
          >
            <strong style={{ color: COLORS[p] }}>
              Player {p + 1}
              {player === p ? " (you)" : ""}
            </strong>
            <div>
              {row.map((v, i) => (
                <button
                  className="btn btn-secondary"
                  key={i}
                  disabled={!allowed || p !== state.turn || !legal.includes(i)}
                  onClick={() => move(i)}
                >
                  Token {i + 1}
                  <small>
                    {v < 0
                      ? "Yard"
                      : v === HOME
                        ? "Finished"
                        : v >= 40
                          ? `Home ${v - 39}/4`
                          : `Step ${v + 1}/40`}
                  </small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        className="btn btn-primary"
        disabled={!allowed || state.die !== 0}
        onClick={roll}
      >
        {state.die
          ? `Rolled ${state.die} — choose a token`
          : `Roll · Player ${state.turn + 1}`}
      </button>
    </>
  );
}
export function LocalLudo({ api, paused }: Props) {
  const [state, setState] = useState(() => createLudo(2));
  const [opponent, setOpponent] = useState<"computer" | "local">("computer");
  const [difficulty, setDifficulty] = useState<"beginner" | "strategic">("strategic");
  const applyMove = (current: LudoState, token: number) => {
    const next = moveLudo(current, token);
    setState(next);
    if (next.winner !== null) finish(api, next.winner === 0 ? 1000 : 0, next.winner === 0, `Player ${next.winner + 1} wins`);
  };
  useTick(() => {
    if (opponent !== "computer" || state.turn !== 1 || state.winner !== null) return;
    if (state.die === 0) { setState(rollLudo(state, random(6) + 1)); return; }
    const legal = legalTokens(state);
    if (!legal.length) return;
    const token = difficulty === "beginner" ? legal[random(legal.length)] : [...legal].sort((a, b) => {
      const score = (index: number) => {
        const next = moveLudo(state, index);
        const before = state.tokens[1][index], after = next.tokens[1][index];
        return (after === HOME ? 1000 : after) - before + (next.message.includes("captured") ? 100 : 0);
      };
      return score(b) - score(a);
    })[0];
    applyMove(state, token);
  }, 650, paused);
  return (
    <GameFrame title="Ludo" paused={paused} status={state.message}>
      <p className="meta">
        Roll 6 to enter · Safe stars · Exact finish
      </p>
      <div className="game-input-row"><label>Opponent <select value={opponent} onChange={(event) => { setOpponent(event.target.value as typeof opponent); setState(createLudo(2)); }}><option value="computer">Computer</option><option value="local">Friend on this device</option></select></label>{opponent === "computer" ? <label>Difficulty <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}><option value="beginner">Beginner</option><option value="strategic">Strategic</option></select></label> : null}<button className="btn btn-secondary" onClick={() => setState(createLudo(2))}>New game</button></div>
      <LudoBoard
        state={state}
        player={opponent === "computer" ? 0 : undefined}
        disabled={paused}
        roll={() => setState(rollLudo(state, random(6) + 1))}
        move={(i) => applyMove(state, i)}
      />
    </GameFrame>
  );
}
