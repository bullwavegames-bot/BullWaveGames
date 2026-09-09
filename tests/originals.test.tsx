import assert from "node:assert/strict";
import { act, create } from "react-test-renderer";
import { KiteLine } from "../src/games/KiteLine";
import { LanternPath, lanternsAreAdjacent } from "../src/games/LanternPath";
import { TideTap } from "../src/games/TideTap";
import { PaperGharial } from "../src/games/PaperGharial";
import { RangoliRecall } from "../src/games/RangoliRecall";
import { FOLDS, TwoPlayerFold, foldReducer } from "../src/games/TwoPlayerFold";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const listeners = new Map<string, Set<Function>>();
const media = { matches: false, addEventListener() {}, removeEventListener() {} };
Object.assign(globalThis, {
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
});
Object.assign(globalThis.window, {
  devicePixelRatio: 1,
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  matchMedia: () => media,
  addEventListener: (name: string, fn: Function) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name)!.add(fn);
  },
  removeEventListener: (name: string, fn: Function) => listeners.get(name)?.delete(fn),
});

const originalError = console.error;
console.error = (...args) => {
  if (String(args[0]).includes("react-test-renderer is deprecated")) return;
  originalError(...args);
};

assert.equal(lanternsAreAdjacent(0, 1), true);
assert.equal(lanternsAreAdjacent(0, 6), false);

const foldState = { target: "fan" as const, scores: [0, 0] as [number, number], round: 1, turn: 0 as const, time: 12, status: "", finished: false };
const wrong = foldReducer(foldState, { type: "pick", player: 0, fold: "peak", alternating: false });
assert.deepEqual(wrong.scores, [0, 0], "A different fold must not score");
const right = foldReducer(foldState, { type: "pick", player: 0, fold: "fan", alternating: false });
assert.deepEqual(right.scores, [1, 0]);
const timedOut = foldReducer({ ...foldState, round: 6, time: 1 }, { type: "tick" });
assert.equal(timedOut.finished, true, "Round six timeout must finish the match");
assert.deepEqual(FOLDS, ["peak", "valley", "fan", "twist"]);

const api = { slug: "test", muted: true, reduced: true, continues: 0, onContinue: () => false, onFinish: () => {} };
const mock = (element: any) => element.type === "canvas" ? {
  getContext: () => ({ fillStyle: "", fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {} }),
  width: 640,
  height: 420,
  clientWidth: 640,
  clientHeight: 420,
  addEventListener() {},
  removeEventListener() {},
  setPointerCapture() {},
} : null;

for (const Component of [KiteLine, LanternPath, TideTap, PaperGharial, RangoliRecall, TwoPlayerFold]) {
  let tree: ReturnType<typeof create>;
  await act(() => { tree = create(<Component api={api} paused />, { createNodeMock: mock }); });
  assert.ok(tree!.toJSON(), `${Component.name} should render`);
  await act(() => tree!.unmount());
}
assert.equal([...listeners.values()].reduce((sum, group) => sum + group.size, 0), 0, "Original games must clean up global listeners");
console.log("PASS: six original games mount, clean up controls, validate lantern adjacency, and enforce Fold scoring and timeout rules.");
console.error = originalError;
