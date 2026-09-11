import { useEffect, useRef, useState, type CSSProperties } from "react";
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
const DICE = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const TRACK_52 = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
] as const;
const TRACK = Array.from({ length: 40 }, (_, i) => TRACK_52[Math.floor(i * TRACK_52.length / 40)]);
export function LudoBoard({
  state,
  player,
  move,
  roll,
  rolling = false,
  rollFace = 5,
  moving = false,
  disabled = false,
}: {
  state: LudoState;
  player?: number;
  move: (i: number) => void;
  roll: () => void;
  rolling?: boolean;
  rollFace?: number;
  moving?: boolean;
  disabled?: boolean;
}) {
  const allowed =
    !disabled &&
    !rolling &&
    !moving &&
    state.winner === null &&
    (player === undefined || player === state.turn);
  const legal = legalTokens(state);
  const cell = 32;
  const pos = (square: number) => ({ x: TRACK[square][1] * cell + cell / 2, y: TRACK[square][0] * cell + cell / 2 });
  return (
    <>
      <div className="ludo-stage">
      <svg
        className="ludo-board"
        viewBox="0 0 480 480"
        role="img"
        aria-label="Compact Ludo track with forty squares and four-step home lanes"
      >
        <defs>
          <filter id="ludoShadow"><feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity=".35" /></filter>
          <filter id="tokenShadow"><feDropShadow dx="0" dy="3" stdDeviation="2" floodOpacity=".55" /></filter>
        </defs>
        <rect width="480" height="480" rx="10" fill="#fffaf0" stroke="#d5aa50" strokeWidth="5" filter="url(#ludoShadow)" />
        <rect width="192" height="192" fill={COLORS[0]} />
        <rect x="288" width="192" height="192" fill={COLORS[2]} />
        <rect y="288" width="192" height="192" fill={COLORS[3]} />
        <rect x="288" y="288" width="192" height="192" fill={COLORS[1]} />
        {[{x:32,y:32,c:COLORS[0]},{x:320,y:32,c:COLORS[2]},{x:32,y:320,c:COLORS[3]},{x:320,y:320,c:COLORS[1]}].map((b) => (
          <g key={`${b.x}-${b.y}`}>
            <rect x={b.x} y={b.y} width="128" height="128" rx="12" fill="#fffaf0" stroke="rgba(10,28,45,.24)" strokeWidth="4" />
            {[[38,38],[90,38],[38,90],[90,90]].map(([dx,dy], i) => <circle key={i} cx={b.x + dx} cy={b.y + dy} r="17" fill={b.c} opacity=".92" />)}
          </g>
        ))}
        {Array.from({ length: 15 }, (_, row) => Array.from({ length: 15 }, (_, col) => {
          const path = row >= 6 && row <= 8 || col >= 6 && col <= 8;
          if (!path) return null;
          const lane = row === 7 && col > 0 && col < 7 ? COLORS[0] : row === 7 && col > 7 && col < 14 ? COLORS[1] : col === 7 && row > 0 && row < 7 ? COLORS[2] : col === 7 && row > 7 && row < 14 ? COLORS[3] : "#fffaf0";
          return <rect key={`${row}-${col}`} x={col * cell} y={row * cell} width={cell} height={cell} fill={lane} stroke="#b9b9ad" strokeWidth="1" />;
        }))}
        <polygon points="192,192 288,192 240,240" fill={COLORS[2]} />
        <polygon points="288,192 288,288 240,240" fill={COLORS[1]} />
        <polygon points="288,288 192,288 240,240" fill={COLORS[3]} />
        <polygon points="192,288 192,192 240,240" fill={COLORS[0]} />
        {[{r:6,c:1,color:COLORS[0]},{r:1,c:8,color:COLORS[2]},{r:8,c:13,color:COLORS[1]},{r:13,c:6,color:COLORS[3]}].map((safe) => (
          <g className="ludo-safe-cell" key={`${safe.r}-${safe.c}`}>
            <rect x={safe.c * cell} y={safe.r * cell} width={cell} height={cell} fill={safe.color} stroke="#79858c" />
            <text x={safe.c * cell + 16} y={safe.r * cell + 22} textAnchor="middle" fontSize="20" fill="#fff">★</text>
          </g>
        ))}
        {state.tokens.map((row, p) =>
          row.map((step, i) => {
            const yardOrigins = [{ x: 32, y: 32 }, { x: 320, y: 320 }, { x: 320, y: 32 }, { x: 32, y: 320 }];
            const yard = { x: yardOrigins[p].x + 38 + (i % 2) * 52, y: yardOrigins[p].y + 38 + Math.floor(i / 2) * 52 };
            const homes = [{ x: 208 + (step - 39) * 8, y: 240 }, { x: 272 - (step - 39) * 8, y: 240 }, { x: 240, y: 208 + (step - 39) * 8 }, { x: 240, y: 272 - (step - 39) * 8 }];
            const base = step < 0 ? yard : step >= 40 ? homes[p] : pos((step + p * 10) % 40);
            const stackOffset = step < 0 ? 0 : (i % 2) * 7 - 3;
            return (
              <g
                className={`ludo-token ${allowed && p === state.turn && legal.includes(i) ? "is-playable" : ""} ${moving && p === state.turn ? "is-moving" : ""}`}
                key={`${p}-${i}`}
                transform={`translate(${base.x + stackOffset},${base.y + stackOffset})`}
                role={allowed && p === state.turn && legal.includes(i) ? "button" : undefined}
                tabIndex={allowed && p === state.turn && legal.includes(i) ? 0 : undefined}
                aria-label={`Player ${p + 1} token ${i + 1}`}
                onClick={() => {
                  if (allowed && p === state.turn && legal.includes(i)) move(i);
                }}
                onKeyDown={(event) => {
                  if (allowed && p === state.turn && legal.includes(i) && (event.key === "Enter" || event.key === " ")) move(i);
                }}
              >
                <circle
                  r="11"
                  fill={COLORS[p]}
                  stroke={allowed && p === state.turn && legal.includes(i) ? "#fff" : "#07121b"}
                  strokeWidth={allowed && p === state.turn && legal.includes(i) ? "4" : "2"}
                  filter="url(#tokenShadow)"
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
      <aside className={`ludo-dice-panel ${rolling ? "is-rolling" : ""}`} style={{ "--turn-color": COLORS[state.turn] } as CSSProperties}>
        <span>{moving ? "MOVING…" : rolling ? "ROLLING…" : player === state.turn ? "YOUR TURN" : `PLAYER ${state.turn + 1}`}</span>
        <button className="ludo-die" disabled={!allowed || state.die !== 0 || rolling} onClick={roll} aria-label={rolling ? "Dice rolling" : state.die ? `Rolled ${state.die}` : `Roll dice for Player ${state.turn + 1}`}>
          <span className="ludo-sr-label">Roll</span>
          <span className="ludo-die-face"><b aria-hidden="true">{state.die ? DICE[state.die - 1] : DICE[rollFace - 1]}</b></span>
          <small>{rolling ? "Dice being rolled…" : state.die ? `Rolled ${state.die}` : "ROLL DICE"}</small>
        </button>
        <p>{moving ? "Advancing tile by tile" : rolling ? "Good luck!" : state.die ? "Choose a highlighted token" : "Tap the die to play"}</p>
      </aside>
      </div>
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
    </>
  );
}
export function LocalLudo({ api, paused }: Props) {
  const [state, setState] = useState(() => createLudo(2));
  const [rolling, setRolling] = useState(false);
  const [moving, setMoving] = useState(false);
  const [rollFace, setRollFace] = useState(5);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveOrigin = useRef<LudoState | null>(null);
  const [opponent, setOpponent] = useState<"computer" | "local">("computer");
  const [difficulty, setDifficulty] = useState<"beginner" | "strategic">("strategic");
  useEffect(() => {
    if (!rolling) return;
    const preview = setInterval(() => setRollFace(random(6) + 1), 80);
    return () => clearInterval(preview);
  }, [rolling]);
  useEffect(() => () => {
    if (rollTimer.current !== null) clearTimeout(rollTimer.current);
    if (moveTimer.current !== null) clearTimeout(moveTimer.current);
  }, []);
  useEffect(() => {
    if (!paused) return;
    if (rollTimer.current !== null) clearTimeout(rollTimer.current);
    if (moveTimer.current !== null) clearTimeout(moveTimer.current);
    rollTimer.current = null;
    moveTimer.current = null;
    if (moveOrigin.current) setState(moveOrigin.current);
    moveOrigin.current = null;
    setRolling(false);
    setMoving(false);
  }, [paused]);
  const beginRoll = () => {
    if (rolling || moving || paused || state.die !== 0 || state.winner !== null) return;
    setRolling(true);
    rollTimer.current = setTimeout(() => {
      const result = random(6) + 1;
      setRollFace(result);
      setState((current) => rollLudo(current, result));
      setRolling(false);
      rollTimer.current = null;
    }, 720);
  };
  const resetGame = () => {
    if (rollTimer.current !== null) clearTimeout(rollTimer.current);
    if (moveTimer.current !== null) clearTimeout(moveTimer.current);
    rollTimer.current = null;
    moveTimer.current = null;
    moveOrigin.current = null;
    setRolling(false);
    setMoving(false);
    setRollFace(5);
    setState(createLudo(2));
  };
  const applyMove = (current: LudoState, token: number) => {
    if (moving || !legalTokens(current).includes(token)) return;
    const player = current.turn;
    const before = current.tokens[player][token];
    const steps = before < 0 ? [0] : Array.from({ length: current.die }, (_, index) => before + index + 1);
    moveOrigin.current = current;
    setMoving(true);
    let frame = 0;
    const advance = () => {
      const step = steps[frame];
      setState({ ...current, tokens: current.tokens.map((row, p) => p === player ? row.map((value, i) => i === token ? step : value) : [...row]), message: `Player ${player + 1} moving ${frame + 1} of ${steps.length}…` });
      frame += 1;
      if (frame < steps.length) {
        moveTimer.current = setTimeout(advance, 145);
        return;
      }
      moveTimer.current = setTimeout(() => {
        const next = moveLudo(current, token);
        setState(next);
        setMoving(false);
        moveOrigin.current = null;
        moveTimer.current = null;
        if (next.winner !== null) finish(api, next.winner === 0 ? 1000 : 0, next.winner === 0, `Player ${next.winner + 1} wins`);
      }, 145);
    };
    advance();
  };
  useTick(() => {
    if (opponent !== "computer" || state.turn !== 1 || state.winner !== null || rolling || moving) return;
    if (state.die === 0) { beginRoll(); return; }
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
    <GameFrame title="Ludo" paused={paused} className="ludo-royal-shell" status={state.message}>
      <p className="meta">
        Roll 6 to enter · Safe stars · Exact finish
      </p>
      <div className="game-input-row"><label>Opponent <select value={opponent} onChange={(event) => { setOpponent(event.target.value as typeof opponent); resetGame(); }}><option value="computer">Computer</option><option value="local">Friend on this device</option></select></label>{opponent === "computer" ? <label>Difficulty <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}><option value="beginner">Beginner</option><option value="strategic">Strategic</option></select></label> : null}<button className="btn btn-secondary" onClick={resetGame}>New game</button></div>
      <LudoBoard
        state={state}
        player={opponent === "computer" ? 0 : undefined}
        disabled={paused}
        roll={beginRoll}
        rolling={rolling}
        rollFace={rollFace}
        moving={moving}
        move={(i) => applyMove(state, i)}
      />
    </GameFrame>
  );
}
