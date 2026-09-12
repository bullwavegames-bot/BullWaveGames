export const TRACK = 40;
export const HOME = 44;
export function createLudo(players = 2) {
  return {
    tokens: Array.from({ length: players }, () => [-1, -1, -1, -1]),
    turn: 0,
    die: 0,
    winner: null,
    message: "Roll to begin.",
  };
}
export function legalTokens(state) {
  return state.tokens[state.turn]
    .map((p, i) =>
      state.die &&
      (p === -1 ? state.die === 6 : p < HOME && p + state.die <= HOME)
        ? i
        : -1,
    )
    .filter((i) => i >= 0);
}
export function rollLudo(state, die) {
  if (
    state.winner !== null ||
    state.die ||
    !Number.isInteger(die) ||
    die < 1 ||
    die > 6
  )
    return state;
  const next = {
    ...state,
    die,
    message: `Player ${state.turn + 1} rolled ${die}.`,
  };
  if (!legalTokens(next).length) {
    next.turn = (state.turn + 1) % state.tokens.length;
    next.die = 0;
    next.message += ` No legal moves. Player ${next.turn + 1} rolls.`;
  }
  return next;
}
export function moveLudo(state, index) {
  if (state.winner !== null || !legalTokens(state).includes(index))
    return state;
  const tokens = state.tokens.map((t) => [...t]);
  const player = state.turn;
  const before = tokens[player][index];
  const step = before < 0 ? 0 : before + state.die;
  tokens[player][index] = step;
  const square = (step + player * 10) % TRACK;
  let captured = 0;
  if (step < TRACK && square % 10 !== 0)
    tokens.forEach((row, p) => {
      if (p === player) return;
      row.forEach((v, i) => {
        if (v >= 0 && v < TRACK && (v + p * 10) % TRACK === square) {
          row[i] = -1;
          captured++;
        }
      });
    });
  const winner = tokens[player].every((v) => v === HOME) ? player : null;
  const turn = state.die === 6 ? player : (player + 1) % tokens.length;
  return {
    tokens,
    die: 0,
    turn,
    winner,
    message:
      winner !== null
        ? `Player ${player + 1} wins!`
        : `Player ${player + 1} moved token ${index + 1}.${captured ? ` Captured ${captured} token(s).` : ""} Player ${turn + 1} rolls.`,
  };
}
