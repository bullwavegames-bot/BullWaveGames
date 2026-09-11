import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { CollectionGame } from "../src/games/collection";
import { COLLECTION, COLLECTION_GROUPS } from "../src/data/collection";
import { GAMES } from "../src/data/games";
import {
  findMatches,
  slide2048,
  validRummy,
  wordFeedback,
  type Card,
} from "../src/games/collection/rules";
import {
  createLudo,
  legalTokens,
  moveLudo,
  rollLudo,
  HOME,
} from "../shared/ludo.mjs";
import { Chess } from "chess.js";

assert.equal(COLLECTION.length, 26);
assert.equal(new Set(GAMES.map((g) => g.slug)).size, 28);
assert.deepEqual(
  COLLECTION_GROUPS.map(
    (genre) => COLLECTION.filter((g) => g.genre === genre).length,
  ),
  [5, 6, 7, 4, 2, 2],
);
for (const game of COLLECTION) {
  const html = renderToString(
    <CollectionGame
      api={{
        slug: game.slug,
        muted: true,
        reduced: true,
        continues: 0,
        onContinue: () => false,
        onFinish: () => {
          throw Error("Finished during render");
        },
      }}
      paused={false}
    />,
  );
  assert.ok(html.includes("collection-game"), game.slug);
  assert.ok(!html.includes("Game unavailable"), game.slug);
}
const board = [2, 2, 2, 2, ...Array(12).fill(0)];
const merge = slide2048(board, 0);
assert.deepEqual(merge.board.slice(0, 4), [4, 4, 0, 0]);
assert.equal(merge.score, 8);
assert.deepEqual(board.slice(0, 4), [2, 2, 2, 2]);
assert.deepEqual(
  slide2048([4, 4, 8, 0, ...Array(12).fill(0)], 0).board.slice(0, 4),
  [8, 8, 0, 0],
);
assert.deepEqual(
  slide2048([2, 0, 0, 0, 2, 0, 0, 0, ...Array(8).fill(0)], 2).board.slice(0, 4),
  [4, 0, 0, 0],
);
assert.deepEqual(wordFeedback("APPLE", "GRAPE"), [
  "present",
  "present",
  "absent",
  "absent",
  "correct",
]);
assert.deepEqual(wordFeedback("EERIE", "SPEED"), [
  "present",
  "present",
  "absent",
  "absent",
  "absent",
]);
const gemBoard = Array.from(
  { length: 64 },
  (_, i) => (i + Math.floor(i / 8)) % 6,
);
gemBoard[0] = gemBoard[1] = gemBoard[2] = 5;
assert.ok([0, 1, 2].every((i) => findMatches(gemBoard).includes(i)));
const card = (rank: number, suit: number, id = rank * 4 + suit): Card => ({
  rank,
  suit,
  id,
  up: true,
});
assert.equal(
  validRummy([
    card(1, 0),
    card(2, 0),
    card(3, 0),
    card(7, 0),
    card(7, 1),
    card(7, 2),
    card(9, 1),
    card(10, 1),
    card(11, 1),
    card(12, 1),
  ]),
  true,
);
assert.equal(validRummy([card(1, 0), card(2, 1), card(3, 0)]), false);
let l = createLudo(2);
assert.equal(rollLudo(l, 2).turn, 1);
l = rollLudo(l, 6);
assert.deepEqual(legalTokens(l), [0, 1, 2, 3]);
l = moveLudo(l, 0);
assert.equal(l.tokens[0][0], 0);
assert.equal(l.turn, 0);
l = {
  ...createLudo(2),
  tokens: [
    [4, -1, -1, -1],
    [37, -1, -1, -1],
  ],
  die: 3,
};
l = moveLudo(l, 0);
assert.equal(l.tokens[1][0], -1);
l = {
  ...createLudo(2),
  tokens: [
    [HOME - 1, HOME, HOME, HOME],
    [-1, -1, -1, -1],
  ],
  die: 2,
};
assert.deepEqual(legalTokens(l), []);
l = { ...l, die: 1 };
assert.equal(moveLudo(l, 0).winner, 0);
const chess = new Chess();
for (const move of ["f3", "e5", "g4", "Qh4#"]) chess.move(move);
assert.ok(chess.isCheckmate());
const castle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
assert.ok(castle.moves().includes("O-O"));
castle.move("O-O");
assert.equal(castle.get("f1")?.type, "r");
console.log(
  "PASS: 26 game renders, 28 unique entries, category counts, 2048 merges, duplicate-letter scoring, matches, rummy melds, Ludo turns/captures/finish, chess mate/castling.",
);
