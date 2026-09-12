export function slide2048(
  board: number[],
  direction: number,
): { board: number[]; score: number; changed: boolean } {
  const result = [...board];
  let score = 0;
  for (let line = 0; line < 4; line++) {
    const indexes = Array.from({ length: 4 }, (_, i) =>
      direction === 0
        ? line * 4 + i
        : direction === 1
          ? line * 4 + 3 - i
          : direction === 2
            ? i * 4 + line
            : (3 - i) * 4 + line,
    );
    const values = indexes.map((i) => board[i]).filter(Boolean);
    const merged: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) {
        merged.push(values[i] * 2);
        score += values[i] * 2;
        i++;
      } else merged.push(values[i]);
    }
    indexes.forEach((idx, i) => (result[idx] = merged[i] || 0));
  }
  return {
    board: result,
    score,
    changed: result.some((x, i) => x !== board[i]),
  };
}
export function wordFeedback(guess: string, answer: string): string[] {
  const out = Array(5).fill("absent");
  const remaining = answer.split("");
  guess.split("").forEach((c, i) => {
    if (c === answer[i]) {
      out[i] = "correct";
      remaining[i] = "";
    }
  });
  guess.split("").forEach((c, i) => {
    if (out[i] === "correct") return;
    const j = remaining.indexOf(c);
    if (j >= 0) {
      out[i] = "present";
      remaining[j] = "";
    }
  });
  return out;
}
export function findMatches(board: number[], size = 8): number[] {
  const hit = new Set<number>();
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ]) {
        const run: number[] = [];
        let xx = x,
          yy = y;
        const color = board[y * size + x];
        if (color < 0) continue;
        while (xx < size && yy < size && board[yy * size + xx] === color) {
          run.push(yy * size + xx);
          xx += dx;
          yy += dy;
        }
        if (run.length >= 3) run.forEach((i) => hit.add(i));
      }
  return [...hit];
}
export type Card = { rank: number; suit: number; up: boolean; id: number };
export const red = (c: Card) => c.suit === 1 || c.suit === 2;
export function validRummy(cards: Card[]): boolean {
  if (!cards.length) return true;
  if (cards.length < 3) return false;
  // At ten cards, enumerating subsets is small and allows overlapping meld choices.
  for (let mask = 1; mask < 1 << cards.length; mask += 2) {
    const group = cards.filter((_, i) => mask & (1 << i));
    if (group.length < 3) continue;
    const sorted = [...group].sort((a, b) => a.rank - b.rank);
    const set =
      group.length <= 4 &&
      group.every((c) => c.rank === group[0].rank) &&
      new Set(group.map((c) => c.suit)).size === group.length;
    const run = sorted.every(
      (c, i) =>
        c.suit === sorted[0].suit && (!i || c.rank === sorted[i - 1].rank + 1),
    );
    if ((set || run) && validRummy(cards.filter((_, i) => !(mask & (1 << i)))))
      return true;
  }
  return false;
}
